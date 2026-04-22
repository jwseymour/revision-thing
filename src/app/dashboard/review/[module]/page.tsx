import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrderedDueCards } from "@/lib/scheduling";
import { ReviewSession } from "../ReviewSession";
import Link from "next/link";

interface PageProps {
  params: Promise<{
    module: string;
  }>;
}

export default async function ModuleReviewPage({ params }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { module: moduleParam } = await params;
  const moduleName = decodeURIComponent(moduleParam);
  const allCards = await getOrderedDueCards(supabase, user.id, moduleName);

  // Count how many are actually due vs not-yet-due
  const dueCount = allCards.filter(c => c.isDue).length;
  
  // Recommended: all due cards + up to 30% of total, capped at 20
  const recommendedCount = Math.min(Math.max(dueCount, Math.ceil(allCards.length * 0.3)), 20);

  return (
    <div style={{ padding: "var(--space-2xl)", maxWidth: "var(--max-content-width)", margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--space-2xl)" }}>
        <Link href="/dashboard/review" className="btn btn-ghost btn-sm" style={{ marginBottom: "var(--space-md)", display: "inline-block" }}>
          ← Back to Review Overview
        </Link>
        <h1>{moduleName}</h1>
        <p className="text-muted">
          {allCards.length} card{allCards.length !== 1 ? "s" : ""} available
          {dueCount > 0 && ` · ${dueCount} due`}
          {" — "}ordered by likelihood of forgetting.
        </p>
        <div style={{
          marginTop: "var(--space-sm)",
          padding: "8px 14px",
          background: "var(--accent-primary-muted)",
          borderRadius: "var(--radius-md)",
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-sm)",
          fontFamily: "var(--font-geist-mono)",
          fontSize: "var(--font-size-sm)",
          color: "var(--accent-primary)",
        }}>
          🎯 Recommended: review {recommendedCount} card{recommendedCount !== 1 ? "s" : ""} this session (~{Math.round(recommendedCount * 1.5)} min)
        </div>
      </div>

      {allCards.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-3xl)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}>
          <h2>No flashcards found</h2>
          <p className="text-muted">This module has no flashcards yet. Generate some from the notes view.</p>
          <Link href="/dashboard/review" className="btn btn-primary" style={{ marginTop: "var(--space-lg)", display: "inline-block" }}>
            Back to Review Overview
          </Link>
        </div>
      ) : (
        <ReviewSession initialItems={allCards} returnUrl="/dashboard/review" recommendedCount={recommendedCount} />
      )}
    </div>
  );
}
