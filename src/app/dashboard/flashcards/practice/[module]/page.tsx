import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReviewSession } from "@/app/dashboard/review/ReviewSession";
import Link from "next/link";

interface PageProps {
  params: {
    module: string;
  };
}

export default async function PracticeModulePage({ params }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const moduleName = decodeURIComponent(params.module);

  // 1. Fetch flashcards strictly for this module
  const { data: flashcards } = await supabase
    .from("flashcards")
    .select("id, front, back, card_type, cascade_content, module")
    .eq("user_id", user.id)
    .eq("module", moduleName);

  const flashcardIds = flashcards?.map((fc) => fc.id) || [];

  let validItems: any[] = [];

  if (flashcardIds.length > 0) {
    // 2. Fetch their scheduling states
    const { data: schedules } = await supabase
      .from("item_scheduling_state")
      .select("*")
      .eq("user_id", user.id)
      .in("item_id", flashcardIds);

    // Filter to those due or near due to encourage practice mode (or we can just allow everything)
    // For "Practice Mode" per module, it feels best to prioritize due items, but if none are due, show all.
    // Let's sort them so due items appear first.
    
    validItems = (schedules || []).map(schedule => {
      const flashcard = flashcards?.find(fc => fc.id === schedule.item_id);
      return {
        schedule: { id: schedule.id, ease_factor: schedule.ease_factor, interval_days: schedule.interval_days, repetition_count: schedule.repetition_count, next_review_at: schedule.next_review_at },
        flashcard
      };
    }).filter(item => item.flashcard);

    // Sort by due date
    validItems.sort((a, b) => new Date(a.schedule.next_review_at).getTime() - new Date(b.schedule.next_review_at).getTime());
  }

  return (
    <div className="page-content" style={{ padding: "var(--space-2xl)", maxWidth: "var(--max-content-width)", margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--space-2xl)" }}>
        <Link href="/dashboard/flashcards" className="btn btn-ghost btn-sm" style={{ marginBottom: "var(--space-md)", display: "inline-block" }}>
          ← Back to Library
        </Link>
        <h1>Practice: {moduleName}</h1>
        <p className="text-muted">Master your material with active recall.</p>
      </div>

      {validItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-3xl)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}>
          <h2>No flashcards found</h2>
          <p className="text-muted">There are no flashcards available to practice for this module yet.</p>
          <Link href="/dashboard/flashcards" className="btn btn-primary" style={{ marginTop: "var(--space-lg)", display: "inline-block" }}>
            Return to Library
          </Link>
        </div>
      ) : (
        <ReviewSession initialItems={validItems} />
      )}
    </div>
  );
}
