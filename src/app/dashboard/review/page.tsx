import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReviewSession } from "./ReviewSession";

export default async function ReviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch due items
  const { data: dueItems } = await supabase
    .from("item_scheduling_state")
    .select('*')
    .eq("user_id", user.id)
    .eq("item_type", "flashcard")
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(50);

  const itemIds = dueItems?.map(d => d.item_id) || [];
  
  let validDueItems: any[] = [];

  if (itemIds.length > 0) {
    const { data: flashcards } = await supabase
      .from("flashcards")
      .select('id, front, back, card_type, cascade_content, module')
      .in('id', itemIds);

    validDueItems = (dueItems || []).map(item => {
      const flashcard = flashcards?.find(fc => fc.id === item.item_id);
      return {
        schedule: { id: item.id, ease_factor: item.ease_factor, interval_days: item.interval_days, repetition_count: item.repetition_count },
        flashcard
      };
    }).filter(item => item.flashcard);
  }

  return (
    <div>
      <div style={{ marginBottom: "var(--space-2xl)" }}>
        <h1>Daily Review</h1>
        <p className="text-muted">Master your material with active recall.</p>
      </div>

      {validDueItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-3xl)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}>
          <h2>🎉 You're all caught up!</h2>
          <p className="text-muted">No flashcards due for review right now. Go back to the library and read more notes to generate cards.</p>
          <a href="/dashboard" className="btn btn-primary" style={{ marginTop: "var(--space-lg)", display: "inline-block" }}>
            Return to Library
          </a>
        </div>
      ) : (
        <ReviewSession initialItems={validDueItems} />
      )}
    </div>
  );
}
