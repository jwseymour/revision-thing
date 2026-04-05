"use client";

import { useState } from "react";
import styles from "./ErrorClassification.module.css";

export type ErrorType = "conceptual" | "misapplication" | "memory" | "careless";

interface ErrorClassificationProps {
  onSubmit: (errorType: ErrorType, notes: string) => void;
}

const ERROR_TYPES: { id: ErrorType; label: string; description: string }[] = [
  { id: "conceptual", label: "Conceptual", description: "Didn't understand the concept" },
  { id: "misapplication", label: "Misapplication", description: "Understood but applied wrong" },
  { id: "memory", label: "Memory", description: "Knew it but couldn't recall" },
  { id: "careless", label: "Careless", description: "Silly mistake or misread" },
];

export function ErrorClassification({ onSubmit }: ErrorClassificationProps) {
  const [selected, setSelected] = useState<ErrorType | null>(null);
  const [notes, setNotes] = useState("");

  return (
    <div className={styles.container}>
      <p className={styles.prompt}>What went wrong?</p>
      <div className={styles.types}>
        {ERROR_TYPES.map((et) => (
          <button
            key={et.id}
            className={`${styles.typeBtn} ${selected === et.id ? styles.selected : ""}`}
            onClick={() => setSelected(et.id)}
          >
            <span className={styles.typeLabel}>{et.label}</span>
            <span className={styles.typeDesc}>{et.description}</span>
          </button>
        ))}
      </div>
      <textarea
        className={styles.notes}
        placeholder="Optional: what will you do differently? (reflection)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
      />
      <button
        className="btn btn-primary"
        disabled={!selected}
        onClick={() => selected && onSubmit(selected, notes)}
      >
        Continue
      </button>
    </div>
  );
}
