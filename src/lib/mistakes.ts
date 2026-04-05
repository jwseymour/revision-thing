import { SupabaseClient } from "@supabase/supabase-js";

export async function getMistakePatterns(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("mistake_records")
    .select("topic, error_type")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching mistakes:", error);
    return [];
  }

  return data;
}

export async function getUnresolvedMistakes(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("mistake_records")
    .select(`
      id, created_at, error_type, topic, module, description,
      attempts!inner (
        item_id, item_type
      )
    `)
    .eq("user_id", userId)
    .eq("resolved", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching unresolved mistakes:", error);
    return [];
  }

  return data;
}
