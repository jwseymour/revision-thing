import { SupabaseClient } from "@supabase/supabase-js";
import { fsrs, Rating, Card, createEmptyCard } from 'ts-fsrs';

// Map our UI classifications to FSRS Ratings
const RATING_MAP: Record<string, Rating> = {
  correct_confident: Rating.Easy,
  correct_guessed: Rating.Good,
  partial: Rating.Hard,
  incorrect: Rating.Again,
};

// Initialize FSRS engine with default parameters
const fsrsEngine = fsrs({});

export async function updateSchedule(
  supabase: SupabaseClient,
  userId: string,
  moduleName: string,
  itemId: string,
  itemType: string,
  classification: string
) {
  const rating = RATING_MAP[classification] ?? Rating.Again;
  const now = new Date();

  // 1. Get current schedule state for the item from Supabase
  const { data: state, error: fetchError } = await supabase
    .from("item_scheduling_state")
    .select("*")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("Error fetching item scheduling state:", fetchError);
    return;
  }

  // 2. FSRS Algorithm: Construct current Card state
  let currentCard: Card;
  
  if (state) {
    currentCard = {
      due: new Date(state.next_review_at),
      stability: state.stability ?? 0,
      difficulty: state.difficulty ?? 0,
      elapsed_days: state.elapsed_days ?? 0,
      scheduled_days: state.scheduled_days ?? 0,
      reps: state.reps ?? 0,
      lapses: state.lapses ?? 0,
      state: state.state ?? 0,
      last_review: state.updated_at ? new Date(state.updated_at) : undefined,
    };
  } else {
    // Brand new card
    currentCard = createEmptyCard(now);
  }

  // Calculate the next scheduling state using FSRS
  const schedulingRecord = fsrsEngine.repeat(currentCard, now);
  
  // schedulingRecord returns a RecordLog map indexed by Rating (Again=1, Hard=2, Good=3, Easy=4)
  const nextLogInfo = schedulingRecord[rating];
  const newCard = nextLogInfo.card;

  // 3. Upsert item scheduling state
  const { error: upsertError } = await supabase
    .from("item_scheduling_state")
    .upsert({
      user_id: userId,
      item_id: itemId,
      item_type: itemType,
      stability: newCard.stability,
      difficulty: newCard.difficulty,
      elapsed_days: newCard.elapsed_days,
      scheduled_days: newCard.scheduled_days,
      reps: newCard.reps,
      lapses: newCard.lapses,
      state: newCard.state,
      next_review_at: newCard.due.toISOString(),
      updated_at: newCard.last_review?.toISOString() || now.toISOString(),
    }, { onConflict: "user_id,item_id" });

  if (upsertError) {
    console.error("Error updating item scheduling state:", upsertError);
  }

  // 4. Update the aggregate module scheduling state (so the UI can still suggest modules)
  // Simplified logic: Bumping module's mastery forward with the item's new scheduling metrics.
  const { data: moduleState } = await supabase
    .from("scheduling_state")
    .select("*")
    .eq("user_id", userId)
    .eq("module", moduleName)
    .single();
    
  await supabase
    .from("scheduling_state")
    .upsert({
      user_id: userId,
      module: moduleName,
      // Just keep average module difficulty/stability approximate for sorting
      stability: ((moduleState?.stability ?? 0) + newCard.stability) / (moduleState ? 2 : 1),
      difficulty: ((moduleState?.difficulty ?? 0) + newCard.difficulty) / (moduleState ? 2 : 1),
      elapsed_days: newCard.elapsed_days,
      scheduled_days: newCard.scheduled_days,
      reps: (moduleState?.reps ?? 0) + 1,
      lapses: moduleState?.lapses ?? 0,
      state: moduleState?.state ?? 0,
      next_review_at: newCard.due.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "user_id,module" });
}

/**
 * Get all modules due for review today or earlier.
 */
export async function getDueModules(supabase: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from("scheduling_state")
    .select("module, next_review_at, scheduled_days")
    .eq("user_id", userId)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true }); // Most overdue first

  if (error) {
    console.error("Error fetching due modules:", error);
    return [];
  }

  return data;
}
