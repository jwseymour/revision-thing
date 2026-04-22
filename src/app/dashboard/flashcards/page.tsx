import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FlashcardsClientView } from "./FlashcardsClientView";

export const metadata = {
  title: 'Flashcards Library | tripos',
}

export default async function FlashcardsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all flashcards for user joined with resources
  const { data: flashcards, error } = await supabase
    .from("flashcards")
    .select(`
      *,
      resources ( part, paper, module )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching flashcards:", error);
  }

  // Fetch scheduling states separately since it is a polymorphic relation (no FK)
  const { data: schedules } = await supabase
    .from("item_scheduling_state")
    .select("item_id, stability, difficulty, reps, scheduled_days, next_review_at")
    .eq("user_id", user.id)
    .eq("item_type", "flashcard");

  // Merge them manually
  const mergedFlashcards = (flashcards || []).map(fc => {
    const state = schedules?.find(s => s.item_id === fc.id);
    return {
      ...fc,
      item_scheduling_state: state ? [state] : []
    };
  });

  return <FlashcardsClientView flashcards={mergedFlashcards} />;
}
