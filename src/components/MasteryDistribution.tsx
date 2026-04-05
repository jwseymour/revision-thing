import { getMasteryLevel } from "@/lib/mastery";
import styles from "./MasteryDistribution.module.css";

interface MasteryDistributionProps {
  scores: number[];
}

export function MasteryDistribution({ scores }: MasteryDistributionProps) {
  const buckets = [
    { label: "Unseen", range: "0-20", color: "#5e574f", count: 0 },
    { label: "Fragile", range: "21-40", color: "#d97a7a", count: 0 },
    { label: "Developing", range: "41-60", color: "#e5a84b", count: 0 },
    { label: "Solid", range: "61-80", color: "#7aaed4", count: 0 },
    { label: "Exam-Ready", range: "81-100", color: "#7bc47f", count: 0 },
  ];

  scores.forEach((s) => {
    const level = getMasteryLevel(s);
    const bucket = buckets.find((b) => b.label === level.label);
    if (bucket) bucket.count++;
  });

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className={styles.container}>
      <div className={styles.chart}>
        {buckets.map((bucket) => (
          <div key={bucket.label} className={styles.column}>
            <span className={styles.count}>{bucket.count}</span>
            <div className={styles.barWrapper}>
              <div
                className={styles.bar}
                style={{
                  height: `${(bucket.count / maxCount) * 100}%`,
                  backgroundColor: bucket.color,
                }}
              />
            </div>
            <span className={styles.label}>{bucket.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
