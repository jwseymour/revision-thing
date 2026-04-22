"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SupervisorPanel } from "@/components/workspace/SupervisorPanel";
import { useActiveModule } from "../ModuleContext";
import styles from "./supervisor.module.css";

export default function SupervisorDashboardPage() {
  const { activeModule } = useActiveModule();
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    async function loadSessions() {
      if (!activeModule) return;
      const res = await fetch(`/api/supervisor/session?module=${encodeURIComponent(activeModule)}`);
      if (res.ok) {
        const { sessions: fetchedSessions } = await res.json();
        setSessions(fetchedSessions || []);
        if (fetchedSessions && fetchedSessions.length > 0) {
          setSelectedSessionId(fetchedSessions[0].id);
        } else {
          setSelectedSessionId(null);
        }
      }
    }
    loadSessions();
  }, [activeModule]);

  const handleNewThread = async () => {
    if (!activeModule) return;
    const res = await fetch("/api/supervisor/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: activeModule }),
    });

    if (res.ok) {
      const { session } = await res.json();
      setSessions([session, ...sessions]);
      setSelectedSessionId(session.id);
    }
  };

  if (!activeModule) {
    return (
      <div className={styles.container} style={{ justifyContent: "center", alignItems: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <h2>AI Supervisor</h2>
          <p className="text-muted">Please select a module from the sidebar to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Sidebar Area: Thread Management */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Supervisor Threads</h2>
        </div>

        <button 
          className={`btn btn-primary ${styles.newThreadBtn}`} 
          onClick={handleNewThread}
        >
          + New Thread
        </button>

        <div className={styles.threadList}>
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`${styles.threadItem} ${selectedSessionId === session.id ? styles.activeThread : ""}`}
              onClick={() => setSelectedSessionId(session.id)}
            >
              <div className={styles.threadTitle}>
                 {session.messages && session.messages.length > 1 
                    ? session.messages[1].content.slice(0, 30) + '...'
                    : "New Supervisor Session"
                 }
              </div>
              <div className={styles.threadDate} suppressHydrationWarning>
                {new Date(session.created_at).toLocaleString()}
              </div>
            </button>
          ))}
          
          {sessions.length === 0 && (
            <p className="text-muted" style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.9em" }}>
              No threads yet.
            </p>
          )}
        </div>
      </div>

      {/* Main Area: Supervisor Chat */}
      <div className={styles.mainArea}>
        <SupervisorPanel 
          key={`${activeModule}-${selectedSessionId || 'new'}`} 
          moduleName={activeModule} 
          explicitSessionId={selectedSessionId || undefined} 
        />
      </div>
    </div>
  );
}
