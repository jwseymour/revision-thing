import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MasteryHeatmap } from "@/components/MasteryHeatmap";
import { MasteryDistribution } from "@/components/MasteryDistribution";
import { WeakTopicsList } from "@/components/WeakTopicsList";
import { RecentActivity } from "@/components/RecentActivity";
import styles from "./progress.module.css";

export default async function ProgressPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch all mastery scores
  const { data: masteryScores } = await supabase
    .from("mastery_scores")
    .select("module, topic, score, updated_at")
    .eq("user_id", user.id);

  // Fetch attempt count
  const { count: totalAttempts } = await supabase
    .from("attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Fetch flashcard + question counts per topic for item counts
  const { data: flashcards } = await supabase
    .from("flashcards")
    .select("module, topic")
    .eq("user_id", user.id);

  const { data: questions } = await supabase
    .from("questions")
    .select("module, topic")
    .eq("user_id", user.id);

  // Fetch recent attempts
  const { data: recentAttempts } = await supabase
    .from("attempts")
    .select("id, item_type, module, topic, classification, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(15);

  // Build topic data
  const topicItemCounts = new Map<string, number>();
  flashcards?.forEach((fc) => {
    const key = `${fc.module}::${fc.topic}`;
    topicItemCounts.set(key, (topicItemCounts.get(key) || 0) + 1);
  });
  questions?.forEach((q) => {
    const key = `${q.module}::${q.topic}`;
    topicItemCounts.set(key, (topicItemCounts.get(key) || 0) + 1);
  });

  // Get all known topics (from content + mastery)
  const allTopicKeys = new Set<string>();
  topicItemCounts.forEach((_, key) => allTopicKeys.add(key));
  masteryScores?.forEach((ms) => allTopicKeys.add(`${ms.module}::${ms.topic}`));

  const topicData = Array.from(allTopicKeys).map((key) => {
    const [moduleName, topicName] = key.split("::");
    const mastery = masteryScores?.find(
      (ms) => ms.module === moduleName && ms.topic === topicName
    );
    return {
      moduleName,
      topicName,
      score: mastery?.score ?? 0,
      totalItems: topicItemCounts.get(key) || 0,
    };
  });

  const scores = topicData.map((t) => t.score);
  const overallMastery =
    scores.length > 0
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : 0;

  const modules = [...new Set(topicData.map((t) => t.moduleName))].sort();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Progress</h1>
        <p className="text-muted">Your revision command centre</p>
      </div>

      {/* Summary stats */}
      <div className={styles.statsRow}>
        <div className={`card ${styles.stat}`}>
          <span className={styles.statValue}>{overallMastery}%</span>
          <span className={styles.statLabel}>Overall Mastery</span>
        </div>
        <div className={`card ${styles.stat}`}>
          <span className={styles.statValue}>{topicData.length}</span>
          <span className={styles.statLabel}>Topics</span>
        </div>
        <div className={`card ${styles.stat}`}>
          <span className={styles.statValue}>{modules.length}</span>
          <span className={styles.statLabel}>Modules</span>
        </div>
        <div className={`card ${styles.stat}`}>
          <span className={styles.statValue}>{totalAttempts ?? 0}</span>
          <span className={styles.statLabel}>Attempts</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className={styles.grid}>
        {/* Left: Heatmap + Distribution */}
        <div className={styles.column}>
          <div className={styles.section}>
            <h2>Mastery Heatmap</h2>
            {topicData.length > 0 ? (
              <MasteryHeatmap topics={topicData} />
            ) : (
              <p className="text-muted text-sm">No topics yet. Upload PDFs and generate content to see your mastery map.</p>
            )}
          </div>

          <div className={styles.section}>
            <h2>Distribution</h2>
            <MasteryDistribution scores={scores} />
          </div>
        </div>

        {/* Right: Weak topics + Recent activity */}
        <div className={styles.column}>
          <div className={styles.section}>
            <h2>Weakest Topics</h2>
            {topicData.length > 0 ? (
              <WeakTopicsList topics={topicData} limit={6} />
            ) : (
              <p className="text-muted text-sm">Practice some topics to see your weakest areas here.</p>
            )}
          </div>

          <div className={styles.section}>
            <h2>Recent Activity</h2>
            <div className={`card ${styles.activityCard}`}>
              <RecentActivity attempts={recentAttempts || []} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
