"use client";

import { useState, useEffect } from "react";
import styles from "./PastPaperPanel.module.css";
import { createClient } from "@/lib/supabase/client";

interface PastPaperPanelProps {
  resourceId: string;
}

export function PastPaperPanel({ resourceId }: PastPaperPanelProps) {
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
    <div className={styles.container}>
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
  );
}
