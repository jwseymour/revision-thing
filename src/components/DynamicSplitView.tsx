"use client";

import { ReactNode, useState, useEffect } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { SupervisorPanel } from "./workspace/SupervisorPanel";
import styles from "./DynamicSplitView.module.css";

interface DynamicSplitViewProps {
  children: ReactNode;
  moduleName?: string | null;
  resourceId?: string;
  explicitSessionId?: string;
  initialShowAI?: boolean;
}

export function DynamicSplitView({ 
  children, 
  moduleName, 
  resourceId, 
  explicitSessionId,
  initialShowAI = false
}: DynamicSplitViewProps) {
  const [showAI, setShowAI] = useState(initialShowAI);

  useEffect(() => {
    if (explicitSessionId) setShowAI(true);
  }, [explicitSessionId]);

  return (
    <div className={styles.container}>
      <PanelGroup direction="horizontal">
        <Panel className={styles.mainContent}>
          {moduleName && (
            <button 
              className={`btn btn-secondary btn-sm ${styles.toggleBtn}`} 
              onClick={() => setShowAI(!showAI)}
            >
              {showAI ? "Hide AI Supervisor" : "Open AI Supervisor"}
            </button>
          )}
          <div className={styles.innerContent}>
            {children}
          </div>
        </Panel>

        {showAI && moduleName && (
          <>
            <PanelResizeHandle className={styles.resizeHandle}>
               <div className={styles.resizeHandleInner} />
            </PanelResizeHandle>
            <Panel defaultSize={45} minSize={25} className={styles.supervisorPanel}>
              <SupervisorPanel 
                  key={`${moduleName}-${explicitSessionId || 'new'}`} 
                  moduleName={moduleName} 
                  resourceId={resourceId}
                  explicitSessionId={explicitSessionId}
                  hasPastPaper={false}
                  onTabSwitch={() => {}}
              />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}
