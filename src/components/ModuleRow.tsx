import Link from "next/link";
import { MasteryBar } from "./MasteryBar";
import styles from "./ModuleRow.module.css";

interface ModuleRowProps {
  moduleName: string;
  flashcardCount: number;
  questionCount: number;
  mastery: number;
  lastPracticed: string | null;
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ModuleRow({
  moduleName,
  flashcardCount,
  questionCount,
  mastery,
  lastPracticed,
}: ModuleRowProps) {
  const contentUrl = `/dashboard/content/${encodeURIComponent(moduleName)}`;

  return (
    <div className={styles.row}>
      <div className={styles.info}>
        <Link href={contentUrl} className={styles.name}>
          {moduleName}
        </Link>
        <div className={styles.stats}>
          <span>{flashcardCount} flashcards</span>
          <span>•</span>
          <span>{questionCount} questions</span>
          <span>•</span>
          <span>Last: {formatRelativeDate(lastPracticed)}</span>
        </div>
      </div>
      <div className={styles.masteryCol}>
        <MasteryBar value={mastery} size="sm" />
      </div>
      <div className={styles.actions}>
        <Link
          href={`/dashboard/practice/${encodeURIComponent(moduleName)}`}
          className="btn btn-primary btn-sm"
        >
          Practice
        </Link>
        <Link
          href={contentUrl}
          className="btn btn-secondary btn-sm"
        >
          View
        </Link>
      </div>
    </div>
  );
}
