import { SupabaseClient } from "@supabase/supabase-js";
import { fsrs, Rating, Grade, Card, createEmptyCard } from 'ts-fsrs';

// Map our UI classifications to FSRS Ratings
const RATING_MAP: Record<string, Rating> = {
  correct_confident: Rating.Easy,
  correct_guessed: Rating.Good,
  partial: Rating.Hard,
  incorrect: Rating.Again,
};

// Initialize FSRS engine with default parameters
const fsrsEngine = fsrs({});

// ============================================================
// FSRS Retrievability
// ============================================================

/**
 * Calculate retrievability (probability of correct recall) for a card.
 * Uses the FSRS formula: R = e^(-t/S) where S = stability, t = elapsed days.
 * Returns a value between 0 and 1.
 */
export function calculateRetrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return Math.exp(-elapsedDays / stability);
}

// ============================================================
// Module Priority Engine
// ============================================================

export interface ModulePriority {
  module: string;
  confidence: number;       // 0-100, mean retrievability across all cards
  dueCount: number;          // Number of overdue cards
  totalCards: number;        // Total flashcards in module
  priorityScore: number;     // 0-1, higher = more urgent
  lastStudied: string | null; // ISO date of most recent attempt
  estimatedMinutes: number;  // Estimated review time
  recommendedCount: number;  // Suggested number of cards to review this session
}

/**
 * Get all modules ranked by review priority.
 * Priority = f(confidence, overdue_urgency, recency)
 * Returns ALL modules with flashcards, not just those with due cards.
 * Modules with due cards are ranked higher, but every module always appears.
 */
