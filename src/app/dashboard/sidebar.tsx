"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "./dashboard.module.css";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/modules", label: "Modules", icon: "📚" },
  { href: "/dashboard/upload", label: "Upload", icon: "📄" },
  { href: "/dashboard/resources", label: "Resources", icon: "📂" },
  { href: "/dashboard/progress", label: "Progress", icon: "📈" },
];

export function Sidebar({ userName, userEmail }: { userName: string; userEmail: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initial = userName?.charAt(0)?.toUpperCase() || userEmail?.charAt(0)?.toUpperCase() || "?";

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
        style={mobileOpen ? { transform: "translateX(0)" } : undefined}
      >
        <div className={styles["sidebar-header"]}>
          <Link href="/dashboard" className={styles["sidebar-logo"]}>
            tripos
          </Link>
          <ThemeToggle />
        </div>

        <nav className={styles["sidebar-nav"]}>
          <div className={styles["sidebar-section"]}>Menu</div>
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles["sidebar-link"]} ${
                  isActive ? styles["sidebar-link-active"] : ""
                }`}
                onClick={() => setMobileOpen(false)}
              >
                <span className={styles["sidebar-icon"]}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

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
