"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { MarkdownContent } from "@/lib/markdown-renderer";
import { ClassificationButtons, type Classification } from "@/components/practice/ClassificationButtons";
import { ErrorClassification, type ErrorType } from "@/components/practice/ErrorClassification";
import { ProgressIndicator } from "@/components/practice/ProgressIndicator";
import { SessionSummary } from "@/components/practice/SessionSummary";
import styles from "./practice.module.css";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: number;
}

interface Question {
  id: string;
  text: string;
  difficulty: number;
  type: string;
  solution_text: string;
  solution_explanation: string;
}

type PracticeItem =
  | { kind: "flashcard"; data: Flashcard }
  | { kind: "question"; data: Question };

type Phase = "loading" | "answer" | "revealed" | "classify-error" | "complete";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PracticePage({
  params,
}: {
  params: Promise<{ module: string; topic: string }>;
}) {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "mixed";

  const [resolvedParams, setResolvedParams] = useState<{ module: string; topic: string } | null>(null);
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [revealEnabled, setRevealEnabled] = useState(false);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [scratchText, setScratchText] = useState("");
  const [startTime] = useState(Date.now());
  const [transitioning, setTransitioning] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  const fetchItems = useCallback(
    async (mod: string, top: string) => {
      try {
        const res = await fetch(
          `/api/content/${encodeURIComponent(mod)}/${encodeURIComponent(top)}`
        );
        if (!res.ok) return;
        const data = await res.json();

        const all: PracticeItem[] = [];

        if (mode !== "questions") {
          (data.flashcards || []).forEach((fc: Flashcard) =>
            all.push({ kind: "flashcard", data: fc })
          );
        }
        if (mode !== "flashcards") {
          (data.questions || []).forEach((q: Question) =>
            all.push({ kind: "question", data: q })
          );
        }

        setItems(shuffle(all));
        setPhase(all.length > 0 ? "answer" : "complete");
      } catch {
        setPhase("complete");
      }
    },
    [mode]
  );

  useEffect(() => {
    if (resolvedParams && !hasFetched.current) {
      hasFetched.current = true;
      fetchItems(resolvedParams.module, resolvedParams.topic);
    }
  }, [resolvedParams, fetchItems]);

  // Enforce thinking delay when new item loads
  useEffect(() => {
    if (phase === "answer") {
      setRevealEnabled(false);
      setScratchText("");
      const item = items[currentIndex];
      const delay = item?.kind === "question" ? 5000 : 3000;
      const timer = setTimeout(() => setRevealEnabled(true), delay);
      return () => clearTimeout(timer);
    }
  }, [phase, currentIndex, items]);

  const handleReveal = () => {
    setPhase("revealed");
  };

  const handleClassify = async (classification: Classification) => {
    if (!resolvedParams) return;
    const item = items[currentIndex];

    // If incorrect or partial, show error classification
    if (classification === "incorrect" || classification === "partial") {
      setClassifications((prev) => [...prev, classification]);
      setPhase("classify-error");
      return;
    }

    // Record attempt
    await recordAttempt(item, classification);
    setClassifications((prev) => [...prev, classification]);
    advanceToNext();
  };

  const handleErrorClassified = async (errorType: ErrorType, notes: string) => {
    const item = items[currentIndex];
    const classification = classifications[classifications.length - 1];
    await recordAttempt(item, classification, errorType, notes);
    advanceToNext();
  };

  const recordAttempt = async (
    item: PracticeItem,
    classification: Classification,
    errorType?: ErrorType,
    notes?: string
  ) => {
    if (!resolvedParams) return;
    try {
      await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: item.data.id,
          item_type: item.kind,
          module: decodeURIComponent(resolvedParams.module),
          topic: decodeURIComponent(resolvedParams.topic),
          classification,
          error_type: errorType || null,
          notes: notes || null,
        }),
      });
    } catch {
      // Silent fail — don't break the flow
    }
  };

  const advanceToNext = () => {
    setTransitioning(true);
    setTimeout(() => {
      if (currentIndex + 1 < items.length) {
        setCurrentIndex((i) => i + 1);
        setPhase("answer");
      } else {
        setPhase("complete");
      }
      setTransitioning(false);
    }, 300);
  };

  if (!resolvedParams) return null;
  const decodedModule = decodeURIComponent(resolvedParams.module);
  const decodedTopic = decodeURIComponent(resolvedParams.topic);

  // Loading
  if (phase === "loading") {
    return (
      <div className={styles.focusMode}>
        <div className={styles.center}>
          <span className="spinner" /> Loading practice session...
        </div>
      </div>
    );
  }

  // Complete
  if (phase === "complete" && items.length === 0) {
    return (
      <div className={styles.focusMode}>
        <div className={styles.center}>
          <h2>No items to practice</h2>
          <p className="text-muted">Upload PDFs and generate content first.</p>
          <a href="/dashboard/upload" className="btn btn-primary" style={{ marginTop: "var(--space-lg)" }}>
            Upload PDFs
          </a>
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className={styles.focusMode}>
        <SessionSummary
          moduleName={decodedModule}
          topicName={decodedTopic}
          totalItems={items.length}
          results={classifications}
          startTime={startTime}
        />
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const isFlashcard = currentItem.kind === "flashcard";

  return (
    <div className={styles.focusMode}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <a href={`/dashboard/modules/${encodeURIComponent(decodedModule)}`} className={styles.exitBtn}>
          ← Exit
        </a>
        <ProgressIndicator current={currentIndex + 1} total={items.length} />
        <span className={`badge ${isFlashcard ? "badge-info" : "badge-warning"}`}>
          {isFlashcard ? "Flashcard" : "Question"}
        </span>
      </div>

      {/* Main card area */}
      <div className={`${styles.cardArea} ${transitioning ? styles.fadeOut : styles.fadeIn}`}>
        {isFlashcard ? (
          /* FLASHCARD */
          <div className={styles.card}>
            <div className={styles.cardContent}>
              <MarkdownContent content={(currentItem.data as Flashcard).front} />
            </div>

            {phase === "revealed" && (
              <div className={styles.revealedContent}>
                <div className={styles.divider} />
                <MarkdownContent content={(currentItem.data as Flashcard).back} />
              </div>
            )}
          </div>
        ) : (
          /* QUESTION */
          <div className={styles.card}>
            <div className={styles.cardContent}>
              <MarkdownContent content={(currentItem.data as Question).text} />
            </div>

            {phase === "answer" && (
              <textarea
                className={styles.scratchArea}
                placeholder="Scratch area — draft your answer here (not graded)..."
                value={scratchText}
                onChange={(e) => setScratchText(e.target.value)}
                rows={4}
              />
            )}

            {phase === "revealed" && (
              <div className={styles.revealedContent}>
                <div className={styles.divider} />
                <div className={styles.solutionLabel}>Solution</div>
                <MarkdownContent content={(currentItem.data as Question).solution_text} />
                {(currentItem.data as Question).solution_explanation && (
                  <>
                    <div className={styles.solutionLabel} style={{ marginTop: "var(--space-lg)" }}>
                      Explanation
                    </div>
                    <MarkdownContent content={(currentItem.data as Question).solution_explanation} />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {phase === "answer" && (
          <div className={styles.actions}>
            <button
              className={`btn btn-primary btn-lg ${styles.revealBtn}`}
              onClick={handleReveal}
              disabled={!revealEnabled}
            >
              {revealEnabled
                ? isFlashcard
                  ? "I've thought about it — Reveal Answer"
                  : "I've attempted it — Reveal Solution"
                : isFlashcard
                  ? "Think first... (3s)"
                  : "Attempt first... (5s)"}
            </button>
          </div>
        )}

        {phase === "revealed" && (
          <ClassificationButtons onClassify={handleClassify} />
        )}

        {phase === "classify-error" && (
          <ErrorClassification onSubmit={handleErrorClassified} />
        )}
      </div>
    </div>
  );
}
