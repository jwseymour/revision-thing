import Link from "next/link";
import { getMasteryLevel } from "@/lib/mastery";
import styles from "./WeakTopicsList.module.css";

interface WeakTopic {
  moduleName: string;
  topicName: string;
  score: number;
  totalItems: number;
}

interface WeakTopicsListProps {
  topics: WeakTopic[];
  limit?: number;
}

export function WeakTopicsList({ topics, limit = 8 }: WeakTopicsListProps) {
  const sorted = [...topics].sort((a, b) => a.score - b.score).slice(0, limit);

  if (sorted.length === 0) return null;

  return (
    <div className={styles.container}>
      {sorted.map((t) => {
        const level = getMasteryLevel(t.score);
        return (
          <div key={`${t.moduleName}-${t.topicName}`} className={styles.row}>
            <div className={styles.info}>
              <span className={styles.topic}>{t.topicName}</span>
              <span className={styles.module}>{t.moduleName}</span>
            </div>
            <span className={styles.score} style={{ color: level.color }}>
              {level.label} ({t.score}%)
            </span>
            <Link
              href={`/dashboard/practice/${encodeURIComponent(t.moduleName)}/${encodeURIComponent(t.topicName)}`}
              className="btn btn-primary btn-sm"
            >
              Practice
            </Link>
          </div>
        );
      })}
    </div>
  );
}
