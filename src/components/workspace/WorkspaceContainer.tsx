"use client";

import { useState, useEffect } from "react";
import { PDFViewer } from "./PDFViewer";
import { SupervisorPanel } from "./SupervisorPanel";
import { PastPaperPanel } from "./PastPaperPanel";
import styles from "./Workspace.module.css";
import { createClient } from "@/lib/supabase/client";

interface WorkspaceContainerProps {
  resource: any; // Using any for now, later strongly type to the Supabase row
}

export function WorkspaceContainer({ resource }: WorkspaceContainerProps) {
  const [activeTab, setActiveTab] = useState<"past_paper" | "supervisor">(resource.type === "past_paper" ? "past_paper" : "supervisor");
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const supabase = createClient();

  const fetchWorkspaceData = async () => {
    const [{ data: userCards }, { data: schedules }] = await Promise.all([
      supabase.from("flashcards").select('*').eq("resource_id", resource.id),
      supabase.from("item_scheduling_state").select('item_id, ease_factor, interval_days').eq("item_type", "flashcard")
    ]);
    
    if (userCards) {
      const merged = userCards.map(fc => {
        const state = schedules?.find(s => s.item_id === fc.id);
        return { ...fc, item_scheduling_state: state ? [state] : [] };
      });
      setFlashcards(merged);
    }

    const { data: userAnns } = await supabase
      .from("annotations")
      .select("*")
      .eq("resource_id", resource.id);

    if (userAnns) setAnnotations(userAnns);
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, [resource.id, supabase]);

  return (
    <div className={styles.container}>
      {/* Left Pane: PDF */}
      <div className={styles.leftPane}>
        <PDFViewer 
          filePath={resource.file_path} 
          resourceId={resource.id} 
          flashcards={flashcards}
          annotations={annotations}
          onRefresh={fetchWorkspaceData}
        />
      </div>

      {/* Right Pane: Context & Tools */}
      <div className={styles.rightPane}>
        <div className={styles.tabs}>
          {resource.type === "past_paper" && (
            <button 
              className={`${styles.tab} ${activeTab === "past_paper" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("past_paper")}
            >
              Answers
            </button>
          )}
          <button 
            className={`${styles.tab} ${activeTab === "supervisor" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("supervisor")}
          >
            AI Supervisor
          </button>
        </div>

        <div className={styles.panelContent}>
          {activeTab === "past_paper" && (
            <PastPaperPanel resourceId={resource.id} />
          )}
          {activeTab === "supervisor" && (
            <SupervisorPanel resourceId={resource.id} moduleName={resource.module} />
          )}
        </div>
      </div>
    </div>
  );
}
