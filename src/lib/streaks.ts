import { SupabaseClient } from "@supabase/supabase-js";

export async function processStreak(supabase: SupabaseClient, userId: string) {
  // Get current profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("current_streak, longest_streak, last_practice_date")
    .eq("id", userId)
    .single();

  if (error || !profile) return;

  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
  const lastPractice = profile.last_practice_date;

  if (lastPractice === today) {
    // Already practiced today, do nothing.
    return profile.current_streak;
  }

  let newStreak = profile.current_streak;

  if (!lastPractice) {
    // First ever practice
    newStreak = 1;
  } else {
    // Check if last practice was exactly yesterday
    const lastDate = new Date(lastPractice);
    const currDate = new Date(today);
    const diffTime = Math.abs(currDate.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      newStreak += 1;
    } else {
      newStreak = 1; // Streak broken
    }
  }

  const newLongest = Math.max(newStreak, profile.longest_streak);

  // Update profile
  await supabase
    .from("profiles")
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_practice_date: today,
    })
    .eq("id", userId);

  return newStreak;
}
