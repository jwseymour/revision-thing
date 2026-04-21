import { SupabaseClient } from "@supabase/supabase-js";
import { getDueModules } from "./scheduling";

export async function getDailyTarget(supabase: SupabaseClient, userId: string) {
  const dueModules = await getDueModules(supabase, userId);
  
  // Base target of 20 questions/flashcards, plus a factor for how many modules are due
  const dueCount = dueModules.length;
  // Let's say we expect ~5 questions per due module
  const targetItems = 20 + dueCount * 5;

  // Find attempts today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count: completedToday } = await supabase
    .from("attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", today.toISOString());

  const completed = completedToday || 0;
  const progressPercent = Math.min(100, Math.round((completed / targetItems) * 100));

  return {
    target: targetItems,
    completed,
    progressPercent,
    isComplete: completed >= targetItems,
    dueCount, // pass this along for convenience
  };
}
