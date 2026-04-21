"use client";

import { useState } from "react";
import styles from "./TreeView.module.css";

export interface TreeNodeData {
  id: string; // Globally unique identifier for active selection matching
  label: string;
  level: "part" | "paper" | "module";
  children: TreeNodeData[];
  isVirtual?: boolean;
}

interface TreeViewProps {
  nodes: TreeNodeData[];
  activeId: string | null;
  onSelect: (node: TreeNodeData) => void;
  onAddChild: (parentNode: TreeNodeData | null, newName: string) => void;
}

export function TreeView({ nodes, activeId, onSelect, onAddChild }: TreeViewProps) {
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const handleAddSubmit = (e: React.FormEvent, parent: TreeNodeData | null) => {
    e.preventDefault();
    if (newNodeName.trim()) {
      onAddChild(parent, newNodeName.trim());
    }
    setAddingTo(null);
    setNewNodeName("");
  };

  const renderNode = (node: TreeNodeData, depth: number) => {
    const isActive = activeId === node.id;
    // Expanded by default unless explicitly false
    const isExpanded = expandedNodes[node.id] !== false;

    return (
      <div key={node.id} className={styles.nodeContainer}>
        <div 
          className={`${styles.nodeRow} ${isActive ? styles.active : ""}`}
          style={{ paddingLeft: `${depth * 1.5}rem` }}
          onClick={() => onSelect(node)}
        >
          <div 
            className={styles.toggle} 
            onClick={(e) => { 
                e.stopPropagation(); 
                setExpandedNodes(prev => ({ ...prev, [node.id]: !isExpanded })); 
            }}
          >
            {node.children.length > 0 ? (isExpanded ? "▼" : "▶") : <span className={styles.bullet}>•</span>}
          </div>
          
          <span className={styles.icon}>
            {node.level === "part" ? "📚" : node.level === "paper" ? "📄" : "📁"}
          </span>
          <span className={styles.label}>{node.label}</span>
          
          {node.isVirtual && <span className={styles.virtualBadge}>New</span>}
          
          {node.level !== "module" && (
            <button 
              className={styles.addBtn}
              onClick={(e) => {
                e.stopPropagation();
                setAddingTo(node.id);
                setExpandedNodes(prev => ({ ...prev, [node.id]: true })); // Force open if closed
              }}
            >
              +
            </button>
          )}
        </div>

        {isExpanded && (
          <div className={styles.children}>
            {node.children.map(child => renderNode(child, depth + 1))}
            
            {addingTo === node.id && (
              <form 
                className={styles.addForm} 
                style={{ paddingLeft: `${(depth + 1) * 1.5}rem` }}
                onSubmit={(e) => handleAddSubmit(e, node)}
              >
                <span className={styles.icon}>
                  {node.level === "part" ? "📄" : "📁"}
                </span>
                <input
                  type="text"
                  autoFocus
                  placeholder={`New ${node.level === "part" ? "Paper" : "Module"}...`}
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  onBlur={() => setAddingTo(null)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setAddingTo(null); }}
                />
              </form>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.tree}>
      <div className={styles.treeHeader}>
        <h3>Resource Explorer</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setAddingTo("root")}>
          + Part
        </button>
      </div>

      <div className={styles.treeBody}>
        {nodes.length === 0 && addingTo !== "root" && (
          <div className="text-muted text-sm text-center" style={{ padding: "1rem" }}>
            No resources. Add a Part to begin.
          </div>
        )}
        
        {addingTo === "root" && (
          <form 
            className={styles.addForm} 
            onSubmit={(e) => handleAddSubmit(e, null)}
          >
            <span className={styles.icon}>📚</span>
            <input
              type="text"
              autoFocus
              placeholder="New Part..."
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              onBlur={() => setAddingTo(null)}
              onKeyDown={(e) => { if (e.key === 'Escape') setAddingTo(null); }}
            />
          </form>
        )}

        {nodes.map(node => renderNode(node, 0))}
      </div>
    </div>
  );
}
