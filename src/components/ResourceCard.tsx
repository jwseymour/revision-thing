"use client";

import { useState } from "react";
import styles from "./ResourceCard.module.css";

interface ResourceCardProps {
  id: string;
  fileName: string;
  module: string;
  topic: string;
  status: string;
  fileSizeBytes: number | null;
  createdAt: string;
  onDelete?: (id: string) => void;
  onGenerate?: (id: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "badge-warning" },
  processing: { label: "Processing...", className: "badge-info" },
  ready: { label: "Ready", className: "badge-success" },
  error: { label: "Error", className: "badge-danger" },
};

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
  status,
  fileSizeBytes,
  createdAt,
  onDelete,
  onGenerate,
}: ResourceCardProps) {
  const [deleting, setDeleting] = useState(false);
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

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
        <span className={`badge ${statusConfig.className}`}>
          {statusConfig.label}
        </span>
        {status === "pending" && onGenerate && (
          <button
            onClick={() => onGenerate(id)}
            className="btn btn-primary btn-sm"
          >
            Generate Content
          </button>
        )}
        {status === "ready" && (
          <span className={styles["ready-check"]}>✓ Content generated</span>
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
