"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateSchedule } from "@/lib/scheduling";
import { preprocessLaTeX } from "@/lib/math-utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flashcard: any;
}

interface ReviewSessionProps {
  initialItems: ReviewItem[];
  returnUrl?: string;
  recommendedCount?: number;
}

export function ReviewSession({ initialItems, returnUrl = "/dashboard", recommendedCount }: ReviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cascadeLevel, setCascadeLevel] = useState(0);

  // Stable supabase client
  const supabase = useMemo(() => createClient(), []);

  const currentItem = initialItems[currentIndex];

  // These must be computed before any conditional hooks — guards below
  const flashcard = currentItem?.flashcard;
  const cascades = useMemo(
    () => (Array.isArray(flashcard?.cascade_content) ? flashcard.cascade_content : []),
    [flashcard]
  );

  const handleGrade = useCallback(
    async (quality: number) => {
      let classification = "incorrect";
      if (quality === 3) classification = "partial";
      if (quality === 4) classification = "correct_guessed";
      if (quality === 5) classification = "correct_confident";

      // Optimistic update
      setCurrentIndex((idx) => idx + 1);
      setIsFlipped(false);
      setCascadeLevel(0);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && flashcard) {
        await supabase.from("attempts").insert({
          user_id: user.id,
          item_id: flashcard.id,
          item_type: "flashcard",
          classification,
        });
        await updateSchedule(supabase, user.id, flashcard.module, flashcard.id, "flashcard", classification);
      }
    },
    [supabase, flashcard]
  );

  const handleNextCascade = useCallback(() => {
    if (cascadeLevel < cascades.length) {
      setCascadeLevel((prev) => prev + 1);
    }
  }, [cascadeLevel, cascades.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
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
          if (key === "1") { e.preventDefault(); handleGrade(1); }
          if (key === "2") { e.preventDefault(); handleGrade(3); }
          if (key === "3") { e.preventDefault(); handleGrade(4); }
          if (key === "4") { e.preventDefault(); handleGrade(5); }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlipped, cascades.length, cascadeLevel, handleNextCascade, handleGrade]);

  // Early return AFTER all hooks have been called unconditionally
  if (!currentItem) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-3xl)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}>
        <span style={{ fontSize: "3rem", display: "block", marginBottom: "var(--space-lg)" }}>🎯</span>
        <h2>Session complete!</h2>
        <p className="text-muted" style={{ marginTop: "var(--space-sm)" }}>You reviewed {initialItems.length} card{initialItems.length !== 1 ? "s" : ""}.</p>
        <a href={returnUrl} className="btn btn-primary" style={{ marginTop: "var(--space-lg)", display: "inline-block" }}>
          {returnUrl === "/dashboard/review" ? "Back to Review Overview" : "Back to Library"}
        </a>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.progress}>
        Card {currentIndex + 1} of {initialItems.length}
        {recommendedCount && recommendedCount < initialItems.length && (
          <span style={{ marginLeft: "var(--space-sm)", color: currentIndex + 1 > recommendedCount ? "var(--status-warning)" : "var(--text-muted)" }}>
            · Recommended: {recommendedCount}
          </span>
        )}
      </div>

      <div className={styles.card}>
        {!isFlipped ? (
          <div className={styles.cardFront}>
            <span className={styles.moduleTag}>{flashcard.module}</span>
            <div className="markdown-body" style={{ marginTop: "var(--space-md)", fontSize: "1.2rem", fontWeight: "bold", flex: 1 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(flashcard.front)}</ReactMarkdown>
            </div>
            {flashcard.card_type === "statement" && <p className="text-muted text-sm mt-4">(Core Statement Insight)</p>}
            {flashcard.card_type === "deep_dive" && <p className="text-muted text-sm mt-4">(Deep Conceptual Recall)</p>}

            {flashcard.card_type !== "statement" ? (
              <button className="btn btn-primary" style={{ marginTop: "var(--space-lg)", flexShrink: 0 }} onClick={() => setIsFlipped(true)}>
                Show Answer
              </button>
            ) : (
              <div className={styles.gradingControls}>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.again}`} onClick={() => handleGrade(1)}>Again (1m)</button>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.hard}`} onClick={() => handleGrade(3)}>Hard</button>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.good}`} onClick={() => handleGrade(4)}>Good</button>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.easy}`} onClick={() => handleGrade(5)}>Easy</button>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.cardBack}>
            <div className={styles.backContent}>
              <div className={`${styles.answerText} markdown-body`}>
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(flashcard.back)}</ReactMarkdown>
              </div>

              {cascades.length > 0 && (
                <div className={styles.cascadeSection}>
                  <div style={{ height: "1px", background: "var(--border-subtle)", margin: "var(--space-md) 0" }} />
                  {cascades.slice(0, cascadeLevel).map((c: string, idx: number) => (
                    <div key={idx} className={`${styles.cascadeItem} markdown-body`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(c)}</ReactMarkdown>
                    </div>
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

            {(!cascades.length || cascadeLevel >= cascades.length) && (
              <div className={styles.gradingControls}>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.again}`} onClick={() => handleGrade(1)}>Again (1m)</button>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.hard}`} onClick={() => handleGrade(3)}>Hard</button>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.good}`} onClick={() => handleGrade(4)}>Good</button>
                <button className={`btn btn-sm ${styles.gradeBtn} ${styles.easy}`} onClick={() => handleGrade(5)}>Easy</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
