import Link from "next/link";
import { MasteryBar } from "./MasteryBar";
import styles from "./ModuleCard.module.css";

interface ModuleCardProps {
  name: string;
  topicCount: number;
  flashcardCount: number;
  questionCount: number;
  mastery: number;
}

export function ModuleCard({
  name,
  topicCount,
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
        <span className={styles.topicCount}>
          {topicCount} topic{topicCount !== 1 ? "s" : ""}
        </span>
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
