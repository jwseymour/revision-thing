"use client";

import { useState, useMemo } from "react";
import styles from "./FlashcardLibrary.module.css";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  module: string;
  card_type: string;
  resources: { part: string; paper: string; module: string };
  item_scheduling_state: { ease_factor: number; next_review_at: string }[];
}

export function FlashcardLibrary({ initialCards }: { initialCards: Flashcard[] }) {
  const [activeModule, setActiveModule] = useState<string>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build Hierarchy: Part -> Paper -> Module
  const hierarchy = useMemo(() => {
    const tree: any = {};
    initialCards.forEach(c => {
      const part = c.resources?.part || "Unknown Part";
      const paper = c.resources?.paper || "Unknown Paper";
      const mod = c.module;
      
      if (!tree[part]) tree[part] = {};
      if (!tree[part][paper]) tree[part][paper] = new Set();
      tree[part][paper].add(mod);
    });
    return tree;
  }, [initialCards]);

  const filteredCards = initialCards.filter(
    (c) => activeModule === "All" || c.module === activeModule
  );

  const handlePracticeLink = `/dashboard/flashcards/practice/${encodeURIComponent(activeModule)}`;

  if (initialCards.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-3xl)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}>
        <h2>No flashcards yet</h2>
        <p className="text-muted">Go to your library and read some notes to generate flashcards.</p>
        <a href="/dashboard" className="btn btn-primary mt-4 display-inline-block">Go to Library</a>
      </div>
    );
  }

  // Recursive-like rendering for hierarchy
  const renderTree = () => {
    return (
      <div className={styles.treeNode}>
        <div 
          className={`${styles.treeLabel} ${activeModule === "All" ? styles.treeLabelActive : ""}`}
          onClick={() => setActiveModule("All")}
        >
          📂 All Modules
        </div>
        {Object.entries(hierarchy).map(([part, papers]: any) => (
          <div key={part} className={styles.treeNode}>
            <div className={styles.treeLabel}>📚 {part}</div>
            <div className={styles.treeChildren}>
              {Object.entries(papers).map(([paper, modules]: any) => (
                <div key={paper} className={styles.treeNode}>
                  <div className={styles.treeLabel}>📄 {paper}</div>
                  <div className={styles.treeChildren}>
                    {Array.from(modules as Set<string>).map((mod: string) => (
                      <div 
                        key={mod}
                        className={`${styles.treeLabel} ${activeModule === mod ? styles.treeLabelActive : ""}`}
                        onClick={() => setActiveModule(mod)}
                      >
                        📁 {mod}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <h3 style={{ marginBottom: "var(--space-md)", fontSize: "var(--font-size-md)" }}>Hierarchy</h3>
        {renderTree()}
      </aside>

      <main className={styles.mainPane}>
        {activeModule !== "All" && (
          <div className={styles.practiceHeader}>
            <div>
              <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>{activeModule}</h2>
              <p className="text-muted text-sm" style={{ margin: 0 }}>
                {filteredCards.length} flashcards inside this module.
              </p>
            </div>
            <a href={handlePracticeLink} className="btn btn-primary">
              Practice Module
            </a>
          </div>
        )}

        <div className={styles.grid}>
        {filteredCards.map((card) => {
          const isExpanded = expandedId === card.id;
          const schedule = card.item_scheduling_state?.[0];
          
          let easeColor = "var(--text-tertiary)";
          if (schedule) {
            if (schedule.ease_factor >= 2.5) easeColor = "var(--status-success)";
            else if (schedule.ease_factor < 2) easeColor = "var(--status-error)";
            else easeColor = "var(--status-warning)";
          }

          return (
            <div 
              key={card.id} 
              className={`${styles.card} ${isExpanded ? styles.expanded : ""}`}
              onClick={() => setExpandedId(isExpanded ? null : card.id)}
            >
              <div className={styles.cardHeader}>
                <span className={styles.typeTag}>{card.card_type}</span>
                <span className={styles.statusDot} style={{ background: easeColor }} title={schedule ? `Ease: ${schedule.ease_factor.toFixed(1)}` : "Unseen"} />
              </div>
              <h3 className={styles.cardFront}>{card.front}</h3>
              
              <div className={styles.cardBack}>
                 <hr className={styles.divider} />
                 {card.back}
              </div>
            </div>
          );
        })}
        </div>
      </main>
    </div>
  );
}
