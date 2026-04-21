import Link from "next/link";
import { getMasteryLevel } from "@/lib/mastery";
import styles from "./WeakModulesList.module.css";

interface WeakModule {
  moduleName: string;
  score: number;
  totalItems: number;
}

interface WeakModulesListProps {
  modules: WeakModule[];
  limit?: number;
}

export function WeakModulesList({ modules, limit = 8 }: WeakModulesListProps) {
  const sorted = [...modules].sort((a, b) => a.score - b.score).slice(0, limit);

  if (sorted.length === 0) return null;

  return (
    <div className={styles.container}>
      {sorted.map((t) => {
        const level = getMasteryLevel(t.score);
        return (
          <div key={t.moduleName} className={styles.row}>
            <div className={styles.info}>
              <span className={styles.module}>{t.moduleName}</span>
            </div>
            <span className={styles.score} style={{ color: level.color }}>
              {level.label} ({t.score}%)
            </span>
            <Link
              href={`/dashboard/practice/${encodeURIComponent(t.moduleName)}`}
              className="btn btn-primary btn-sm"
            >
              Practice
            </Link>
          </div>
        );
      })}
    </div>
  );
}
