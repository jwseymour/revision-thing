"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SupervisorPanel } from "@/components/workspace/SupervisorPanel";
import styles from "./supervisor.module.css";

export default function SupervisorDashboardPage() {
  const [modules, setModules] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    async function loadModules() {
      // Get all resources to extract unique modules the user interacts with
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("resources")
        .select("module");

      if (data) {
        const uniqueModules = Array.from(new Set(data.map((r) => r.module))).filter(Boolean);
        setModules(uniqueModules);
        if (uniqueModules.length > 0) {
          setSelectedModule(uniqueModules[0]);
        }
      }
    }
    loadModules();
  }, [supabase]);

  useEffect(() => {
    async function loadSessions() {
      if (!selectedModule) return;
      const res = await fetch(`/api/supervisor/session?module=${encodeURIComponent(selectedModule)}`);
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
  }, [selectedModule]);

  const handleNewThread = async () => {
    if (!selectedModule) return;
    const res = await fetch("/api/supervisor/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: selectedModule }),
    });

    if (res.ok) {
      const { session } = await res.json();
      setSessions([session, ...sessions]);
      setSelectedSessionId(session.id);
    }
  };

  return (
    <div className={styles.container}>
      {/* Sidebar Area: Thread Management */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Supervisor Threads</h2>
          {modules.length > 0 ? (
            <select
              className={styles.moduleSelect}
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
            >
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-muted" style={{ fontSize: "0.8em" }}>No modules available.</p>
          )}
        </div>

        <button 
          className={`btn btn-primary ${styles.newThreadBtn}`} 
          onClick={handleNewThread}
          disabled={!selectedModule}
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
          
          {sessions.length === 0 && selectedModule && (
            <p className="text-muted" style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.9em" }}>
              No threads yet.
            </p>
          )}
        </div>
      </div>

      {/* Main Area: Supervisor Chat */}
      <div className={styles.mainArea}>
        {selectedModule ? (
           // Render with a key based on explicitSessionId so it safely remounts explicitly when thread changes
          <SupervisorPanel 
            key={`${selectedModule}-${selectedSessionId || 'new'}`} 
            moduleName={selectedModule} 
            explicitSessionId={selectedSessionId || undefined} 
          />
        ) : (
          <div className={styles.emptyState}>
            <h3>Select a module to begin a supervision.</h3>
          </div>
        )}
      </div>
    </div>
  );
}
