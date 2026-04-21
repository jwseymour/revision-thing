"use client";

import styles from "./ActivityPanel.module.css";
import { useMemo } from "react";

interface ActivityPanelProps {
  flashcards: any[];
  annotations: any[];
}

export function ActivityPanel({ flashcards, annotations }: ActivityPanelProps) {
  const feed = useMemo(() => {
    const combined = [
      ...flashcards.map(f => ({ ...f, _type: 'flashcard' })),
      ...annotations.map(a => ({ ...a, _type: 'annotation' }))
    ];
    return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [flashcards, annotations]);

  if (feed.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className="text-muted text-sm">Select text in the document to create flashcards or add comments.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.header}>Recent Activity</h3>
      <div className={styles.feed}>
        {feed.map(item => {
          if (item._type === 'flashcard') {
            return (
              <div key={`fc-${item.id}`} className={`${styles.feedItem} ${styles.flashcardItem}`}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemIcon}>🗂️</span>
                  <span>Flashcard ({item.card_type})</span>
                </div>
                <div className={styles.itemContent}>
                  <strong>Q:</strong> {item.front}
                </div>
              </div>
            );
          } else {
            return (
               <div key={`ann-${item.id}`} className={`${styles.feedItem} ${styles.annotationItem}`}>
                 <div className={styles.itemHeader}>
                   <span className={styles.itemIcon}>💬</span>
                   <span>Comment</span>
                 </div>
                 <div className={styles.itemContent}>
                   {item.content}
                 </div>
               </div>
            );
          }
        })}
      </div>
    </div>
  );
}
