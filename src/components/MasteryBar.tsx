"use client";

import { getMasteryLevel } from "@/lib/mastery";
import styles from "./MasteryBar.module.css";

export { getMasteryLevel };

interface MasteryBarProps {
  value: number; // 0-100
  showLabel?: boolean;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
}

export function MasteryBar({
  value,
  showLabel = true,
  showPercentage = true,
  size = "md",
}: MasteryBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const level = getMasteryLevel(clamped);

  return (
    <div className={styles.container}>
      {(showLabel || showPercentage) && (
        <div className={styles.info}>
          {showLabel && (
            <span className={styles.label} style={{ color: level.color }}>
              {level.label}
            </span>
          )}
          {showPercentage && (
            <span className={styles.percentage}>{clamped}%</span>
          )}
        </div>
      )}
      <div className={`${styles.track} ${styles[size]}`}>
        <div
          className={styles.fill}
          style={{
            width: `${clamped}%`,
            backgroundColor: level.color,
          }}
        />
      </div>
    </div>
  );
}
