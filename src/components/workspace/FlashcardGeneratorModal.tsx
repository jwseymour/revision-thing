"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./FlashcardGeneratorModal.module.css";
import { SelectionData } from "./useTextSelection";

interface FlashcardGeneratorModalProps {
  selectionData: SelectionData | null;
  resourceId: string;
  moduleName: string;
  onClose: () => void;
  onSuccess: () => void;
}

type CardType = "statement" | "qna" | "deep_dive";
type Depth    = "basic" | "standard" | "advanced";
type Stage    = "type" | "depth" | "focus";

const TYPE_OPTIONS: { value: CardType; label: string; desc: string }[] = [
  { value: "statement", label: "Statement",  desc: "Single fact" },
  { value: "qna",       label: "Q & A",      desc: "Two-sided" },
  { value: "deep_dive", label: "Deep Dive",  desc: "Step-by-step" },
];

const DEPTH_OPTIONS: { value: Depth; label: string; desc: string }[] = [
  { value: "basic",    label: "Basic",    desc: "Overview" },
  { value: "standard", label: "Standard", desc: "Core" },
  { value: "advanced", label: "Advanced", desc: "Rigorous" },
];

export function FlashcardGeneratorModal({
  selectionData, resourceId, moduleName, onClose, onSuccess,
}: FlashcardGeneratorModalProps) {
  const [type,  setType]  = useState<CardType>("qna");
  const [depth, setDepth] = useState<Depth>("standard");
  const [focus, setFocus] = useState("");
  const [stage, setStage] = useState<Stage>("type");
  const [isGenerating, setIsGenerating] = useState(false);
  const focusRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // When stage advances to "focus", auto-focus the text input
  useEffect(() => {
    if (stage === "focus") {
      setTimeout(() => focusRef.current?.focus(), 30);
    }
  }, [stage]);

  // Keyboard shortcuts: 1/2/3 drive the stage machine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Enter always generates
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isGenerating) handleGenerate();
        return;
      }

      // Escape closes
      if (e.key === "Escape") { onClose(); return; }

      // Don't intercept number keys when the focus input is active
      if (document.activeElement === focusRef.current) return;

      if (stage === "type") {
        if (e.key === "1") { e.preventDefault(); setType("statement");  setStage("depth"); }
        if (e.key === "2") { e.preventDefault(); setType("qna");        setStage("depth"); }
        if (e.key === "3") { e.preventDefault(); setType("deep_dive");  setStage("depth"); }
      } else if (stage === "depth") {
        if (e.key === "1") { e.preventDefault(); setDepth("basic");    setStage("focus"); }
        if (e.key === "2") { e.preventDefault(); setDepth("standard"); setStage("focus"); }
        if (e.key === "3") { e.preventDefault(); setDepth("advanced"); setStage("focus"); }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stage, type, depth, focus, isGenerating]);

  async function handleGenerate() {
    if (!selectionData || isGenerating) return;
    setIsGenerating(true);
    onClose();
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
            pageNumber:    selectionData.pageNumber,
            topPercent:    selectionData.topPercent,
            heightPercent: selectionData.heightPercent,
          },
        }),
      });
      if (!response.ok) throw new Error("Failed to generate flashcard");
      router.refresh();
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Error generating flashcard");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!selectionData || isGenerating) return null;

  const preview = selectionData.text.length > 90
    ? selectionData.text.slice(0, 90) + "…"
    : selectionData.text;

  const stageHint =
    stage === "type"  ? "Press 1 · 2 · 3 to pick type" :
    stage === "depth" ? "Press 1 · 2 · 3 to pick depth" :
    "Type a focus note, or ⌘↩ to generate";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <span className={styles.title}>Generate Flashcard</span>
          <button className={styles.closeBtn} onClick={onClose} tabIndex={-1}>✕</button>
        </div>

        {/* ── Source preview ── */}
        <div className={styles.sourceText}>
          <span className={styles.sourceLabel}>From</span>
          <span className={styles.sourcePreview} title={selectionData.text}>"{preview}"</span>
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>

          {/* Stage 1 — Type */}
          <div className={`${styles.stageRow} ${stage === "type" ? styles.stageActive : styles.stageDone}`}
               onClick={() => setStage("type")}>
            <span className={styles.stageNum}>1</span>
            <div className={styles.stagePills}>
              {TYPE_OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.pill} ${type === opt.value ? styles.pillActive : ""}`}
                  onClick={(e) => { e.stopPropagation(); setType(opt.value); if (stage === "type") setStage("depth"); }}
                >
                  <span className={styles.pillKey}>{i + 1}</span>
                  <span className={styles.pillLabel}>{opt.label}</span>
                  <span className={styles.pillDesc}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stage 2 — Depth */}
          <div className={`${styles.stageRow} ${stage === "depth" ? styles.stageActive : stage === "type" ? styles.stagePending : styles.stageDone}`}
               onClick={() => setStage("depth")}>
            <span className={styles.stageNum}>2</span>
            <div className={styles.stagePills}>
              {DEPTH_OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.pill} ${depth === opt.value ? styles.pillActive : ""}`}
                  onClick={(e) => { e.stopPropagation(); setDepth(opt.value); if (stage === "depth") setStage("focus"); }}
                >
                  <span className={styles.pillKey}>{i + 1}</span>
                  <span className={styles.pillLabel}>{opt.label}</span>
                  <span className={styles.pillDesc}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stage 3 — Focus */}
          <div className={`${styles.stageRow} ${stage === "focus" ? styles.stageActive : styles.stagePending}`}
               onClick={() => setStage("focus")}>
            <span className={styles.stageNum}>3</span>
            <input
              ref={focusRef}
              type="text"
              className={styles.focusInput}
              placeholder="Focus note (optional) — e.g. time complexity only…"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              onClick={(e) => { e.stopPropagation(); setStage("focus"); }}
            />
          </div>

        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <span className={styles.hint}>{stageHint}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} tabIndex={-1}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={isGenerating}>
            Generate ↵
          </button>
        </div>

      </div>
    </div>
  );
}
