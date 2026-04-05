"use client";

import styles from "./ClassificationButtons.module.css";

export type Classification = "confident" | "guessed" | "partial" | "incorrect";

interface ClassificationButtonsProps {
  onClassify: (classification: Classification) => void;
  disabled?: boolean;
}

const CLASSIFICATIONS: {
  id: Classification;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "confident",
    label: "Correct",
    description: "Knew it confidently",
    icon: "✅",
  },
  {
    id: "guessed",
    label: "Correct (Guessed)",
    description: "Got it right, but wasn't sure",
    icon: "🟡",
  },
  {
    id: "partial",
    label: "Partial",
    description: "Knew some of it, not all",
    icon: "🟠",
  },
  {
    id: "incorrect",
    label: "Incorrect",
    description: "Got it wrong or didn't know",
    icon: "❌",
  },
];

export function ClassificationButtons({
  onClassify,
  disabled = false,
}: ClassificationButtonsProps) {
  return (
    <div className={styles.container}>
      <p className={styles.prompt}>How did you do?</p>
      <div className={styles.buttons}>
        {CLASSIFICATIONS.map((c) => (
          <button
            key={c.id}
            className={`${styles.button} ${styles[c.id]}`}
            onClick={() => onClassify(c.id)}
            disabled={disabled}
          >
            <span className={styles.icon}>{c.icon}</span>
            <span className={styles.label}>{c.label}</span>
            <span className={styles.description}>{c.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
