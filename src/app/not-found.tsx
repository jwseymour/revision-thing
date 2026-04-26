import Link from "next/link";
import styles from "./page.module.css"; // Reuse a suitable css or inline

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-geist-sans)"
      }}
    >
      <h1 style={{ fontSize: "3rem", margin: "0" }}>404</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
        We couldn't find the page you were looking for.
      </p>
      <Link
        href="/dashboard"
        style={{
          padding: "10px 20px",
          background: "var(--accent-primary)",
          color: "var(--bg-primary)",
          borderRadius: "6px",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
