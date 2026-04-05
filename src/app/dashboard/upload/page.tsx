"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileDropzone } from "@/components/FileDropzone";
import styles from "./upload.module.css";

interface FileEntry {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [module, setModule] = useState("");
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    const entries: FileEntry[] = newFiles.map((file) => ({
      file,
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = async () => {
    if (!module.trim() || !topic.trim()) {
      alert("Please enter both a module and topic name.");
      return;
    }

    if (files.length === 0) {
      alert("Please select at least one PDF file.");
      return;
    }

    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) {
      alert("All files have already been uploaded.");
      return;
    }

    setUploading(true);

    // Mark all pending files as uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "pending" ? { ...f, status: "uploading", progress: 30 } : f
      )
    );

    try {
      const formData = new FormData();
      formData.append("module", module.trim());
      formData.append("topic", topic.trim());
      pendingFiles.forEach((entry) => {
        formData.append("files", entry.file);
      });

      // Simulate progress update
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading" ? { ...f, progress: 60 } : f
        )
      );

      const res = await fetch("/api/resources/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setFiles((prev) =>
          prev.map((f) =>
            f.status === "uploading"
              ? { ...f, status: "error", progress: 0, error: data.error || "Upload failed" }
              : f
          )
        );
        setUploading(false);
        return;
      }

      // Match results back to files
      const results = data.results as {
        file_name: string;
        status: string;
        error?: string;
      }[];

      setFiles((prev) =>
        prev.map((f) => {
          if (f.status !== "uploading") return f;
          const result = results.find((r) => r.file_name === f.file.name);
          if (!result) return { ...f, status: "error", error: "No result returned" };
          if (result.status === "error") {
            return { ...f, status: "error", progress: 0, error: result.error };
          }
          return { ...f, status: "success", progress: 100 };
        })
      );
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading"
            ? { ...f, status: "error", progress: 0, error: "Network error" }
            : f
        )
      );
    } finally {
      setUploading(false);
    }
  };

  const successCount = files.filter((f) => f.status === "success").length;
  const hasSuccessful = successCount > 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Upload Resources</h1>
        <p className="text-muted">
          Upload lecture slides and notes as PDFs. AI will generate flashcards
          and exam-style questions from your content.
        </p>
      </div>

      {/* Module & Topic Inputs */}
      <div className={styles.inputs}>
        <div className="form-group">
          <label htmlFor="module" className="form-label">
            Module
          </label>
          <input
            id="module"
            type="text"
            className="input"
            placeholder="e.g. Algorithms, Databases, ML"
            value={module}
            onChange={(e) => setModule(e.target.value)}
            disabled={uploading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="topic" className="form-label">
            Topic
          </label>
          <input
            id="topic"
            type="text"
            className="input"
            placeholder="e.g. Sorting, Graph Search, SQL"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={uploading}
          />
        </div>
      </div>

      {/* Dropzone */}
      <FileDropzone
        onFilesSelected={handleFilesSelected}
        disabled={uploading}
      />

      {/* File List */}
      {files.length > 0 && (
        <div className={styles.fileList}>
          <div className={styles.fileListHeader}>
            <h3>Selected Files ({files.length})</h3>
            {!uploading && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setFiles([])}
              >
                Clear All
              </button>
            )}
          </div>
          {files.map((entry, index) => (
            <div key={`${entry.file.name}-${index}`} className={styles.fileItem}>
              <div className={styles.fileInfo}>
                <span className={styles.fileIcon}>
                  {entry.status === "success"
                    ? "✅"
                    : entry.status === "error"
                      ? "❌"
                      : entry.status === "uploading"
                        ? "⏳"
                        : "📄"}
                </span>
                <div className={styles.fileDetails}>
                  <span className={styles.fileName}>{entry.file.name}</span>
                  <span className={styles.fileSize}>
                    {(entry.file.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
              </div>
              <div className={styles.fileActions}>
                {entry.status === "uploading" && (
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${entry.progress}%` }}
                      />
                    </div>
                  </div>
                )}
                {entry.status === "error" && (
                  <span className={styles.errorText}>{entry.error}</span>
                )}
                {entry.status === "success" && (
                  <span className={styles.successText}>Uploaded</span>
                )}
                {entry.status === "pending" && !uploading && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeFile(index)}
                    title="Remove file"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.actions}>
        {files.some((f) => f.status === "pending") && (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleUpload}
            disabled={uploading || !module.trim() || !topic.trim()}
          >
            {uploading ? (
              <>
                <span className="spinner" /> Uploading...
              </>
            ) : (
              `Upload ${files.filter((f) => f.status === "pending").length} File${files.filter((f) => f.status === "pending").length !== 1 ? "s" : ""}`
            )}
          </button>
        )}
        {hasSuccessful && (
          <button
            className="btn btn-secondary btn-lg"
            onClick={() => router.push("/dashboard/resources")}
          >
            View Resources →
          </button>
        )}
      </div>
    </div>
  );
}
