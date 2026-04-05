import styles from "./RecentActivity.module.css";

interface AttemptRecord {
  id: string;
  item_type: string;
  module: string;
  topic: string;
  classification: string;
  created_at: string;
}

interface RecentActivityProps {
  attempts: AttemptRecord[];
}

const CLASSIFICATION_CONFIG: Record<string, { icon: string; label: string }> = {
  confident: { icon: "✅", label: "Confident" },
  guessed: { icon: "🟡", label: "Guessed" },
  partial: { icon: "🟠", label: "Partial" },
  incorrect: { icon: "❌", label: "Incorrect" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMins = Math.floor((now - then) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const hrs = Math.floor(diffMins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function RecentActivity({ attempts }: RecentActivityProps) {
  if (attempts.length === 0) {
    return (
      <p className="text-muted text-sm" style={{ textAlign: "center", padding: "var(--space-lg)" }}>
        No practice activity yet.
      </p>
    );
  }

  return (
    <div className={styles.container}>
      {attempts.map((a) => {
        const config = CLASSIFICATION_CONFIG[a.classification] || { icon: "•", label: a.classification };
        return (
          <div key={a.id} className={styles.item}>
            <span className={styles.icon}>{config.icon}</span>
            <div className={styles.info}>
              <span className={styles.topic}>{a.topic}</span>
              <span className={styles.meta}>
                {a.module} • {a.item_type}
              </span>
            </div>
            <span className={styles.time}>{timeAgo(a.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
