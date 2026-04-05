import { getMasteryColor } from "@/lib/mastery";
import Link from "next/link";
import styles from "./MasteryHeatmap.module.css";

interface TopicCell {
  moduleName: string;
  topicName: string;
  score: number;
}

interface MasteryHeatmapProps {
  topics: TopicCell[];
}

export function MasteryHeatmap({ topics }: MasteryHeatmapProps) {
  if (topics.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {topics.map((t) => (
          <Link
            key={`${t.moduleName}-${t.topicName}`}
            href={`/dashboard/practice/${encodeURIComponent(t.moduleName)}/${encodeURIComponent(t.topicName)}`}
            className={styles.cell}
            style={{ backgroundColor: getMasteryColor(t.score) }}
            title={`${t.topicName} (${t.moduleName}) — ${t.score}%`}
          >
            <span className={styles.cellLabel}>{t.topicName}</span>
          </Link>
        ))}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#5e574f" }} />
          Unseen
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#d97a7a" }} />
          Fragile
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#e5a84b" }} />
          Developing
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#7aaed4" }} />
          Solid
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#7bc47f" }} />
          Exam-Ready
        </span>
      </div>
    </div>
  );
}
