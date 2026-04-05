import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .single();

  const displayName = profile?.display_name || user!.email?.split("@")[0] || "User";

  // Fetch stats
  const { count: totalAttempts } = await supabase
    .from("attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);

  const { data: masteryData } = await supabase
    .from("mastery_scores")
    .select("module, topic, score")
    .eq("user_id", user!.id);

  const { count: totalFlashcards } = await supabase
    .from("flashcards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);

  const { count: totalQuestions } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);

  // Calculate overall mastery
  const avgMastery =
    masteryData && masteryData.length > 0
      ? Math.round(
          masteryData.reduce((sum, m) => sum + m.score, 0) / masteryData.length
        )
      : 0;

  // Get unique modules
  const modules = masteryData
    ? [...new Set(masteryData.map((m) => m.module))]
    : [];

  // Recent attempts
  const { data: recentAttempts } = await supabase
    .from("attempts")
    .select("id, item_type, classification, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className={styles.dashboard}>
      {/* Welcome */}
      <div className={styles.welcome}>
        <h1>
          Welcome back, <span className="accent-text">{displayName}</span>
        </h1>
        <p className="text-muted">
          {totalAttempts
            ? `You've made ${totalAttempts} attempts across ${modules.length} module${modules.length !== 1 ? "s" : ""}.`
            : "Upload your first PDF to get started with revision."}
        </p>
      </div>

      {/* Stats Grid */}
      <div className={styles["stats-grid"]}>
        <div className={`card ${styles["stat-card"]}`}>
          <div className={styles["stat-value"]} style={{ color: "var(--accent-primary)" }}>
            {avgMastery}%
          </div>
          <div className={styles["stat-label"]}>Overall Mastery</div>
        </div>
        <div className={`card ${styles["stat-card"]}`}>
          <div className={styles["stat-value"]} style={{ color: "var(--accent-secondary)" }}>
            {totalAttempts || 0}
          </div>
          <div className={styles["stat-label"]}>Total Attempts</div>
        </div>
        <div className={`card ${styles["stat-card"]}`}>
          <div className={styles["stat-value"]} style={{ color: "var(--accent-warm)" }}>
            {totalFlashcards || 0}
          </div>
          <div className={styles["stat-label"]}>Flashcards</div>
        </div>
        <div className={`card ${styles["stat-card"]}`}>
          <div className={styles["stat-value"]} style={{ color: "var(--status-info)" }}>
            {totalQuestions || 0}
          </div>
          <div className={styles["stat-label"]}>Questions</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.section}>
        <h2>Quick Actions</h2>
        <div className={styles["action-grid"]}>
          <a href="/dashboard/upload" className={`card card-hover ${styles["action-card"]}`}>
            <span className={styles["action-icon"]}>📄</span>
            <h3>Upload PDFs</h3>
            <p className="text-sm text-muted">
              Add lecture slides or notes to generate revision material
            </p>
          </a>
          <a href="/dashboard/modules" className={`card card-hover ${styles["action-card"]}`}>
            <span className={styles["action-icon"]}>📚</span>
            <h3>Browse Modules</h3>
            <p className="text-sm text-muted">
              View your modules and start a practice session
            </p>
          </a>
          <a href="/dashboard/progress" className={`card card-hover ${styles["action-card"]}`}>
            <span className={styles["action-icon"]}>📈</span>
            <h3>View Progress</h3>
            <p className="text-sm text-muted">
              See mastery scores across all topics
            </p>
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      {recentAttempts && recentAttempts.length > 0 && (
        <div className={styles.section}>
          <h2>Recent Activity</h2>
          <div className={styles["activity-list"]}>
            {recentAttempts.map((attempt) => {
              const classColors: Record<string, string> = {
                correct_confident: "var(--classify-confident)",
                correct_guessed: "var(--classify-guessed)",
                partial: "var(--classify-partial)",
                incorrect: "var(--classify-incorrect)",
              };
              const classLabels: Record<string, string> = {
                correct_confident: "Correct (Confident)",
                correct_guessed: "Correct (Guessed)",
                partial: "Partial",
                incorrect: "Incorrect",
              };
              const timeAgo = getTimeAgo(new Date(attempt.created_at));

              return (
                <div key={attempt.id} className={styles["activity-item"]}>
                  <span
                    className={styles["activity-dot"]}
                    style={{ background: classColors[attempt.classification] }}
                  />
                  <span className={styles["activity-text"]}>
                    {classLabels[attempt.classification]} on a {attempt.item_type}
                  </span>
                  <span className={styles["activity-time"]}>{timeAgo}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
