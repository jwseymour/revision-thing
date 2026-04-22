import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getModulePriorities, type ModulePriority } from "@/lib/scheduling";
import { getMasteryColor } from "@/lib/mastery";
import Link from "next/link";
import styles from "./review.module.css";

export default async function ReviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const priorities = await getModulePriorities(supabase, user.id);

  const totalDue = priorities.reduce((sum, m) => sum + m.dueCount, 0);
  const totalRecommended = priorities.reduce((sum, m) => sum + m.recommendedCount, 0);
  const totalMinutes = priorities.reduce((sum, m) => sum + m.estimatedMinutes, 0);

  // Separate into modules with due cards and modules without
  const dueModules = priorities.filter(m => m.dueCount > 0);
  const reinforceModules = priorities.filter(m => m.dueCount === 0);

  return (
    <div className={styles.reviewPage}>
      <div className={styles.header}>
        <h1>Daily Review</h1>
        <p className="text-muted">Modules ranked by priority — lowest confidence and most overdue first.</p>

        {priorities.length > 0 && (
          <div className={styles.headerMeta}>
            <span className={styles.totalTime}>
              ⏱ ~{totalMinutes} min recommended
            </span>
            <span className={styles.totalDue}>
              {totalDue > 0
                ? `${totalDue} card${totalDue !== 1 ? "s" : ""} due · ${totalRecommended} recommended total`
                : `${totalRecommended} cards recommended across ${priorities.length} module${priorities.length !== 1 ? "s" : ""}`
              }
            </span>
          </div>
        )}
      </div>

      {priorities.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📚</span>
          <h2>No flashcards yet</h2>
          <p className="text-muted">Go to the library, read some notes, and generate flashcards to get started.</p>
          <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: "var(--space-lg)", display: "inline-block" }}>
            Go to Library
          </Link>
        </div>
      ) : (
        <>
          {/* Due Modules — Primary Focus */}
          {dueModules.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionLabel}>
                <span className={styles.sectionDot} style={{ backgroundColor: "var(--status-warning)" }} />
                Due for Review
              </h2>
              <div className={styles.moduleList}>
                {dueModules.map((mod, index) => (
                  <ModuleCard key={mod.module} mod={mod} rank={index + 1} />
                ))}
              </div>
            </div>
          )}

          {/* Reinforcement Modules — Nothing due, but practice is still valuable */}
          {reinforceModules.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionLabel}>
                <span className={styles.sectionDot} style={{ backgroundColor: "var(--status-success)" }} />
                {dueModules.length > 0 ? "Continue Practising" : "Practice & Reinforce"}
              </h2>
              <p className="text-muted text-sm" style={{ marginBottom: "var(--space-md)", marginTop: "-var(--space-sm)" }}>
                Nothing overdue — but reviewing will strengthen long-term retention.
              </p>
              <div className={styles.moduleList}>
                {reinforceModules.map((mod, index) => (
                  <ModuleCard key={mod.module} mod={mod} rank={dueModules.length + index + 1} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ModuleCard({ mod, rank }: { mod: ModulePriority; rank: number }) {
  const rankClass = mod.confidence < 40 ? styles.rankHigh
    : mod.confidence < 70 ? styles.rankMedium
    : styles.rankLow;

  const confidenceColor = getMasteryColor(mod.confidence);

  const lastStudiedLabel = mod.lastStudied
    ? formatTimeAgo(new Date(mod.lastStudied))
    : "Never studied";

  return (
    <div className={styles.moduleCard}>
      <div className={`${styles.rank} ${rankClass}`}>
        {rank}
      </div>

      <div className={styles.moduleInfo}>
        <div className={styles.moduleName}>{mod.module}</div>
        <div className={styles.moduleStats}>
          {mod.dueCount > 0 ? (
            <span className={styles.dueBadge}>
              {mod.dueCount} due
            </span>
          ) : (
            <span className={styles.upToDateBadge}>
              ✓ Up to date
            </span>
          )}
          <span className={styles.statChip}>
            📚 {mod.totalCards} total
          </span>
          <span className={styles.statChip}>
            🕐 {lastStudiedLabel}
          </span>
          <span className={styles.statChip}>
            🎯 {mod.recommendedCount} recommended
          </span>
        </div>
        <div className={styles.confidenceBar}>
          <div className={styles.confidenceTrack}>
            <div
              className={styles.confidenceFill}
              style={{
                width: `${mod.confidence}%`,
                backgroundColor: confidenceColor,
              }}
            />
          </div>
          <span className={styles.confidenceLabel} style={{ color: confidenceColor }}>
            {mod.confidence}%
          </span>
        </div>
      </div>

      <div className={styles.rightCol}>
        <Link
          href={`/dashboard/review/${encodeURIComponent(mod.module)}`}
          className={styles.startBtn}
        >
          {mod.dueCount > 0 ? "Start Review →" : "Practice →"}
        </Link>
        <span className={styles.timeEstimate}>
          ~{mod.estimatedMinutes} min
        </span>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}
