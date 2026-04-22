import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReviewSession } from "@/app/dashboard/review/ReviewSession";
import { DynamicSplitView } from "@/components/DynamicSplitView";
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
    
    validItems = flashcards.map(flashcard => {
      const schedule = schedules?.find(s => s.item_id === flashcard.id);
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
           next_review_at: schedule.next_review_at 
        } : {
           id: "new",
           stability: 0,
           difficulty: 0,
           elapsed_days: 0,
           scheduled_days: 0,
           reps: 0,
           lapses: 0,
           state: 0,
           next_review_at: new Date().toISOString()
        },
        flashcard
      };
    });

    // Sort by due date
    validItems.sort((a, b) => new Date(a.schedule.next_review_at).getTime() - new Date(b.schedule.next_review_at).getTime());
  }

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <DynamicSplitView moduleName={moduleName}>
        <div style={{ padding: "var(--space-2xl)", width: "100%", maxWidth: "100%", margin: "0 auto", height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: "var(--space-2xl)", flexShrink: 0 }}>
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
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
               <ReviewSession initialItems={validItems} />
            </div>
          )}
        </div>
      </DynamicSplitView>
    </div>
  );
}
