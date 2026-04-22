"use client";

import { useState, useEffect } from "react";
import styles from "./PastPaperPanel.module.css";
import { createClient } from "@/lib/supabase/client";

interface PastPaperPanelProps {
  resourceId: string;
  onTabSwitch: (tab: "past_paper" | "supervisor") => void;
}

export function PastPaperPanel({ resourceId, onTabSwitch }: PastPaperPanelProps) {
  const [answer, setAnswer] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("past_paper_answers")
        .select("answer_text")
        .eq("resource_id", resourceId)
        .eq("user_id", user.id)
        .single();

      if (data) setAnswer(data.answer_text);
    }
    load();
  }, [resourceId, supabase]);

  async function handleSave() {
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("past_paper_answers")
        .upsert({
          user_id: user.id,
          resource_id: resourceId,
          answer_text: answer
        }, { onConflict: 'user_id, resource_id' });
    }
    setIsSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', alignItems: 'center' }}>
        <button 
          style={{ padding: 'var(--space-md) var(--space-lg)', background: 'var(--bg-primary)', border: 'none', borderBottom: '2px solid var(--accent-primary)', color: 'var(--accent-primary)', fontFamily: 'var(--font-geist-mono)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
        >
          Answers
        </button>
        <button 
          style={{ padding: 'var(--space-md) var(--space-lg)', background: 'none', border: 'none', borderBottom: '2px solid transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
          onClick={() => onTabSwitch("supervisor")}
        >
          AI Supervisor
        </button>
      </div>
      <div className={styles.container} style={{ flexGrow: 1 }}>
        <div className={styles.header}>
          <h3>Your Answers</h3>
          <button 
            onClick={handleSave} 
            className="btn btn-primary btn-sm"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Progress"}
          </button>
        </div>
        <textarea
          className={styles.textarea}
          placeholder="Type your answers here... You can talk to the AI Supervisor on the next tab for hints."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </div>
    </div>
  );
}
