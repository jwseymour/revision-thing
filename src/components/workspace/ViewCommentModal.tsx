"use client";

import { useState } from "react";
import styles from "./ViewCommentModal.module.css";
import { createClient } from "@/lib/supabase/client";

interface ViewCommentModalProps {
  annotation: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function ViewCommentModal({ annotation, onClose, onSuccess }: ViewCommentModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(annotation.content);
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  async function handleSave() {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("annotations")
        .update({ content: content.trim() })
        .eq("id", annotation.id);

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Error updating comment");
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("annotations")
        .delete()
        .eq("id", annotation.id);

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Error deleting comment");
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>📝 Comment</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        
        <div className={styles.content}>
          {isEditing ? (
            <textarea
              className={styles.textarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          ) : (
            <div className={styles.textBody}>
              {content || <i>Empty comment</i>}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {isEditing ? (
            <>
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setContent(annotation.content);
                  setIsEditing(false);
                }} 
                disabled={isSaving}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !content.trim()}>
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={handleDelete} disabled={isSaving}>
                Delete
              </button>
              <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                Edit Comment
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
