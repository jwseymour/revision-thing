import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FlashcardLibrary } from "./FlashcardLibrary";

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
    .select("item_id, ease_factor, interval_days, next_review_at")
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

  return (
    <div className="page-content" style={{ padding: "var(--space-2xl)", maxWidth: "var(--max-content-width)", margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--space-2xl)" }}>
        <h1>Flashcards Library</h1>
        <p className="text-muted">Browse, search, and organize all your AI-generated flashcards.</p>
      </div>
      
      <FlashcardLibrary initialCards={mergedFlashcards} />
    </div>
  );
}
