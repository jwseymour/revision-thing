import { createClient } from "@/lib/supabase/server";
import { getDueTopics } from "@/lib/scheduling";
import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "./review.module.css";
import { MasteryBar } from "@/components/MasteryBar";

export default async function ReviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const dueTopics = await getDueTopics(supabase, user.id);

  // Fetch mastery scores to display alongside due topics
  const { data: masteryScores } = await supabase
    .from("mastery_scores")
    .select("module, topic, score")
    .eq("user_id", user.id);

  const mergedTopics = dueTopics.map((dt) => {
    const ms = masteryScores?.find((m) => m.module === dt.module && m.topic === dt.topic);
    
    // Calculate days overdue
    const diffMs = Date.now() - new Date(dt.next_review_at).getTime();
    const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    return {
      ...dt,
      mastery: ms?.score ?? 0,
      daysOverdue: Math.max(0, daysOverdue),
    };
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Due Today</h1>
        <p className="text-muted">Topics scheduled for spaced repetition review.</p>
      </div>

      {mergedTopics.length === 0 ? (
        <div className={`card ${styles.emptyState}`}>
          <div className={styles.emptyIcon}>🎉</div>
          <h2>All caught up!</h2>
          <p className="text-muted">You have no pending reviews scheduled for today.</p>
          <Link href="/dashboard/modules" className="btn btn-secondary" style={{ marginTop: "var(--space-md)" }}>
            Browse Modules
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {mergedTopics.map((topic) => (
            <div key={`${topic.module}-${topic.topic}`} className={`card card-hover ${styles.reviewCard}`}>
              <div className={styles.info}>
                <h3 className={styles.topicName}>{topic.topic}</h3>
                <span className={styles.moduleName}>{topic.module}</span>
                
                <div className={styles.meta}>
                  <div className={styles.badgeWrap}>
                    {topic.daysOverdue > 0 ? (
                      <span className="badge badge-danger">{topic.daysOverdue} days overdue</span>
                    ) : (
                      <span className="badge badge-warning">Due today</span>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.masteryCol}>
                <MasteryBar value={topic.mastery} size="sm" />
              </div>

              <div className={styles.actions}>
                <Link
                  href={`/dashboard/practice/${encodeURIComponent(topic.module)}/${encodeURIComponent(topic.topic)}`}
                  className="btn btn-primary"
                >
                  Review Now
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
