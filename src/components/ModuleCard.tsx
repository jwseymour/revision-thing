import Link from "next/link";
import { MasteryBar } from "./MasteryBar";
import styles from "./ModuleCard.module.css";

interface ModuleCardProps {
  name: string;
  flashcardCount: number;
  questionCount: number;
  mastery: number;
}

export function ModuleCard({
  name,
  flashcardCount,
  questionCount,
  mastery,
}: ModuleCardProps) {
  return (
    <Link
      href={`/dashboard/modules/${encodeURIComponent(name)}`}
      className={styles.card}
    >
      <div className={styles.header}>
        <h3 className={styles.name}>{name}</h3>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{flashcardCount}</span>
          <span className={styles.statLabel}>flashcards</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{questionCount}</span>
          <span className={styles.statLabel}>questions</span>
        </div>
      </div>
      <div className={styles.mastery}>
        <MasteryBar value={mastery} size="sm" />
      </div>
    </Link>
  );
}
