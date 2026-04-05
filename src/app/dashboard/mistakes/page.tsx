"use client";

  import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import styles from "./mistakes.module.css";
import { MarkdownContent } from "@/lib/markdown-renderer";

interface Mistake {
  id: string;
  error_type: string;
  topic: string;
  module: string;
  description: string;
  created_at: string;
  resolved: boolean;
}

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const fetchMistakes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/mistakes?resolved=${showResolved}`);
      if (res.ok) {
        const data = await res.json();
        setMistakes(data.mistakes || []);
      }
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  useEffect(() => {
    fetchMistakes();
  }, [fetchMistakes]);

  const toggleResolved = async (id: string, currentResolved: boolean) => {
    try {
      const res = await fetch(`/api/mistakes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !currentResolved }),
      });
      if (res.ok) {
        // Optimistically update
        setMistakes((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Stats
  const errorTypeCounts = mistakes.reduce((acc, m) => {
    acc[m.error_type] = (acc[m.error_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topicCounts = mistakes.reduce((acc, m) => {
    acc[m.topic] = (acc[m.topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const worstTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None yet";
  const numConceptual = errorTypeCounts["conceptual"] || 0;
  const numMisapp = errorTypeCounts["misapplication"] || 0;
  const numMemory = errorTypeCounts["memory"] || 0;
  const numCareless = errorTypeCounts["careless"] || 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Mistake Analysis</h1>
        <p className="text-muted">Identify patterns and eliminate recurring errors.</p>
      </div>

      <div className={styles.statsGrid}>
        <div className={`card ${styles.statCard}`}>
          <span className={styles.statValue}>{mistakes.length}</span>
          <span className={styles.statLabel}>Active Mistakes</span>
        </div>
        <div className={`card ${styles.statCard}`}>
          <span className={styles.statValue}>{worstTopic}</span>
          <span className={styles.statLabel}>Weakest Topic</span>
        </div>
        <div className={`card ${styles.statCard} ${styles.typeStats}`}>
          <div className={styles.typeRow}>
            <span>Conceptual</span>
            <strong>{numConceptual}</strong>
          </div>
          <div className={styles.typeRow}>
            <span>Misapplication</span>
            <strong>{numMisapp}</strong>
          </div>
          <div className={styles.typeRow}>
            <span>Memory</span>
            <strong>{numMemory}</strong>
          </div>
          <div className={styles.typeRow}>
            <span>Careless</span>
            <strong>{numCareless}</strong>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <button
          className={`btn ${showResolved ? "btn-secondary" : "btn-primary"}`}
          onClick={() => setShowResolved(false)}
        >
          Unresolved
        </button>
        <button
          className={`btn ${showResolved ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setShowResolved(true)}
        >
          Resolved
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "var(--space-2xl)" }}>
          <span className="spinner"></span>
        </div>
      ) : mistakes.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }}>🙌</div>
          <h3>No visible mistakes</h3>
          <p className="text-muted text-sm">
            {showResolved
              ? "You haven't resolved any mistakes yet."
              : "You have no unresolved mistakes! Keep practicing to uncover blind spots."}
          </p>
        </div>
      ) : (
        <div className={styles.mistakeList}>
          {mistakes.map((m) => (
            <div key={m.id} className={`card ${styles.mistakeCard}`}>
              <div className={styles.mistakeHeader}>
                <div className={styles.mistakeInfo}>
                  <span className={`badge ${styles[`badge-${m.error_type}`]}`}>
                    {m.error_type}
                  </span>
                  <span className={styles.mistakeContext}>
                    {m.module} / {m.topic}
                  </span>
                </div>
                <div className={styles.date}>
                  {new Date(m.created_at).toLocaleDateString()}
                </div>
              </div>

              {m.description && (
                <div className={styles.notes}>
                  <MarkdownContent content={m.description} />
                </div>
              )}

              <div className={styles.actions}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => toggleResolved(m.id, m.resolved)}
                >
                  {m.resolved ? "Mark Unresolved" : "Mark Resolved"}
                </button>
                <Link
                  href={`/dashboard/practice/${encodeURIComponent(m.module)}/${encodeURIComponent(m.topic)}`}
                  className="btn btn-primary btn-sm"
                >
                  Practice Topic
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
