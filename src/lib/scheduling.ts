import { SupabaseClient } from "@supabase/supabase-js";

// Map our UI classifications to SM-2 Quality (0-5)
const QUALITY_MAP: Record<string, number> = {
  correct_confident: 5,
  correct_guessed: 4,
  partial: 2,
  incorrect: 0,
};

export async function updateSchedule(
  supabase: SupabaseClient,
  userId: string,
  moduleName: string,
  topic: string,
  classification: string
) {
  const quality = QUALITY_MAP[classification] ?? 0;

  // 1. Get current schedule state
  const { data: state, error: fetchError } = await supabase
    .from("scheduling_state")
    .select("*")
    .eq("user_id", userId)
    .eq("module", moduleName)
    .eq("topic", topic)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("Error fetching scheduling state:", fetchError);
    return;
  }

  let easeFactor = state?.ease_factor ?? 2.5;
  let intervalDays = state?.interval_days ?? 0;
  let repetitionCount = state?.repetition_count ?? 0;

  // 2. SM-2 Algorithm
  if (quality >= 3) {
    if (repetitionCount === 0) {
      intervalDays = 1;
    } else if (repetitionCount === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitionCount += 1;
  } else {
    repetitionCount = 0;
    intervalDays = 1;
  }

  // Calculate new Ease Factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor); // Minimum ease is 1.3

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

  // 3. Upsert
  const { error: upsertError } = await supabase
    .from("scheduling_state")
    .upsert({
      user_id: userId,
      module: moduleName,
      topic,
      ease_factor: easeFactor,
      interval_days: intervalDays,
      repetition_count: repetitionCount,
      next_review_at: nextReviewDate.toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,module,topic" });

  if (upsertError) {
    console.error("Error updating scheduling state:", upsertError);
  }
}

/**
 * Get all topics due for review today or earlier.
 */
export async function getDueTopics(supabase: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from("scheduling_state")
    .select("module, topic, next_review_at, interval_days")
    .eq("user_id", userId)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true }); // Most overdue first

  if (error) {
    console.error("Error fetching due topics:", error);
    return [];
  }

  return data;
}
