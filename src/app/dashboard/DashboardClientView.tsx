"use client";

import { useActiveModule } from "./ModuleContext";
import { ResourceCard } from "@/components/ResourceCard";
import styles from "./page.module.css";

interface DashboardClientViewProps {
  displayName: string;
  resources: any[];
}

export function DashboardClientView({ displayName, resources }: DashboardClientViewProps) {
  const { activeModule } = useActiveModule();

  // Filter resources based on active module. If none, show all (or global overview)
  const filteredResources = activeModule 
    ? resources.filter(r => r.module === activeModule)
    : resources;

  const notes = filteredResources.filter(r => r.type === "notes");
  const pastPapers = filteredResources.filter(r => r.type === "past_paper");

  return (
    <div className="page-content" style={{ padding: "var(--space-2xl)", maxWidth: "var(--max-content-width)", margin: "0 auto" }}>
      <div className={styles.dashboard}>
      {!activeModule && (
        <div className={styles.welcome}>
          <div className={styles.welcomeInfo}>
            <h1>
              Welcome back, <span className="accent-text">{displayName}</span>
            </h1>
            <p className="text-muted">
              Select a module from the sidebar to focus your study session, or view all your resources below.
            </p>
          </div>
        </div>
      )}

      {activeModule && (
         <div className={styles.welcome}>
           <div className={styles.welcomeInfo}>
             <h1>
               <span className="accent-text">{activeModule}</span>
             </h1>
             <p className="text-muted">
               Library Notes & Past Papers
             </p>
           </div>
         </div>
      )}

      <div className={styles.section}>
        <h2>Lecture Notes</h2>
        {notes.length === 0 ? (
           <p className="text-muted text-sm">No notes available for this view.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {notes.map((resource) => (
              <ResourceCard
                key={resource.id}
                id={resource.id}
                fileName={resource.file_name}
                module={resource.module}
                type={resource.type}
                fileSizeBytes={resource.file_size_bytes}
                createdAt={resource.created_at}
              />
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2>Past Exam Papers</h2>
        {pastPapers.length === 0 ? (
           <p className="text-muted text-sm">No past papers available for this view.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {pastPapers.map((resource) => (
              <ResourceCard
                key={resource.id}
                id={resource.id}
                fileName={resource.file_name}
                module={resource.module}
                type={resource.type}
                fileSizeBytes={resource.file_size_bytes}
                createdAt={resource.created_at}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
