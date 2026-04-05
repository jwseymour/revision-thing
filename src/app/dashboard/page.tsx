import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MasteryBar } from "@/components/MasteryBar";
import { RecentActivity } from "@/components/RecentActivity";
import styles from "./page.module.css";

const MASTERY_LABELS = [
  { min: 0, max: 20, label: "Unseen" },
  { min: 21, max: 40, label: "Fragile" },
  { min: 41, max: 60, label: "Developing" },
  { min: 61, max: 80, label: "Solid" },
  { min: 81, max: 100, label: "Exam-Ready" },
];

function masteryLabel(value: number): string {
  return (MASTERY_LABELS.find((l) => value >= l.min && value <= l.max) || MASTERY_LABELS[0]).label;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Student";

  // Fetch counts
  const { count: resourceCount } = await supabase
    .from("resources")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: flashcardCount } = await supabase
    .from("flashcards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: questionCount } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: totalAttempts } = await supabase
    .from("attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Fetch recent attempts
  const { data: recentAttempts } = await supabase
    .from("attempts")
    .select("id, item_type, module, topic, classification, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch modules for overview
  const { data: flashcardModules } = await supabase
    .from("flashcards")
    .select("module")
    .eq("user_id", user.id);

  const { data: masteryScores } = await supabase
    .from("mastery_scores")
    .select("module, topic, score")
    .eq("user_id", user.id);

  // Aggregate module masteries
  const moduleNames = new Set<string>();
  flashcardModules?.forEach((fc) => moduleNames.add(fc.module));

  const moduleMasteries: { name: string; mastery: number }[] = [];
  moduleNames.forEach((name) => {
    const scores = masteryScores?.filter((ms) => ms.module === name) || [];
    const avg = scores.length > 0
      ? Math.round(scores.reduce((s, m) => s + m.score, 0) / scores.length)
      : 0;
    moduleMasteries.push({ name, mastery: avg });
  });

  // Find weakest module
  const weakest = moduleMasteries.length > 0
    ? moduleMasteries.reduce((min, m) => (m.mastery < min.mastery ? m : min))
    : null;

  return (
    <div className={styles.dashboard}>
      {/* Welcome */}
      <div className={styles.welcome}>
        <h1>
          Welcome back, <span className="accent-text">{displayName}</span>
        </h1>
        <p className="text-muted">
          {(totalAttempts ?? 0) > 0
            ? `You've completed ${totalAttempts} practice attempts.`
            : "Ready to start revising? Upload some PDFs to get started."}
        </p>
      </div>

      {/* Stats Grid */}
      <div className={styles["stats-grid"]}>
        <div className={`card ${styles["stat-card"]}`}>
          <div className={styles["stat-value"]}>{resourceCount ?? 0}</div>
          <div className={styles["stat-label"]}>Resources</div>
        </div>
        <div className={`card ${styles["stat-card"]}`}>
          <div className={styles["stat-value"]}>{flashcardCount ?? 0}</div>
          <div className={styles["stat-label"]}>Flashcards</div>
        </div>
        <div className={`card ${styles["stat-card"]}`}>
          <div className={styles["stat-value"]}>{questionCount ?? 0}</div>
          <div className={styles["stat-label"]}>Questions</div>
        </div>
        <div className={`card ${styles["stat-card"]}`}>
          <div className={styles["stat-value"]}>{totalAttempts ?? 0}</div>
          <div className={styles["stat-label"]}>Attempts</div>
        </div>
      </div>

      {/* Quick Start */}
      <div className={styles.section}>
        <h2>Quick Start</h2>
        <div className={styles["action-grid"]}>
          {weakest ? (
            <Link
              href={`/dashboard/modules/${encodeURIComponent(weakest.name)}`}
              className={`card card-hover ${styles["action-card"]}`}
            >
              <span className={styles["action-icon"]}>🎯</span>
              <h3>Your weakest module</h3>
              <p className="text-muted text-sm">
                {weakest.name} — {masteryLabel(weakest.mastery)} ({weakest.mastery}%)
              </p>
            </Link>
          ) : (
            <Link
              href="/dashboard/upload"
              className={`card card-hover ${styles["action-card"]}`}
            >
              <span className={styles["action-icon"]}>📄</span>
              <h3>Upload PDFs</h3>
              <p className="text-muted text-sm">Get started by uploading lecture notes</p>
            </Link>
          )}
          <Link
            href="/dashboard/modules"
            className={`card card-hover ${styles["action-card"]}`}
          >
            <span className={styles["action-icon"]}>📚</span>
            <h3>Browse Modules</h3>
            <p className="text-muted text-sm">Explore your revision content</p>
          </Link>
          <Link
            href="/dashboard/resources"
            className={`card card-hover ${styles["action-card"]}`}
          >
            <span className={styles["action-icon"]}>📂</span>
            <h3>Manage Resources</h3>
            <p className="text-muted text-sm">View and manage uploaded files</p>
          </Link>
        </div>
      </div>

      {/* Module Mastery */}
      {moduleMasteries.length > 0 && (
        <div className={styles.section}>
          <h2>Module Mastery</h2>
          <div className={styles.masteryList}>
            {moduleMasteries
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((mod) => (
                <Link
                  key={mod.name}
                  href={`/dashboard/modules/${encodeURIComponent(mod.name)}`}
                  className={styles.masteryItem}
                >
                  <span className={styles.masteryModuleName}>{mod.name}</span>
                  <div className={styles.masteryBarWrapper}>
                    <MasteryBar value={mod.mastery} size="sm" showLabel={false} />
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className={styles.section}>
        <h2>Recent Activity</h2>
        <div className={`card ${styles.activityCard}`}>
          <RecentActivity attempts={recentAttempts || []} />
        </div>
      </div>
    </div>
  );
}
