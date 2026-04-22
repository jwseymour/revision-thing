"use client";

import { useState, useEffect } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { PDFViewer } from "./PDFViewer";
import { SupervisorPanel } from "./SupervisorPanel";
import { PastPaperPanel } from "./PastPaperPanel";
import resizeStyles from "@/components/DynamicSplitView.module.css";
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
      <PanelGroup direction="horizontal">
        {/* Left Pane: PDF */}
        <Panel className={styles.leftPane}>
          <PDFViewer 
            filePath={resource.file_path} 
            resourceId={resource.id} 
            flashcards={flashcards}
            annotations={annotations}
            onRefresh={fetchWorkspaceData}
          />
        </Panel>

        <PanelResizeHandle className={resizeStyles.resizeHandle}>
            <div className={resizeStyles.resizeHandleInner} />
        </PanelResizeHandle>

        {/* Right Pane: Context & Tools */}
        <Panel defaultSize={45} minSize={25} className={styles.rightPane} style={{ width: "100%" }}>
            {activeTab === "past_paper" && (
              <PastPaperPanel 
                 resourceId={resource.id} 
                 onTabSwitch={setActiveTab}
              />
            )}
            {activeTab === "supervisor" && (
              <SupervisorPanel 
                 resourceId={resource.id} 
                 moduleName={resource.module} 
                 hasPastPaper={resource.type === "past_paper"}
                 onTabSwitch={setActiveTab}
              />
            )}
        </Panel>
      </PanelGroup>
    </div>
  );
}
