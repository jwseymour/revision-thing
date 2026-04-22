"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StudyTimer } from "@/components/StudyTimer";
import { useActiveModule } from "./ModuleContext";
import { createClient } from "@/lib/supabase/client";
import styles from "./dashboard.module.css";

const globalNavItems = [
  { href: "/dashboard/review", label: "Daily Review", icon: "🗓️" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📈" },
  { href: "/dashboard/upload", label: "Admin Upload", icon: "📄" },
];

const contextualNavItems = [
  { href: "/dashboard", label: "Notes & Papers", icon: "📚" }, // Reuse overview path but context handles it via activeModule
  { href: "/dashboard/flashcards", label: "Flashcards", icon: "🗂️" },
  { href: "/dashboard/supervisor", label: "AI Supervisor", icon: "🤖" },
];

export function Sidebar({ userName, userEmail }: { userName: string; userEmail: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeModule, setActiveModule } = useActiveModule();
  const [hierarchy, setHierarchy] = useState<Record<string, Record<string, string[]>>>({});
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());
  const [expandedPapers, setExpandedPapers] = useState<Set<string>>(new Set());
  const [isModuleSelectorOpen, setIsModuleSelectorOpen] = useState(false);

  const initial = userName?.charAt(0)?.toUpperCase() || userEmail?.charAt(0)?.toUpperCase() || "?";

  useEffect(() => {
    const fetchHierarchy = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('resources').select('part, paper, module');
      
      if (data) {
        const tree: Record<string, Record<string, Set<string>>> = {};
        data.forEach(row => {
          const pt = row.part || 'Uncategorized';
          const pp = row.paper || 'Uncategorized';
          const md = row.module;
          
          if (!tree[pt]) tree[pt] = {};
          if (!tree[pt][pp]) tree[pt][pp] = new Set();
          if (md) tree[pt][pp].add(md);
        });

        const formattedTree: Record<string, Record<string, string[]>> = {};
        for (const pt in tree) {
          formattedTree[pt] = {};
          for (const pp in tree[pt]) {
            formattedTree[pt][pp] = Array.from(tree[pt][pp]);
          }
        }
        setHierarchy(formattedTree);
      }
    };
    fetchHierarchy();
  }, []);

  const togglePart = (part: string) => {
    const newExp = new Set(expandedParts);
    if (newExp.has(part)) newExp.delete(part);
    else newExp.add(part);
    setExpandedParts(newExp);
  };

  const togglePaper = (paper: string) => {
    const newExp = new Set(expandedPapers);
    if (newExp.has(paper)) newExp.delete(paper);
    else newExp.add(paper);
    setExpandedPapers(newExp);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className={styles["sidebar-overlay"]}
          style={{ display: "block" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={styles.sidebar}
        style={{ ...(mobileOpen ? { transform: "translateX(0)" } : {}), display: "flex", flexDirection: "column" }}
      >
        <div className={styles["sidebar-header"]}>
          <Link href="/dashboard" className={styles["sidebar-logo"]}>
            tripos
          </Link>
          <ThemeToggle />
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          
          {/* Study Timer */}
          <StudyTimer />
          <div style={{ width: "calc(100% - 2rem)", height: "1px", background: "var(--border-subtle)", margin: "0.25rem auto" }} />

          {/* Section 1: Global */}
          <nav className={styles["sidebar-nav"]} style={{ paddingBottom: 0 }}>
            <div className={styles["sidebar-section"]}>Global</div>
            {globalNavItems.map((item) => {
              // Exact match for global items, unless it's the specific pages
              const isActive = item.href === "/dashboard" 
                ? (pathname === "/dashboard" && !activeModule)
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles["sidebar-link"]} ${isActive ? styles["sidebar-link-active"] : ""}`}
                  onClick={() => {
                    setMobileOpen(false);
                  }}
                >
                  <span className={styles["sidebar-icon"]}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Section 2: Hierarchy */}
          <nav className={styles["sidebar-nav"]} style={{ paddingTop: 0, paddingBottom: 0 }}>
            <div className={styles["sidebar-section"]}>Module Selector</div>
            <div 
              style={{
                cursor: "pointer", 
                padding: "8px 12px", 
                background: "var(--bg-tertiary)", 
                borderRadius: "6px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 8px"
              }}
              onClick={() => setIsModuleSelectorOpen(!isModuleSelectorOpen)}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeModule || "Select a module..."}
              </span>
              <span>{isModuleSelectorOpen ? "▲" : "▼"}</span>
            </div>

            {isModuleSelectorOpen && (
              <div style={{ paddingLeft: "16px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {Object.keys(hierarchy).map(part => (
                  <div key={part}>
                    <div 
                      onClick={() => togglePart(part)}
                      style={{ cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, padding: "4px 0", color: "var(--text-secondary)" }}
                    >
                      {expandedParts.has(part) ? "📂" : "📁"} {part}
                    </div>
                    {expandedParts.has(part) && (
                      <div style={{ paddingLeft: "12px", borderLeft: "1px solid var(--border-default)", marginLeft: "6px" }}>
                        {Object.keys(hierarchy[part]).map(paper => (
                          <div key={paper}>
                            <div 
                              onClick={() => togglePaper(paper)}
                              style={{ cursor: "pointer", fontSize: "0.8rem", padding: "4px 0", color: "var(--text-tertiary)" }}
                            >
                              {expandedPapers.has(paper) ? "📂" : "📁"} {paper}
                            </div>
                            {expandedPapers.has(paper) && (
                              <div style={{ paddingLeft: "12px", borderLeft: "1px solid var(--border-default)", marginLeft: "6px", marginBottom: "4px" }}>
                                {hierarchy[part][paper].map(mod => (
                                  <div 
                                    key={mod}
                                    onClick={() => {
                                      setActiveModule(mod);
                                      setIsModuleSelectorOpen(false);
                                      setMobileOpen(false);
                                    }}
                                    style={{
                                      cursor: "pointer",
                                      fontSize: "0.8rem",
                                      padding: "6px 8px",
                                      borderRadius: "4px",
                                      background: activeModule === mod ? "var(--bg-tertiary)" : "transparent",
                                      color: activeModule === mod ? "var(--accent-primary)" : "var(--text-primary)",
                                    }}
                                  >
                                    {mod}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </nav>

          {/* Section 3: Contextual Tools */}
          {activeModule && (
            <nav className={styles["sidebar-nav"]} style={{ paddingTop: 0 }}>
              <div className={styles["sidebar-section"]}>Contextual Tools</div>
              {contextualNavItems.map((item) => {
                const isActive = item.href === "/dashboard"
                  ? (pathname === "/dashboard" && activeModule !== null)
                  : pathname.startsWith(item.href);

                return (
                  <Link
                    key={`ctx-${item.href}`}
                    href={item.href}
                    className={`${styles["sidebar-link"]} ${isActive ? styles["sidebar-link-active"] : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className={styles["sidebar-icon"]}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

        </div>

        <div className={styles["sidebar-footer"]}>
          <div className={styles["sidebar-user"]}>
            <div className={styles["sidebar-avatar"]}>{initial}</div>
            <div className={styles["sidebar-user-info"]}>
              <div className={styles["sidebar-user-name"]}>{userName}</div>
              <div className={styles["sidebar-user-email"]}>{userEmail}</div>
            </div>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn btn-ghost btn-sm" style={{ width: "100%" }}>
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      <button
        className={styles["mobile-menu-btn"]}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
        style={{
          position: "fixed",
          top: "var(--space-md)",
          left: "var(--space-md)",
          zIndex: 200,
        }}
      >
        {mobileOpen ? "✕" : "☰"}
      </button>
    </>
  );
}
