import { getMasteryColor } from "@/lib/mastery";
import Link from "next/link";
import styles from "./MasteryHeatmap.module.css";

interface ModuleCell {
  moduleName: string;
  score: number;
}

interface MasteryHeatmapProps {
  modules: ModuleCell[];
}

export function MasteryHeatmap({ modules }: MasteryHeatmapProps) {
  if (modules.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {modules.map((m) => (
          <Link
            key={m.moduleName}
            href={`/dashboard/practice/${encodeURIComponent(m.moduleName)}`}
            className={styles.cell}
            style={{ backgroundColor: getMasteryColor(m.score) }}
            title={`${m.moduleName} — ${m.score}%`}
          >
            <span className={styles.cellLabel}>{m.moduleName}</span>
          </Link>
        ))}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#5e574f" }} />
          Unseen
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#d97a7a" }} />
          Fragile
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#e5a84b" }} />
          Developing
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#7aaed4" }} />
          Solid
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#7bc47f" }} />
          Exam-Ready
        </span>
      </div>
    </div>
  );
}