export async function getModulePriorities(
  supabase: SupabaseClient,
  userId: string
): Promise<ModulePriority[]> {
  const now = new Date();

  // 1. Fetch all flashcards with their modules
  const { data: flashcards } = await supabase
    .from("flashcards")
    .select("id, module")
    .eq("user_id", userId);

  if (!flashcards || flashcards.length === 0) return [];

  // 2. Fetch all scheduling states for these cards
  const flashcardIds = flashcards.map(fc => fc.id);
  const { data: schedules } = await supabase
    .from("item_scheduling_state")
    .select("item_id, stability, difficulty, elapsed_days, scheduled_days, next_review_at, updated_at, reps")
    .eq("user_id", userId)
    .in("item_id", flashcardIds);

  // 3. Fetch most recent attempt per module for recency
  const { data: recentAttempts } = await supabase
    .from("attempts")
    .select("item_id, created_at")
    .eq("user_id", userId)
    .eq("item_type", "flashcard")
    .order("created_at", { ascending: false })
    .limit(500);

  // Build a map of item_id -> schedule
  const scheduleMap = new Map<string, typeof schedules extends (infer T)[] | null ? T : never>();
  schedules?.forEach(s => scheduleMap.set(s.item_id, s));

  // Build a map of item_id -> flashcard module
  const itemModuleMap = new Map<string, string>();
  flashcards.forEach(fc => itemModuleMap.set(fc.id, fc.module));

  // Build a map of module -> most recent attempt date
  const moduleLastStudied = new Map<string, string>();
  recentAttempts?.forEach(a => {
    const mod = itemModuleMap.get(a.item_id);
    if (mod && !moduleLastStudied.has(mod)) {
      moduleLastStudied.set(mod, a.created_at);
    }
  });

  // 4. Group flashcards by module and compute metrics
  const moduleGroups = new Map<string, { ids: string[] }>();
  flashcards.forEach(fc => {
    if (!moduleGroups.has(fc.module)) {
      moduleGroups.set(fc.module, { ids: [] });
    }
    moduleGroups.get(fc.module)!.ids.push(fc.id);
  });

  const priorities: ModulePriority[] = [];
  let maxUrgency = 0;
  let maxRecencyDays = 0;

  // First pass: compute raw metrics
  const rawMetrics: Array<{
    module: string;
    confidence: number;
    dueCount: number;
    totalCards: number;
    urgencySum: number;
    recencyDays: number;
    lastStudied: string | null;
  }> = [];

  for (const [moduleName, group] of moduleGroups) {
    let retrievabilitySum = 0;
    let dueCount = 0;
    let urgencySum = 0;

    for (const id of group.ids) {
      const schedule = scheduleMap.get(id);
      if (schedule) {
        const lastReview = schedule.updated_at ? new Date(schedule.updated_at) : now;
        const elapsedDays = Math.max(0, (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
        const retrievability = calculateRetrievability(schedule.stability || 0, elapsedDays);
        retrievabilitySum += retrievability;

        const dueDate = new Date(schedule.next_review_at);
        if (dueDate <= now) {
          dueCount++;
          const daysOverdue = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
          urgencySum += daysOverdue;
        }
      } else {
        // Unseen card — 0 retrievability, counts as due
        dueCount++;
        urgencySum += 1; // Mild urgency for never-seen cards
      }
    }

    const confidence = (retrievabilitySum / group.ids.length) * 100;
    const lastStudied = moduleLastStudied.get(moduleName) || null;
    const recencyDays = lastStudied
      ? (now.getTime() - new Date(lastStudied).getTime()) / (1000 * 60 * 60 * 24)
      : 30; // Default to 30 days if never studied

    maxUrgency = Math.max(maxUrgency, urgencySum);
    maxRecencyDays = Math.max(maxRecencyDays, recencyDays);

    rawMetrics.push({
      module: moduleName,
      confidence,
      dueCount,
      totalCards: group.ids.length,
      urgencySum,
      recencyDays,
      lastStudied,
    });
  }

  // Second pass: normalize and compute priority scores
  for (const m of rawMetrics) {
    const normalizedUrgency = maxUrgency > 0 ? m.urgencySum / maxUrgency : 0;
    const normalizedRecency = maxRecencyDays > 0 ? m.recencyDays / maxRecencyDays : 0;
    const confidenceFactor = 1 - (m.confidence / 100);

    // Priority: low confidence, high urgency, long since studied = higher priority
    const priorityScore = confidenceFactor * 0.4 + normalizedUrgency * 0.35 + normalizedRecency * 0.25;

    // Recommended count: all due cards + up to 5 extra for reinforcement (capped at 20)
    const recommendedCount = Math.min(Math.max(m.dueCount, Math.ceil(m.totalCards * 0.3)), 20);

    priorities.push({
      module: m.module,
      confidence: Math.round(m.confidence),
      dueCount: m.dueCount,
      totalCards: m.totalCards,
      priorityScore,
      lastStudied: m.lastStudied,
      estimatedMinutes: Math.max(1, Math.round(recommendedCount * 1.5)),
      recommendedCount,
    });
  }

  // Sort by priority descending (most urgent first)
  priorities.sort((a, b) => b.priorityScore - a.priorityScore);

  return priorities;
}

// ============================================================
// Ordered Due Cards (per module, by retrievability)
// ============================================================

/**
 * Get ALL cards for a specific module, ordered by:
 * 1. Due cards first (sorted by retrievability ascending — most likely to forget first)
 * 2. Not-yet-due cards second (sorted by retrievability ascending — weakest first)
 * This ensures there's always more to study even when nothing is "overdue".
 */
export async function getOrderedDueCards(
  supabase: SupabaseClient,
  userId: string,
  moduleName: string
) {
  const now = new Date();

  // 1. Fetch flashcards for this module
  const { data: flashcards } = await supabase
    .from("flashcards")
    .select("id, front, back, card_type, cascade_content, module")
    .eq("user_id", userId)
    .eq("module", moduleName);

  if (!flashcards || flashcards.length === 0) return [];

  const flashcardIds = flashcards.map(fc => fc.id);

  // 2. Fetch scheduling states
  const { data: schedules } = await supabase
    .from("item_scheduling_state")
    .select("*")
    .eq("user_id", userId)
    .in("item_id", flashcardIds);

  // 3. Build items with retrievability
  const items = flashcards.map(flashcard => {
    const schedule = schedules?.find(s => s.item_id === flashcard.id);
    let retrievability = 0;

    if (schedule) {
      const lastReview = schedule.updated_at ? new Date(schedule.updated_at) : now;
      const elapsedDays = Math.max(0, (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
      retrievability = calculateRetrievability(schedule.stability || 0, elapsedDays);
    }

    const isDue = schedule
      ? new Date(schedule.next_review_at) <= now
      : true; // Unseen cards are always due

    return {
      schedule: schedule ? {
        id: schedule.id,
        stability: schedule.stability,
        difficulty: schedule.difficulty,
        elapsed_days: schedule.elapsed_days,
        scheduled_days: schedule.scheduled_days,
        reps: schedule.reps,
        lapses: schedule.lapses,
        state: schedule.state,
        next_review_at: schedule.next_review_at,
      } : {
        id: "new",
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        next_review_at: now.toISOString(),
      },
      flashcard,
      retrievability,
      isDue,
    };
  });

  // 4. Sort: due cards first (by retrievability asc), then not-due (by retrievability asc)
  return items.sort((a, b) => {
    // Due cards always come before not-due cards
    if (a.isDue && !b.isDue) return -1;
    if (!a.isDue && b.isDue) return 1;
    // Within the same group, lowest retrievability first (most likely to forget)
    const rDiff = a.retrievability - b.retrievability;
    if (Math.abs(rDiff) > 0.01) return rDiff;
    // Tiebreaker: hardest cards first
    return (b.schedule.difficulty || 0) - (a.schedule.difficulty || 0);
  });
}

// ============================================================
// Core Schedule Update (existing, with streak tracking added)
// ============================================================

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
      ...createEmptyCard(new Date()),
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
  
  // schedulingRecord returns a RecordLog map indexed by Grade (Again=1, Hard=2, Good=3, Easy=4)
  const nextLogInfo = schedulingRecord[rating as unknown as Grade];
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

  // 5. Update streak tracking in profiles
  try {
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_streak, longest_streak, last_practice_date")
      .eq("id", userId)
      .single();

    if (profile) {
      const lastPractice = profile.last_practice_date;
      let newStreak = profile.current_streak || 0;

      if (lastPractice === todayStr) {
        // Already practiced today — no streak change
      } else {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastPractice === yesterdayStr) {
          // Consecutive day — increment streak
          newStreak += 1;
        } else {
          // Streak broken — reset to 1
          newStreak = 1;
        }

        await supabase
          .from("profiles")
          .update({
            current_streak: newStreak,
            longest_streak: Math.max(newStreak, profile.longest_streak || 0),
            last_practice_date: todayStr,
          })
          .eq("id", userId);
      }
    }
  } catch (e) {
    // Non-critical: don't let streak tracking break the review flow
    console.error("Error updating streak:", e);
  }
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
