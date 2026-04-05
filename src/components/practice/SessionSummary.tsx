"use client";

import Link from "next/link";
import type { Classification } from "./ClassificationButtons";
import styles from "./SessionSummary.module.css";

interface SessionSummaryProps {
  moduleName: string;
  topicName: string;
  totalItems: number;
  results: Classification[];
  startTime: number;
}

export function SessionSummary({
  moduleName,
  topicName,
  totalItems,
  results,
  startTime,
}: SessionSummaryProps) {
  const confident = results.filter((r) => r === "confident").length;
  const guessed = results.filter((r) => r === "guessed").length;
  const partial = results.filter((r) => r === "partial").length;
  const incorrect = results.filter((r) => r === "incorrect").length;

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  const accuracy = totalItems > 0
    ? Math.round(((confident + guessed) / totalItems) * 100)
    : 0;

  const practiceUrl = `/dashboard/practice/${encodeURIComponent(moduleName)}/${encodeURIComponent(topicName)}`;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Session Complete</h1>
        <p className="text-muted mono">
          {moduleName} › {topicName}
        </p>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{totalItems}</span>
          <span className={styles.statLabel}>Items</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{accuracy}%</span>
          <span className={styles.statLabel}>Accuracy</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
          <span className={styles.statLabel}>Duration</span>
        </div>
      </div>

      {/* Classification Breakdown */}
      <div className={styles.breakdown}>
        <h3>Breakdown</h3>
        <div className={styles.bars}>
          {[
            { label: "Confident", count: confident, color: "var(--classify-confident)" },
            { label: "Guessed", count: guessed, color: "var(--classify-guessed)" },
            { label: "Partial", count: partial, color: "var(--classify-partial)" },
            { label: "Incorrect", count: incorrect, color: "var(--classify-incorrect)" },
          ].map((item) => (
            <div key={item.label} className={styles.barRow}>
              <span className={styles.barLabel}>{item.label}</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: totalItems > 0 ? `${(item.count / totalItems) * 100}%` : "0%",
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <span className={styles.barCount}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <Link href={practiceUrl} className="btn btn-primary btn-lg">
          Practice Again
        </Link>
        <Link href="/dashboard" className="btn btn-secondary btn-lg">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
