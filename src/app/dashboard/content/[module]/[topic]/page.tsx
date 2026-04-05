"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { MarkdownContent } from "@/lib/markdown-renderer";
import styles from "./content.module.css";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: number;
  tags: string[];
}

interface Question {
  id: string;
  text: string;
  difficulty: number;
  tags: string[];
  type: string;
  solution_text: string;
  solution_explanation: string;
}

export default function ContentPage({
  params,
}: {
  params: Promise<{ module: string; topic: string }>;
}) {
  const [resolvedParams, setResolvedParams] = useState<{ module: string; topic: string } | null>(null);
  const [tab, setTab] = useState<"flashcards" | "questions">("flashcards");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const hasFetched = useRef(false);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  const fetchContent = useCallback(async (mod: string, top: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/content/${encodeURIComponent(mod)}/${encodeURIComponent(top)}`
      );
      if (res.ok) {
        const data = await res.json();
        setFlashcards(data.flashcards || []);
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error("Failed to fetch content:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (resolvedParams && !hasFetched.current) {
      hasFetched.current = true;
      fetchContent(resolvedParams.module, resolvedParams.topic);
    }
  }, [resolvedParams, fetchContent]);

  const toggleFlip = (id: string) => {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteFlashcard = async (id: string) => {
    if (!confirm("Delete this flashcard?")) return;
    const res = await fetch(`/api/content/flashcards/${id}`, { method: "DELETE" });
    if (res.ok) setFlashcards((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    const res = await fetch(`/api/content/questions/${id}`, { method: "DELETE" });
    if (res.ok) setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const difficultyLabel = (d: number) => {
    const labels = ["", "Basic", "Easy", "Medium", "Hard", "Exam"];
    return labels[d] || "";
  };

  if (!resolvedParams) return null;

  const decodedModule = decodeURIComponent(resolvedParams.module);
  const decodedTopic = decodeURIComponent(resolvedParams.topic);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>{decodedTopic}</h1>
          <p className="text-muted">{decodedModule}</p>
        </div>
        <div className={styles.loading}>
          <span className="spinner" /> Loading content...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Link href="/dashboard/resources" className={styles.breadcrumb}>
            ← Resources
          </Link>
          <h1>{decodedTopic}</h1>
          <p className="text-muted mono">
            {decodedModule} • {flashcards.length} flashcards • {questions.length} questions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "flashcards" ? styles.tabActive : ""}`}
          onClick={() => setTab("flashcards")}
        >
          Flashcards ({flashcards.length})
        </button>
        <button
          className={`${styles.tab} ${tab === "questions" ? styles.tabActive : ""}`}
          onClick={() => setTab("questions")}
        >
          Questions ({questions.length})
        </button>
      </div>

      {/* Flashcards Tab */}
      {tab === "flashcards" && (
        <div className={styles.cardGrid}>
          {flashcards.length === 0 ? (
            <div className={styles.empty}>No flashcards generated yet.</div>
          ) : (
            flashcards.map((fc) => (
              <div
                key={fc.id}
                className={`${styles.flashcard} ${flippedCards.has(fc.id) ? styles.flipped : ""}`}
                onClick={() => toggleFlip(fc.id)}
              >
                <div className={styles.flashcardInner}>
                  <div className={styles.flashcardFront}>
                    <div className={styles.flashcardMeta}>
                      <span className="badge badge-warning">
                        {difficultyLabel(fc.difficulty)}
                      </span>
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFlashcard(fc.id);
                        }}
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                    <MarkdownContent content={fc.front} />
                    <div className={styles.flipHint}>Click to flip</div>
                  </div>
                  <div className={styles.flashcardBack}>
                    <div className={styles.flashcardMeta}>
                      <span className="badge badge-success">Answer</span>
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFlashcard(fc.id);
                        }}
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                    <MarkdownContent content={fc.back} />
                    <div className={styles.tags}>
                      {fc.tags.map((tag) => (
                        <span key={tag} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Questions Tab */}
      {tab === "questions" && (
        <div className={styles.questionList}>
          {questions.length === 0 ? (
            <div className={styles.empty}>No questions generated yet.</div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className={styles.question}>
                <div
                  className={styles.questionHeader}
                  onClick={() => toggleExpand(q.id)}
                >
                  <div className={styles.questionTitle}>
                    <span className={styles.questionNumber}>Q{idx + 1}</span>
                    <MarkdownContent content={q.text} />
                  </div>
                  <div className={styles.questionMeta}>
                    <span className="badge badge-info">{q.type.replace("_", " ")}</span>
                    <span className="badge badge-warning">{difficultyLabel(q.difficulty)}</span>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteQuestion(q.id);
                      }}
                      title="Delete"
                    >
                      🗑
                    </button>
                    <span className={styles.expandIcon}>
                      {expandedQuestions.has(q.id) ? "▲" : "▼"}
                    </span>
                  </div>
                </div>
                {expandedQuestions.has(q.id) && (
                  <div className={styles.questionSolution}>
                    <div className={styles.solutionSection}>
                      <h4>Solution</h4>
                      <MarkdownContent content={q.solution_text} />
                    </div>
                    {q.solution_explanation && (
                      <div className={styles.solutionSection}>
                        <h4>Explanation</h4>
                        <MarkdownContent content={q.solution_explanation} />
                      </div>
                    )}
                    <div className={styles.tags}>
                      {q.tags.map((tag) => (
                        <span key={tag} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
