"use client";

import { useState } from "react";
import styles from "./FlashcardGeneratorModal.module.css"; // Reuse the styling
import { SelectionData } from "./useTextSelection";
import { createClient } from "@/lib/supabase/client";

interface CommentModalProps {
  selectionData: SelectionData | null;
  resourceId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CommentModal({ selectionData, resourceId, onClose, onSuccess }: CommentModalProps) {
  const [commentText, setCommentText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  async function handleSave() {
    if (!selectionData || !commentText.trim()) return;
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { error } = await supabase.from("annotations").insert({
        user_id: user.id,
        resource_id: resourceId,
        content: commentText.trim(),
        source_rects: { 
          pageNumber: selectionData.pageNumber,
          topPercent: selectionData.topPercent,
          heightPercent: selectionData.heightPercent
        },
      });

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Error saving comment");
    } finally {
      setIsSaving(false);
    }
  }

  if (!selectionData) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Add Comment</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.sourceText}>
            <strong>Selected Text:</strong>
            <p>"{selectionData.text.length > 100 ? selectionData.text.slice(0, 100) + '...' : selectionData.text}"</p>
          </div>

          <textarea
            autoFocus
            placeholder="Type your comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            style={{ width: "100%", minHeight: "100px", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-default)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          />
        </div>

        <div className={styles.footer}>
          <button className="btn btn-ghost" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !commentText.trim()}>
            {isSaving ? "Saving..." : "Save Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}
