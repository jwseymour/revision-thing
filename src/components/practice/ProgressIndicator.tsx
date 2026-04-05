"use client";

import styles from "./ProgressIndicator.module.css";

interface ProgressIndicatorProps {
  current: number;
  total: number;
}

export function ProgressIndicator({ current, total }: ProgressIndicatorProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={styles.container}>
      <span className={styles.text}>
        {current} of {total}
      </span>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
