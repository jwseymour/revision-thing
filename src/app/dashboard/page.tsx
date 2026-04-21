import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ResourceCard } from "@/components/ResourceCard";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Student";

  // Fetch all resources
  const { data: resources } = await supabase
    .from("resources")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Separate by type
  const notes = resources?.filter(r => r.type === "notes") || [];
  const pastPapers = resources?.filter(r => r.type === "past_paper") || [];

  return (
    <div className={styles.dashboard}>
      <div className={styles.welcome}>
        <div className={styles.welcomeInfo}>
          <h1>
            Welcome back, <span className="accent-text">{displayName}</span>
          </h1>
          <p className="text-muted">
            Ready to continue studying? Access your notes and past exam papers from your library below.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Lecture Notes</h2>
        {notes.length === 0 ? (
           <p className="text-muted text-sm">No notes uploaded yet. Start by uploading a PDF.</p>
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
           <p className="text-muted text-sm">No past papers available.</p>
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
  );
}
