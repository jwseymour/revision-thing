export default function ProgressPage() {
  return (
    <div>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h1>Progress</h1>
        <p className="text-muted">
          Track your mastery across all modules and topics
        </p>
      </div>
      <div className="card" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
        <p style={{ fontSize: "3rem", marginBottom: "var(--space-lg)" }}>📈</p>
        <h3 style={{ marginBottom: "var(--space-sm)" }}>No progress data yet</h3>
        <p className="text-muted">
          Complete practice sessions to see your mastery scores and progress
          tracked here.
        </p>
      </div>
    </div>
  );
}
