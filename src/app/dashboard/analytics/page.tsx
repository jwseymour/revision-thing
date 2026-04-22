import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { calculateRetrievability } from "@/lib/scheduling";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // 1. Fetch profile (streak data)
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_streak, longest_streak, last_practice_date")
    .eq("id", user.id)
    .single();

  // 2. Fetch total flashcards
  const { count: totalCards } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // 3. Fetch today's attempts
  const { count: todayReviewed } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", `${todayStr}T00:00:00.000Z`);

  // 4. Fetch all attempts in last 90 days for heatmap + classifications
  const { data: recentAttempts } = await supabase
    .from("attempts")
    .select("classification, created_at")
    .eq("user_id", user.id)
    .gte("created_at", ninetyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  // 5. Build heatmap data
  const dayCountMap = new Map<string, number>();
  recentAttempts?.forEach((a) => {
    const day = a.created_at.split("T")[0];
    dayCountMap.set(day, (dayCountMap.get(day) || 0) + 1);
  });
  const activityHeatmap = Array.from(dayCountMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  // 6. Build classification breakdown
  const classifications = {
    correct_confident: 0,
    correct_guessed: 0,
    partial: 0,
    incorrect: 0,
  };
  recentAttempts?.forEach((a) => {
    const c = a.classification as keyof typeof classifications;
    if (c in classifications) {
      classifications[c]++;
    }
  });

  // 7. Total attempts
  const totalAttempts = recentAttempts?.length || 0;

  // 8. Build module mastery with trends
  // Fetch flashcards grouped by module
  const { data: flashcards } = await supabase
    .from("flashcards")
    .select("id, module")
    .eq("user_id", user.id);

  const moduleGroups = new Map<string, string[]>();
  flashcards?.forEach((fc) => {
    if (!moduleGroups.has(fc.module)) {
      moduleGroups.set(fc.module, []);
    }
    moduleGroups.get(fc.module)!.push(fc.id);
  });

  // Fetch all scheduling states
  const allFlashcardIds = flashcards?.map((fc) => fc.id) || [];
  const { data: schedules } = await supabase
    .from("item_scheduling_state")
    .select("item_id, stability, next_review_at, updated_at")
    .eq("user_id", user.id)
    .in("item_id", allFlashcardIds.length > 0 ? allFlashcardIds : ["__none__"]);

  const scheduleMap = new Map<string, { stability: number; next_review_at: string; updated_at: string }>();
  schedules?.forEach((s) => scheduleMap.set(s.item_id, s));

  // Fetch attempts from last 7 and previous 7 days for trend detection
  const { data: last7Attempts } = await supabase
    .from("attempts")
    .select("item_id, classification")
    .eq("user_id", user.id)
    .gte("created_at", sevenDaysAgo.toISOString());

  const { data: prev7Attempts } = await supabase
    .from("attempts")
    .select("item_id, classification")
    .eq("user_id", user.id)
    .gte("created_at", fourteenDaysAgo.toISOString())
    .lt("created_at", sevenDaysAgo.toISOString());

  // Compute module-level trend
  function getSuccessRate(attempts: typeof last7Attempts, moduleIds: string[]): number {
    if (!attempts) return 0;
    const moduleAttempts = attempts.filter((a) => moduleIds.includes(a.item_id));
    if (moduleAttempts.length === 0) return 0;
    const successes = moduleAttempts.filter(
      (a) => a.classification === "correct_confident" || a.classification === "correct_guessed"
    ).length;
    return successes / moduleAttempts.length;
  }

  const modules = Array.from(moduleGroups.entries()).map(([moduleName, ids]) => {
    // Compute confidence
    let retrievabilitySum = 0;
    let dueCount = 0;
    for (const id of ids) {
      const s = scheduleMap.get(id);
      if (s) {
        const lastReview = s.updated_at ? new Date(s.updated_at) : now;
        const elapsed = Math.max(0, (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
        retrievabilitySum += calculateRetrievability(s.stability || 0, elapsed);

        if (new Date(s.next_review_at) <= now) dueCount++;
      } else {
        dueCount++;
      }
    }
    const confidence = Math.round((retrievabilitySum / ids.length) * 100);

    // Compute trend
    const last7Rate = getSuccessRate(last7Attempts, ids);
    const prev7Rate = getSuccessRate(prev7Attempts, ids);
    let trend: "up" | "down" | "flat" = "flat";
    if (last7Rate > prev7Rate + 0.1) trend = "up";
    else if (last7Rate < prev7Rate - 0.1) trend = "down";

    return {
      module: moduleName,
      confidence,
      dueCount,
      totalCards: ids.length,
      trend,
    };
  });

  // Sort by confidence ascending (weakest first)
  modules.sort((a, b) => a.confidence - b.confidence);

  return (
    <AnalyticsDashboard
      data={{
        streak: {
          current: profile?.current_streak || 0,
          longest: profile?.longest_streak || 0,
          lastPractice: profile?.last_practice_date || null,
        },
        todayReviewed: todayReviewed || 0,
        totalCards: totalCards || 0,
        totalAttempts,
        modules,
        activityHeatmap,
        classifications,
      }}
    />
  );
}
