"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateSchedule } from "@/lib/scheduling";
import styles from "./ReviewSession.module.css";

interface ReviewItem {
  schedule: {
    id: string;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    state: number;
    next_review_at: string;
  };
  flashcard: any;
}

interface ReviewSessionProps {
  initialItems: ReviewItem[];
  returnUrl?: string;
  recommendedCount?: number;
}

export function ReviewSession({ initialItems, returnUrl = "/dashboard", recommendedCount }: ReviewSessionProps) {
  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cascadeLevel, setCascadeLevel] = useState(0); 
  const supabase = createClient();

  const currentItem = items[currentIndex];

  if (!currentItem) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-3xl)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}>
        <span style={{ fontSize: "3rem", display: "block", marginBottom: "var(--space-lg)" }}>🎯</span>
        <h2>Session complete!</h2>
        <p className="text-muted" style={{ marginTop: "var(--space-sm)" }}>You reviewed {items.length} card{items.length !== 1 ? "s" : ""}.</p>
        <a href={returnUrl} className="btn btn-primary" style={{ marginTop: "var(--space-lg)", display: "inline-block" }}>
          {returnUrl === "/dashboard/review" ? "Back to Review Overview" : "Back to Library"}
        </a>
      </div>
    );
  }

  const { flashcard, schedule } = currentItem;
  
  // Parse cascade content if Deep Dive
  const cascades = Array.isArray(flashcard.cascade_content) ? flashcard.cascade_content : [];

  async function handleGrade(quality: number) {
    let classification = 'incorrect';
    if (quality === 3) classification = 'partial';
    if (quality === 4) classification = 'correct_guessed';
    if (quality === 5) classification = 'correct_confident';

    // Optimistic update
    setCurrentIndex(idx => idx + 1);
    setIsFlipped(false);
    setCascadeLevel(0);

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Record attempt
      await supabase.from("attempts").insert({
        user_id: user.id,
        item_id: flashcard.id,
        item_type: 'flashcard',
        classification,
      });

      // Update schedule via FSRS
      await updateSchedule(supabase, user.id, flashcard.module, flashcard.id, 'flashcard', classification);
    }
  }

  const handleNextCascade = useCallback(() => {
    if (cascadeLevel < cascades.length) {
      setCascadeLevel(prev => prev + 1);
    }
  }, [cascadeLevel, cascades.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key;
      
      if (!isFlipped) {
        if (key === " " || key === "Enter") {
          e.preventDefault();
          setIsFlipped(true);
        }
      } else {
        if (cascades.length > 0 && cascadeLevel < cascades.length) {
          if (key === " " || key === "Enter") {
            e.preventDefault();
            handleNextCascade();
          }
        } else {
          // All shown, grade keys
          if (key === "1") { e.preventDefault(); handleGrade(1); }
          if (key === "2") { e.preventDefault(); handleGrade(3); }
          if (key === "3") { e.preventDefault(); handleGrade(4); }
          if (key === "4") { e.preventDefault(); handleGrade(5); }
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlipped, cascades.length, cascadeLevel, handleNextCascade]); // handleGrade is stable-ish but not wrapped, omitting it from deps is acceptable here but better to use stable deps if possible. Actually React states are async so we skip adding handleGrade to avoid stale closures, wait: handleGrade is recreated every render so it always has fresh state. Adding handleGrade will just re-attach the event listener every render, which is perfectly safe and ensures fresh closures.


  return (
    <div className={styles.container}>
      <div className={styles.progress}>
        Card {currentIndex + 1} of {items.length}
        {recommendedCount && recommendedCount < items.length && (
          <span style={{ marginLeft: "var(--space-sm)", color: currentIndex + 1 > recommendedCount ? "var(--status-warning)" : "var(--text-muted)" }}>
            · Recommended: {recommendedCount}
          </span>
        )}
      </div>

      <div className={`${styles.card} ${isFlipped ? styles.flipped : ""}`}>
        <div className={styles.cardInner}>
          <div className={styles.cardFront}>
            <span className={styles.moduleTag}>{flashcard.module}</span>
            <h3>{flashcard.front}</h3>
            {flashcard.card_type === "statement" && <p className="text-muted text-sm mt-4">(Fill in the blank)</p>}
            {flashcard.card_type === "deep_dive" && <p className="text-muted text-sm mt-4">(Deep Conceptual Recall)</p>}
            
            <button className="btn btn-primary" style={{ marginTop: "auto" }} onClick={() => setIsFlipped(true)}>
              Show Answer
            </button>
          </div>

          <div className={styles.cardBack}>
             <div className={styles.backContent}>
               <div className={styles.answerText}>{flashcard.back}</div>
               
               {cascades.length > 0 && (
                 <div className={styles.cascadeSection}>
                   <div style={{ height: "1px", background: "var(--border-subtle)", margin: "var(--space-md) 0" }} />
                   {cascades.slice(0, cascadeLevel).map((c: string, idx: number) => (
                      <div key={idx} className={styles.cascadeItem}>{c}</div>
                   ))}
                   
                   {cascadeLevel < cascades.length ? (
                     <button className="btn btn-secondary btn-sm" onClick={handleNextCascade}>
                       Reveal Next Step
                     </button>
                   ) : (
                      <p className="text-sm" style={{ color: "var(--status-success)" }}>All conceptual steps revealed.</p>
                   )}
                 </div>
               )}
             </div>

             {/* Grading Buttons only shown if not deep dive OR if all cascades are shown */}
             {(!cascades.length || cascadeLevel >= cascades.length) && (
              <div className={styles.gradingControls}>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.again}`} onClick={() => handleGrade(1)}>
                  Again (1m)
                </button>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.hard}`} onClick={() => handleGrade(3)}>
                  Hard
                </button>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.good}`} onClick={() => handleGrade(4)}>
                  Good
                </button>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.easy}`} onClick={() => handleGrade(5)}>
                  Easy
                </button>
              </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
