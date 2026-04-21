"use client";

import { useEffect, useState } from "react";
import { SelectionData } from "./useTextSelection";
import styles from "./FloatingToolbar.module.css";

interface FloatingToolbarProps {
  selectionData: SelectionData | null;
  onCreateFlashcard: (text: string) => void;
  onAddComment: (text: string) => void;
}

export function FloatingToolbar({ selectionData, onCreateFlashcard, onAddComment }: FloatingToolbarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!selectionData || !selectionData.text) {
      setPosition(null);
      return;
    }
    
    const targetTop = selectionData.viewportTop - 40;
    const finalTop = targetTop < 10 ? selectionData.viewportTop + 30 : targetTop;

    setPosition({
      top: finalTop, 
      left: selectionData.viewportLeft, // Centered
    });
  }, [selectionData]);

  if (!position) return null;

  return (
    <div 
      className={styles.toolbar}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
    >
      <button 
        className={styles.toolBtn} 
        onClick={() => {
          onCreateFlashcard(selectionData!.text);
        }}
      >
        ✨ AI Flashcard
      </button>
      <div className={styles.divider} />
      <button 
        className={styles.toolBtn}
        onClick={() => {
          onAddComment(selectionData!.text);
        }}
      >
        💬 Comment
      </button>
    </div>
  );
}
