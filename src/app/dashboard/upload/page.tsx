"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileDropzone } from "@/components/FileDropzone";
import { TreeView, TreeNodeData } from "@/components/upload/TreeView";
import { createClient } from "@/lib/supabase/client";
import styles from "./upload.module.css";

interface FileEntry {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

interface Resource {
  id: string;
  part: string | null;
  paper: string | null;
  module: string;
  file_path: string;
  type: string;
}

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();
  
  // Data State
  const [resources, setResources] = useState<Resource[]>([]);
  const [virtualNodes, setVirtualNodes] = useState<TreeNodeData[]>([]);
  
  // Interaction State
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  
  // Form Extracted State
  const [part, setPart] = useState("");
  const [paper, setPaper] = useState("");
  const [module, setModule] = useState("");
  const [resourceType, setResourceType] = useState<"notes" | "past_paper">("notes");
  
  // Upload State
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.from("resources").select("id, part, paper, module, file_path, type")
      .then(({ data }) => setResources(data || []));
  }, [supabase]);

  const treeNodes = useMemo(() => {
    const tree: Record<string, any> = {};
    resources.forEach(r => {
        const pt = r.part || "Uncategorised";
        const pp = r.paper || "No Paper";
        const md = r.module;
        if (!tree[pt]) tree[pt] = {};
        if (!tree[pt][pp]) tree[pt][pp] = {};
        tree[pt][pp][md] = true;
    });

    const virtualMap: Record<string, any> = JSON.parse(JSON.stringify(tree)); 
    virtualNodes.forEach(vn => {
       if (vn.level === "part") {
           if (!virtualMap[vn.label]) virtualMap[vn.label] = {};
       } else if (vn.level === "paper") {
           const ptMatch = vn.id.match(/^part:([^|]+)/);
           if (ptMatch) {
               const pt = ptMatch[1];
               if (!virtualMap[pt]) virtualMap[pt] = {};
               virtualMap[pt][vn.label] = virtualMap[pt][vn.label] || {};
           }
       } else if (vn.level === "module") {
           const ptMatch = vn.id.match(/^part:([^|]+)\|paper:([^|]+)/);
           if (ptMatch) {
               const pt = ptMatch[1];
               const pp = ptMatch[2];
               if (!virtualMap[pt]) virtualMap[pt] = {};
               if (!virtualMap[pt][pp]) virtualMap[pt][pp] = {};
               virtualMap[pt][pp][vn.label] = true;
           }
       }
    });

    const output: TreeNodeData[] = [];
    Object.keys(virtualMap).sort().forEach(partName => {
        const paperMap = virtualMap[partName];
        const partNode: TreeNodeData = {
            id: `part:${partName}`,
            label: partName,
            level: "part",
            isVirtual: !tree[partName],
            children: []
        };
        Object.keys(paperMap).sort().forEach(paperName => {
            const modMap = paperMap[paperName];
            const paperNode: TreeNodeData = {
                id: `part:${partName}|paper:${paperName}`,
                label: paperName,
                level: "paper",
                isVirtual: !tree[partName]?.[paperName],
                children: []
            };
            Object.keys(modMap).sort().forEach(modName => {
                paperNode.children.push({
                   id: `part:${partName}|paper:${paperName}|module:${modName}`,
                   label: modName,
                   level: "module",
                   children: [],
                   isVirtual: !tree[partName]?.[paperName]?.[modName],
                });
            });
            partNode.children.push(paperNode);
        });
        output.push(partNode);
    });
    return output;
  }, [resources, virtualNodes]);

  const handleSelectNode = useCallback((node: TreeNodeData) => {
    setActiveNodeId(node.id);
    if (node.level === "module") {
      const match = node.id.match(/^part:([^|]+)\|paper:([^|]+)\|module:([^|]+)/);
      if (match) {
        setPart(match[1]);
        setPaper(match[2]);
        setModule(match[3]);
      }
    } else {
      setPart("");
      setPaper("");
      setModule("");
    }
    // Clear files if switching folders
    setFiles([]);
  }, []);

  const handleAddChild = useCallback((parent: TreeNodeData | null, newName: string) => {
    if (!parent) {
      setVirtualNodes(prev => [...prev, { id: `part:${newName}`, label: newName, level: "part", children: [] }]);
    } else if (parent.level === "part") {
      setVirtualNodes(prev => [...prev, { id: `${parent.id}|paper:${newName}`, label: newName, level: "paper", children: [] }]);
    } else if (parent.level === "paper") {
      setVirtualNodes(prev => [...prev, { id: `${parent.id}|module:${newName}`, label: newName, level: "module", children: [] }]);
    }
  }, []);

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    const entries: FileEntry[] = newFiles.map((file) => ({
      file,
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = async () => {
    if (!part.trim() || !paper.trim() || !module.trim()) return;
    if (files.length === 0) return;

    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setUploading(true);
    setFiles((prev) => prev.map((f) => f.status === "pending" ? { ...f, status: "uploading", progress: 30 } : f));

    try {
      const formData = new FormData();
      formData.append("part", part.trim());
      formData.append("paper", paper.trim());
      formData.append("module", module.trim());
      formData.append("type", resourceType);
      pendingFiles.forEach((entry) => {
        formData.append("files", entry.file);
      });

      setFiles((prev) => prev.map((f) => f.status === "uploading" ? { ...f, progress: 60 } : f));

      const res = await fetch("/api/resources/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setFiles((prev) => prev.map((f) => f.status === "uploading" ? { ...f, status: "error", progress: 0, error: data.error || "Upload failed" } : f));
        setUploading(false);
        return;
      }

      const results = data.results as { file_name: string; status: string; error?: string; }[];
      setFiles((prev) =>
        prev.map((f) => {
          if (f.status !== "uploading") return f;
          const result = results.find((r) => r.file_name === f.file.name);
          if (!result) return { ...f, status: "error", error: "No result returned" };
          if (result.status === "error") return { ...f, status: "error", progress: 0, error: result.error };
          return { ...f, status: "success", progress: 100 };
        })
      );
      
      // Force reload resources list to show newly uploaded files immediately
      supabase.from("resources").select("id, part, paper, module, file_path, type")
        .then(({ data }) => setResources(data || []));
      router.refresh();
    } catch {
      setFiles((prev) => prev.map((f) => f.status === "uploading" ? { ...f, status: "error", progress: 0, error: "Network error" } : f));
    } finally {
      setUploading(false);
    }
  };

  const successCount = files.filter((f) => f.status === "success").length;
  const hasSuccessful = successCount > 0;
  const isModuleActive = !!(activeNodeId && activeNodeId.includes("module:"));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Upload Resources</h1>
        <p className="text-muted">
          Organize lecture slides and notes visually. AI will generate flashcards
          and exam-style questions from your content.
        </p>
      </div>

      <div className={styles.splitLayout}>
        <div className={styles.treePane}>
          <TreeView 
            nodes={treeNodes} 
            activeId={activeNodeId} 
            onSelect={handleSelectNode} 
            onAddChild={handleAddChild}
          />
        </div>

        <div className={styles.workspacePane}>
          {isModuleActive ? (
            <>
              <div className={styles.workspaceHeader}>
                <h2>{module}</h2>
                <div className="text-muted text-sm mono">
                  {part} • {paper}
                </div>
              </div>

              {resources.filter(r => r.module === module && r.part === part && r.paper === paper).length > 0 && (
                <div className="form-group" style={{ marginBottom: "var(--space-xl)", background: "var(--surface-hover)", padding: "var(--space-md)", borderRadius: "var(--radius-md)" }}>
                  <h4 style={{ margin: "0 0 var(--space-sm) 0", fontSize: "0.9rem" }}>Existing Files</h4>
                  <ul style={{ margin: 0, paddingLeft: "var(--space-lg)", fontSize: "0.85rem", color: "var(--text-secondary)"}}>
                    {resources.filter(r => r.module === module && r.part === part && r.paper === paper).map(r => (
                      <li key={r.id} style={{ marginBottom: "4px" }}>
                        <a href={`/dashboard/workspace/${r.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-primary)", textDecoration: "none" }}>{r.file_path.split("/").pop()}</a> <span className="badge badge-warning" style={{ fontSize: "0.6rem" }}>{r.type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="form-group" style={{ marginBottom: "var(--space-xl)" }}>
                <label className="form-label">Resource Type</label>
                <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "4px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input 
                      type="radio" 
                      name="resourceType" 
                      value="notes" 
                      checked={resourceType === "notes"} 
                      onChange={() => setResourceType("notes")} 
                    /> 
                    Lecture Notes / Slides
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input 
                      type="radio" 
                      name="resourceType" 
                      value="past_paper" 
                      checked={resourceType === "past_paper"} 
                      onChange={() => setResourceType("past_paper")} 
                    /> 
                    Past Paper Exam
                  </label>
                </div>
              </div>

              <FileDropzone onFilesSelected={handleFilesSelected} disabled={uploading} />
              
              {/* File List */}
              {files.length > 0 && (
                <div className={styles.fileList}>
                  <div className={styles.fileListHeader}>
                    <h3>Selected Files ({files.length})</h3>
                    {!uploading && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setFiles([])}>Clear All</button>
                    )}
                  </div>
                  {files.map((entry, index) => (
                    <div key={`${entry.file.name}-${index}`} className={styles.fileItem}>
                      <div className={styles.fileInfo}>
                        <span className={styles.fileIcon}>
                          {entry.status === "success" ? "✅" : entry.status === "error" ? "❌" : entry.status === "uploading" ? "⏳" : "📄"}
                        </span>
                        <div className={styles.fileDetails}>
                          <span className={styles.fileName}>{entry.file.name}</span>
                          <span className={styles.fileSize}>{(entry.file.size / (1024 * 1024)).toFixed(1)} MB</span>
                        </div>
                      </div>
                      <div className={styles.fileActions}>
                        {entry.status === "uploading" && (
                          <div className={styles.progressContainer}>
                            <div className={styles.progressBar}>
                              <div className={styles.progressFill} style={{ width: `${entry.progress}%` }} />
                            </div>
                          </div>
                        )}
                        {entry.status === "error" && <span className={styles.errorText}>{entry.error}</span>}
                        {entry.status === "success" && <span className={styles.successText}>Uploaded</span>}
                        {entry.status === "pending" && !uploading && (
                          <button className="btn btn-ghost btn-sm" onClick={() => removeFile(index)} title="Remove file">✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className={styles.actions}>
                {files.some((f) => f.status === "pending") && (
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={handleUpload}
                    disabled={uploading || !part.trim() || !paper.trim() || !module.trim()}
                  >
                    {uploading ? (
                      <><span className="spinner" /> Uploading...</>
                    ) : (
                      `Upload ${files.filter((f) => f.status === "pending").length} File${files.filter((f) => f.status === "pending").length !== 1 ? "s" : ""}`
                    )}
                  </button>
                )}
                {hasSuccessful && (
                  <button className="btn btn-secondary btn-lg" onClick={() => router.push("/dashboard/resources")}>
                    View Resources →
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className={styles.emptyWorkspace}>
              <span className={styles.emptyIcon}>📂</span>
              <h3>Select a Module</h3>
              <p className="text-muted">
                Navigate the Tree View on the left and select (or create) a Module folder to begin uploading documents securely mapped to that hierarchy.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
