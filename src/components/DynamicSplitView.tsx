"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle, GroupImperativeHandle } from "react-resizable-panels";
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
  initialShowAI = true
}: DynamicSplitViewProps) {
  const pathname = usePathname();
  const storageKeyOpen = `supervisor-open-${pathname}`;
  const storageKeyWidth = `supervisor-width-${pathname}`;

  // Initialize strictly with initialShowAI to prevent SSR hydration mismatches
  const [showAI, setShowAI] = useState(initialShowAI);

  const groupRef = useRef<GroupImperativeHandle>(null);

  // Sync from localStorage on mount and when pathname changes
  useEffect(() => {
    const storedOpen = localStorage.getItem(storageKeyOpen);
    if (storedOpen !== null) {
      setShowAI(storedOpen === "true");
    } else {
      setShowAI(initialShowAI);
    }

    const storedWidths = localStorage.getItem(storageKeyWidth);
    if (storedWidths !== null) {
      try {
        const layout = JSON.parse(storedWidths);
        // Wait slightly to ensure panels have conditionally rendered before applying layout
        requestAnimationFrame(() => {
          groupRef.current?.setLayout(layout);
        });
      } catch (e) {
        console.error("Failed to apply stored widths");
      }
    }
  }, [storageKeyOpen, storageKeyWidth, initialShowAI]);

  // Keep state synced when user toggles
  const handleToggle = () => {
    const newState = !showAI;
    setShowAI(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKeyOpen, String(newState));
    }
  };

  const handleLayoutChanged = (layout: { [id: string]: number }) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKeyWidth, JSON.stringify(layout));
    }
  };

  useEffect(() => {
    if (explicitSessionId) setShowAI(true);
  }, [explicitSessionId]);

  return (
    <div className={styles.container}>
      <PanelGroup 
        direction="horizontal" 
        groupRef={groupRef}
        onLayoutChanged={handleLayoutChanged}
      >
        <Panel id="main-content" order={1} defaultSize="65" minSize="20" className={styles.mainContent}>
          {moduleName && (
            <button 
              className={`btn btn-secondary btn-sm ${styles.toggleBtn}`} 
              onClick={handleToggle}
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
            <Panel id="supervisor-panel" order={2} defaultSize="35" minSize="20" className={styles.supervisorPanel}>
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
