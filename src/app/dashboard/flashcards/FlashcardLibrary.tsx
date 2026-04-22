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
  item_scheduling_state: { stability: number; next_review_at: string }[];
}

export function FlashcardLibrary({ initialCards }: { initialCards: Flashcard[] }) {
  const [cards, setCards] = useState<Flashcard[]>(initialCards);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (cards.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-3xl)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}>
        <h2>No flashcards yet</h2>
        <p className="text-muted">Go to your library and read some notes to generate flashcards.</p>
        <a href="/dashboard" className="btn btn-primary mt-4 display-inline-block">Go to Library</a>
      </div>
    );
  }

  // Active module is assumed uniformly from the cards since they are pre-filtered
  const activeModule = cards[0]?.module || "Unknown Module";
  const handlePracticeLink = `/dashboard/flashcards/practice/${encodeURIComponent(activeModule)}`;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this flashcard?")) return;
    
    setDeletingId(id);
    try {
      const res = await fetch(`/api/content/flashcards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete flashcard.");
      
      setCards(prev => prev.filter(c => c.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error(err);
      alert("Error deleting flashcard");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={styles.layout}>
      <main className={styles.mainPane}>
        <div className={styles.practiceHeader}>
          <div>
            <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>{activeModule}</h2>
            <p className="text-muted text-sm" style={{ margin: 0 }}>
              {cards.length} flashcards inside this module.
            </p>
          </div>
          <a href={handlePracticeLink} className="btn btn-primary">
            Practice Module
          </a>
        </div>

        <div className={styles.grid}>
        {cards.map((card) => {
          const isExpanded = expandedId === card.id;
          const schedule = card.item_scheduling_state?.[0];
          
          let easeColor = "var(--text-tertiary)";
          if (schedule) {
            if (schedule.stability >= 20) easeColor = "var(--status-success)";
            else if (schedule.stability < 5) easeColor = "var(--status-error)";
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
                <span className={styles.statusDot} style={{ background: easeColor }} title={schedule && schedule.stability != null ? `Stability: ${schedule.stability.toFixed(1)}` : "Unseen"} />
              </div>
              <h3 className={styles.cardFront}>{card.front}</h3>
              
              <div className={styles.cardBack}>
                 <hr className={styles.divider} />
                 {card.back}
                 <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                   <button 
                     onClick={(e) => handleDelete(card.id, e)} 
                     className="btn btn-ghost" 
                     style={{ color: 'var(--status-error)', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                     disabled={deletingId === card.id}
                   >
                     {deletingId === card.id ? "Deleting..." : "Delete Card"}
                   </button>
                 </div>
              </div>
            </div>
          );
        })}
        </div>
      </main>
    </div>
  );
}
