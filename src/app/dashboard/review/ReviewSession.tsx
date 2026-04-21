"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./ReviewSession.module.css";

interface ReviewItem {
  schedule: {
    id: string;
    ease_factor: number;
    interval_days: number;
    repetition_count: number;
  };
  flashcard: any;
}

export function ReviewSession({ initialItems }: { initialItems: ReviewItem[] }) {
  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cascadeLevel, setCascadeLevel] = useState(0); 
  const supabase = createClient();

  const currentItem = items[currentIndex];

  if (!currentItem) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
        <h2>Session complete!</h2>
        <a href="/dashboard" className="btn btn-primary mt-4">Back to Library</a>
      </div>
    );
  }

  const { flashcard, schedule } = currentItem;
  
  // Parse cascade content if Deep Dive
  const cascades = Array.isArray(flashcard.cascade_content) ? flashcard.cascade_content : [];

  async function handleGrade(quality: number) {
    // SM-2 logic
    let { ease_factor, interval_days, repetition_count } = schedule;

    if (quality >= 3) {
      if (repetition_count === 0) interval_days = 1;
      else if (repetition_count === 1) interval_days = 6;
      else interval_days = Math.round(interval_days * ease_factor);
      repetition_count += 1;
    } else {
      repetition_count = 0;
      interval_days = 1;
    }

    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease_factor < 1.3) ease_factor = 1.3;

    // Next review date
    const next_review_at = new Date();
    next_review_at.setDate(next_review_at.getDate() + interval_days);

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
        classification: quality >= 3 ? 'correct_confident' : 'incorrect',
      });

      // Update schedule
      await supabase.from("item_scheduling_state").update({
        ease_factor,
        interval_days,
        repetition_count,
        next_review_at: next_review_at.toISOString(),
        updated_at: new Date().toISOString()
      }).eq("id", schedule.id);
    }
  }

  const handleNextCascade = () => {
    if (cascadeLevel < cascades.length) {
      setCascadeLevel(prev => prev + 1);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.progress}>
        Card {currentIndex + 1} of {items.length}
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
