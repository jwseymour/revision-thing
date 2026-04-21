"use client";

import { useState } from "react";
import styles from "./ResourceCard.module.css";

interface ResourceCardProps {
  id: string;
  fileName: string;
  module: string;
  type: string;
  fileSizeBytes: number | null;
  createdAt: string;
  onDelete?: (id: string) => void;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ResourceCard({
  id,
  fileName,
  module: moduleName,
  type,
  fileSizeBytes,
  createdAt,
  onDelete,
}: ResourceCardProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${fileName}"? This will also remove any generated content.`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/resources/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete resource");
        setDeleting(false);
        return;
      }
      onDelete?.(id);
    } catch {
      alert("Failed to delete resource");
      setDeleting(false);
    }
  }

  const contentUrl = `/dashboard/content/${encodeURIComponent(moduleName)}`;

  return (
    <div className={styles.card}>
      <div className={styles.info}>
        <div className={styles.icon}>📄</div>
        <div className={styles.details}>
          <div className={styles.name}>{fileName}</div>
          <div className={styles.meta}>
            {formatFileSize(fileSizeBytes)} • {formatDate(createdAt)}
          </div>
        </div>
      </div>
      <div className={styles.actions}>
        <span className={`badge badge-info`}>
          {type === 'past_paper' ? "Past Exam Paper" : "Lecture Material"}
        </span>
        {type === "past_paper" ? (
          <a href={`/dashboard/workspace/${id}`} className="btn btn-secondary btn-sm">
            Attempt Exam
          </a>
        ) : (
          <a href={`/dashboard/workspace/${id}`} className="btn btn-primary btn-sm">
            Read & Annotate
          </a>
        )}
        <button
          onClick={handleDelete}
          className="btn btn-ghost btn-sm"
          disabled={deleting}
          title="Delete resource"
        >
          {deleting ? "..." : "🗑"}
        </button>
      </div>
    </div>
  );
}
