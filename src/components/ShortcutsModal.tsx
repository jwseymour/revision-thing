"use client";

import { useState, useEffect } from "react";
import styles from "./ShortcutsModal.module.css";

const SHORTCUT_GROUPS = [
  {
    title: "Global Navigation",
    shortcuts: [
      { desc: "Daily Review", keys: ["Shift", "R"] },
      { desc: "Analytics", keys: ["Shift", "A"] },
      { desc: "Notes & Papers", keys: ["Shift", "N"] },
      { desc: "Module Flashcards", keys: ["Shift", "F"] },
      { desc: "AI Supervisor", keys: ["Shift", "S"] },
    ],
  },
  {
    title: "Active Reading",
    shortcuts: [
      { desc: "Generate Flashcard (from selection)", keys: ["⌘/Ctrl", "E"] },
      { desc: "Add Comment (from selection)", keys: ["⌘/Ctrl", "M"] },
      { desc: "Confirm Flashcard Generation", keys: ["⌘/Ctrl", "Enter"] },
      { desc: "Toggle AI Supervisor Panel", keys: ["⌘/Ctrl", "."] },
    ],
  },
  {
    title: "Flashcard Practice",
    shortcuts: [
      { desc: "Show Answer / Next Step", keys: ["Space"] },
      { desc: "Grade: Again", keys: ["1"] },
      { desc: "Grade: Hard", keys: ["2"] },
      { desc: "Grade: Good", keys: ["3"] },
      { desc: "Grade: Easy", keys: ["4"] },
    ],
  },
  {
    title: "System",
    shortcuts: [
      { desc: "Keyboard Shortcuts", keys: ["⌘/Ctrl", "/"] },
    ],
  },
];

export function ShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("toggle-shortcuts-modal", handleToggle);
    window.addEventListener("keydown", handleEsc);
    
    return () => {
      window.removeEventListener("toggle-shortcuts-modal", handleToggle);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => setIsOpen(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Keyboard Shortcuts</h2>
          <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
            ✕
          </button>
        </div>
        <div className={styles.content}>
          {SHORTCUT_GROUPS.map((group, idx) => (
            <div key={idx} className={styles.section}>
              <h3>{group.title}</h3>
              {group.shortcuts.map((sc, sIdx) => (
                <div key={sIdx} className={styles.shortcutRow}>
                  <span className={styles.shortcutDesc}>{sc.desc}</span>
                  <div className={styles.keys}>
                    {sc.keys.map((k, kIdx) => (
                      <kbd key={kIdx} className={styles.key}>{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
