import Link from "next/link";

export default function ModulesPage() {
  return (
    <div>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h1>Modules</h1>
        <p className="text-muted">Browse your modules and topics</p>
      </div>
      <div className="card" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
        <p style={{ fontSize: "3rem", marginBottom: "var(--space-lg)" }}>📚</p>
        <h3 style={{ marginBottom: "var(--space-sm)" }}>No modules yet</h3>
        <p className="text-muted" style={{ marginBottom: "var(--space-xl)" }}>
          Upload your first PDF to create a module and generate revision material.
        </p>
        <Link href="/dashboard/upload" className="btn btn-primary">
          Upload PDFs
        </Link>
      </div>
    </div>
  );
}
