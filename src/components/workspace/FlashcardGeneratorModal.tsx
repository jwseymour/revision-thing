"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./FlashcardGeneratorModal.module.css";
import { SelectionData } from "./useTextSelection";

interface FlashcardGeneratorModalProps {
  selectionData: SelectionData | null; // Contains text and rects to save layout
  resourceId: string;
  moduleName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function FlashcardGeneratorModal({ selectionData, resourceId, moduleName, onClose, onSuccess }: FlashcardGeneratorModalProps) {
  const [type, setType] = useState<"statement" | "qna" | "deep_dive">("qna");
  const [focus, setFocus] = useState("");
  const [depth, setDepth] = useState<"basic" | "standard" | "advanced">("standard");
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    if (!selectionData) return;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/content/generate-from-highlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: selectionData.text,
          type,
          resource_id: resourceId,
          focus: focus.trim(),
          depth,
          source_rects: { 
            pageNumber: selectionData.pageNumber,
            topPercent: selectionData.topPercent,
            heightPercent: selectionData.heightPercent
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate flashcard");
      }

      router.refresh(); // Sync flashcard cache immediately
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Error generating flashcard");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!selectionData) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Generate AI Flashcard</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.sourceText}>
            <strong>Selected Text:</strong>
            <p>"{selectionData.text.length > 100 ? selectionData.text.slice(0, 100) + '...' : selectionData.text}"</p>
          </div>

          <div className={styles.options}>
            <label className={styles.typeOption}>
              <input 
                type="radio" 
                name="type" 
                value="statement" 
                checked={type === "statement"} 
                onChange={() => setType("statement")} 
              />
              <div className={styles.typeInfo}>
                <span className={styles.typeTitle}>Statement (Cloze)</span>
                <span className={styles.typeDesc}>A single fact where a key term is hidden.</span>
              </div>
            </label>

            <label className={styles.typeOption}>
              <input 
                type="radio" 
                name="type" 
                value="qna" 
                checked={type === "qna"} 
                onChange={() => setType("qna")} 
              />
              <div className={styles.typeInfo}>
                <span className={styles.typeTitle}>Question & Answer</span>
                <span className={styles.typeDesc}>Standard two-sided flashcard.</span>
              </div>
            </label>

            <label className={styles.typeOption}>
              <input 
                type="radio" 
                name="type" 
                value="deep_dive" 
                checked={type === "deep_dive"} 
                onChange={() => setType("deep_dive")} 
              />
              <div className={styles.typeInfo}>
                <span className={styles.typeTitle}>Deep Dive</span>
                <span className={styles.typeDesc}>Multi-sided conceptual breakdown or algorithm steps.</span>
              </div>
            </label>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Focus & Comments (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. Focus only on the time complexity mechanism..."
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                style={{ padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.875rem' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Depth of Detail</label>
              <select 
                value={depth} 
                onChange={(e) => setDepth(e.target.value as any)}
                style={{ padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.875rem', cursor: 'pointer' }}
              >
                <option value="basic">Basic (High-level Summary)</option>
                <option value="standard">Standard (Core Mechanisms)</option>
                <option value="advanced">Advanced (Pedantic Details & Edge Cases)</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className="btn btn-ghost" onClick={onClose} disabled={isGenerating}>Cancel</button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
