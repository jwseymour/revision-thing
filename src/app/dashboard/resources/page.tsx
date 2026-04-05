"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ResourceCard } from "@/components/ResourceCard";
import styles from "./resources.module.css";

interface Resource {
  id: string;
  module: string;
  topic: string;
  file_name: string;
  file_size_bytes: number | null;
  status: string;
  created_at: string;
}

interface GroupedResources {
  [module: string]: {
    [topic: string]: Resource[];
  };
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchResources = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("resources")
      .select("id, module, topic, file_name, file_size_bytes, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch resources:", error);
    } else {
      setResources(data || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = useCallback((id: string) => {
    setResources((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleGenerate = useCallback(
    async (resourceId: string) => {
      // Update status locally
      setResources((prev) =>
        prev.map((r) =>
          r.id === resourceId ? { ...r, status: "processing" } : r
        )
      );

      try {
        const res = await fetch("/api/content/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resource_id: resourceId }),
        });

        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Generation failed");
          setResources((prev) =>
            prev.map((r) =>
              r.id === resourceId ? { ...r, status: "error" } : r
            )
          );
          return;
        }

        setResources((prev) =>
          prev.map((r) =>
            r.id === resourceId ? { ...r, status: "ready" } : r
          )
        );
      } catch {
        alert("Generation failed — network error");
        setResources((prev) =>
          prev.map((r) =>
            r.id === resourceId ? { ...r, status: "error" } : r
          )
        );
      }
    },
    []
  );

  // Group resources by module then topic
  const grouped: GroupedResources = {};
  resources.forEach((r) => {
    if (!grouped[r.module]) grouped[r.module] = {};
    if (!grouped[r.module][r.topic]) grouped[r.module][r.topic] = [];
    grouped[r.module][r.topic].push(r);
  });

  const moduleNames = Object.keys(grouped).sort();

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Resources</h1>
          <p className="text-muted">Your uploaded lecture slides and notes</p>
        </div>
        <div className={styles.loading}>
          <span className="spinner" /> Loading resources...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Resources</h1>
          <p className="text-muted">
            Your uploaded lecture slides and notes •{" "}
            {resources.length} file{resources.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/dashboard/upload" className="btn btn-primary">
          Upload More
        </Link>
      </div>

      {resources.length === 0 ? (
        <div className={styles.empty}>
          <p style={{ fontSize: "3rem", marginBottom: "var(--space-lg)" }}>📂</p>
          <h3>No resources yet</h3>
          <p className="text-muted" style={{ marginBottom: "var(--space-xl)" }}>
            Upload your first PDF to get started
          </p>
          <Link href="/dashboard/upload" className="btn btn-primary">
            Upload PDFs
          </Link>
        </div>
      ) : (
        <div className={styles.groups}>
          {moduleNames.map((moduleName) => (
            <div key={moduleName} className={styles.moduleGroup}>
              <h2 className={styles.moduleTitle}>{moduleName}</h2>
              {Object.entries(grouped[moduleName])
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([topicName, topicResources]) => (
                  <div key={topicName} className={styles.topicGroup}>
                    <h3 className={styles.topicTitle}>{topicName}</h3>
                    <div className={styles.resourceList}>
                      {topicResources.map((resource) => (
                        <ResourceCard
                          key={resource.id}
                          id={resource.id}
                          fileName={resource.file_name}
                          module={resource.module}
                          topic={resource.topic}
                          status={resource.status}
                          fileSizeBytes={resource.file_size_bytes}
                          createdAt={resource.created_at}
                          onDelete={handleDelete}
                          onGenerate={handleGenerate}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
