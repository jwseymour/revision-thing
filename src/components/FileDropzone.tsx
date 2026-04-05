"use client";

import { useState, useRef, useCallback } from "react";
import styles from "./FileDropzone.module.css";

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
  disabled?: boolean;
}

export function FileDropzone({
  onFilesSelected,
  accept = ".pdf",
  maxSizeMB = 20,
  multiple = true,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const validFiles: File[] = [];
      const errors: string[] = [];

      Array.from(fileList).forEach((file) => {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
          errors.push(`${file.name}: Not a PDF file`);
          return;
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
          errors.push(
            `${file.name}: Too large (${(file.size / 1024 / 1024).toFixed(1)}MB, max ${maxSizeMB}MB)`
          );
          return;
        }
        validFiles.push(file);
      });

      if (errors.length > 0) {
        alert(errors.join("\n"));
      }

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [onFilesSelected, maxSizeMB]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (!disabled) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles]
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset input so the same file can be selected again
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFiles]
  );

  return (
    <div
      className={`${styles.dropzone} ${isDragOver ? styles.dragover : ""} ${disabled ? styles.disabled : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      aria-label="Drop PDF files here or click to browse"
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className={styles.input}
        disabled={disabled}
      />
      <div className={styles.content}>
        <div className={styles.icon}>
          {isDragOver ? "📥" : "📄"}
        </div>
        <p className={styles.title}>
          {isDragOver ? "Drop files here" : "Drag & drop PDF files here"}
        </p>
        <p className={styles.subtitle}>
          or click to browse • Max {maxSizeMB}MB per file
        </p>
      </div>
    </div>
  );
}
