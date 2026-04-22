"use client";

import { getMasteryColor } from "@/lib/mastery";
import styles from "./analytics.module.css";

interface ModuleMastery {
  module: string;
  confidence: number;
  dueCount: number;
  totalCards: number;
  trend: "up" | "down" | "flat";
}

interface DayActivity {
  date: string; // YYYY-MM-DD
  count: number;
}

interface ClassificationBreakdown {
  correct_confident: number;
  correct_guessed: number;
  partial: number;
  incorrect: number;
}

interface AnalyticsData {
  streak: {
    current: number;
    longest: number;
    lastPractice: string | null;
  };
  todayReviewed: number;
  totalCards: number;
  totalAttempts: number;
  modules: ModuleMastery[];
  activityHeatmap: DayActivity[];
  classifications: ClassificationBreakdown;
}

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const totalClassifications =
    data.classifications.correct_confident +
    data.classifications.correct_guessed +
    data.classifications.partial +
    data.classifications.incorrect;

  return (
    <div className={styles.analyticsPage}>
      <div className={styles.header}>
        <h1>Analytics</h1>
        <p className="text-muted">Track your learning progress and identify areas for improvement.</p>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>🔥</span>
          <div className={styles.statValue}>{data.streak.current}</div>
          <div className={styles.statLabel}>Day Streak</div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>🏆</span>
          <div className={styles.statValue}>{data.streak.longest}</div>
          <div className={styles.statLabel}>Best Streak</div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>📝</span>
          <div className={styles.statValue}>{data.todayReviewed}</div>
          <div className={styles.statLabel}>Reviewed Today</div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>📚</span>
          <div className={styles.statValue}>{data.totalCards}</div>
          <div className={styles.statLabel}>Total Cards</div>
        </div>
      </div>

      {/* Overall Retention Breakdown */}
      {totalClassifications > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>📊 Overall Retention</h2>
          <div className={styles.retentionContainer}>
            <div className={styles.retentionBar}>
              <div
                className={styles.retentionSegment}
                style={{
                  flex: data.classifications.correct_confident,
                  backgroundColor: "var(--classify-confident)",
                }}
              />
              <div
                className={styles.retentionSegment}
                style={{
                  flex: data.classifications.correct_guessed,
                  backgroundColor: "var(--classify-guessed)",
                }}
              />
              <div
                className={styles.retentionSegment}
                style={{
                  flex: data.classifications.partial,
                  backgroundColor: "var(--classify-partial)",
                }}
              />
              <div
                className={styles.retentionSegment}
                style={{
                  flex: data.classifications.incorrect,
                  backgroundColor: "var(--classify-incorrect)",
                }}
              />
            </div>
            <div className={styles.retentionLabels}>
              <div className={styles.retentionLabelItem}>
                <span className={styles.retentionDot} style={{ backgroundColor: "var(--classify-confident)" }} />
                Confident {totalClassifications > 0 ? Math.round((data.classifications.correct_confident / totalClassifications) * 100) : 0}%
              </div>
              <div className={styles.retentionLabelItem}>
                <span className={styles.retentionDot} style={{ backgroundColor: "var(--classify-guessed)" }} />
                Guessed {totalClassifications > 0 ? Math.round((data.classifications.correct_guessed / totalClassifications) * 100) : 0}%
              </div>
              <div className={styles.retentionLabelItem}>
                <span className={styles.retentionDot} style={{ backgroundColor: "var(--classify-partial)" }} />
                Partial {totalClassifications > 0 ? Math.round((data.classifications.partial / totalClassifications) * 100) : 0}%
              </div>
              <div className={styles.retentionLabelItem}>
                <span className={styles.retentionDot} style={{ backgroundColor: "var(--classify-incorrect)" }} />
                Incorrect {totalClassifications > 0 ? Math.round((data.classifications.incorrect / totalClassifications) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module Mastery Table */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>🎯 Module Mastery</h2>
        {data.modules.length === 0 ? (
          <div className={styles.emptySection}>
            <p>No module data yet. Start reviewing flashcards to see mastery breakdown.</p>
          </div>
        ) : (
          <table className={styles.masteryTable}>
            <thead>
              <tr>
                <th>Module</th>
                <th>Confidence</th>
                <th>Trend</th>
                <th>Due</th>
                <th>Total Cards</th>
              </tr>
            </thead>
            <tbody>
              {data.modules.map((mod) => {
                const color = getMasteryColor(mod.confidence);
                return (
                  <tr key={mod.module}>
                    <td className={styles.moduleCell}>{mod.module}</td>
                    <td className={styles.confidenceCell}>
                      <span className={styles.miniBar}>
                        <span
                          className={styles.miniBarFill}
                          style={{ width: `${mod.confidence}%`, backgroundColor: color }}
                        />
                      </span>
                      <span style={{ color }}>{mod.confidence}%</span>
                    </td>
                    <td>
                      <span className={
                        mod.trend === "up" ? styles.trendUp
                        : mod.trend === "down" ? styles.trendDown
                        : styles.trendFlat
                      }>
                        {mod.trend === "up" ? "↑ Improving" : mod.trend === "down" ? "↓ Declining" : "→ Stable"}
                      </span>
                    </td>
                    <td>
                      {mod.dueCount > 0 ? (
                        <span style={{ color: "var(--status-warning)", fontWeight: 600, fontFamily: "var(--font-geist-mono)", fontSize: "var(--font-size-sm)" }}>
                          {mod.dueCount}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-geist-mono)", fontSize: "var(--font-size-sm)" }}>0</span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-geist-mono)", fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                      {mod.totalCards}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Heatmap */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>📅 Review Activity (Last 90 Days)</h2>
        <div className={styles.heatmapContainer}>
          <ReviewHeatmap days={data.activityHeatmap} />
        </div>
      </div>

      {/* Classification Breakdown */}
      {totalClassifications > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>🧠 Response Distribution</h2>
          <div className={styles.classificationGrid}>
            <ClassificationCard
              label="Confident"
              count={data.classifications.correct_confident}
              total={totalClassifications}
              color="var(--classify-confident)"
            />
            <ClassificationCard
              label="Guessed"
              count={data.classifications.correct_guessed}
              total={totalClassifications}
              color="var(--classify-guessed)"
            />
            <ClassificationCard
              label="Partial"
              count={data.classifications.partial}
              total={totalClassifications}
              color="var(--classify-partial)"
            />
            <ClassificationCard
              label="Incorrect"
              count={data.classifications.incorrect}
              total={totalClassifications}
              color="var(--classify-incorrect)"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ClassificationCard({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className={styles.classificationCard}>
      <div className={styles.classificationValue} style={{ color }}>
        {pct}%
      </div>
      <div className={styles.classificationLabel}>{label}</div>
      <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "var(--font-size-xs)", color: "var(--text-muted)", marginTop: "2px" }}>
        {count} attempt{count !== 1 ? "s" : ""}
      </div>
      <div className={styles.classificationBar} style={{ backgroundColor: color, opacity: 0.3 }}>
        <div style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: "var(--radius-full)" }} />
      </div>
    </div>
  );
}

function ReviewHeatmap({ days }: { days: DayActivity[] }) {
  // Build a 90-day calendar grid
  const now = new Date();
  const dayMap = new Map<string, number>();
  days.forEach((d) => dayMap.set(d.date, d.count));

  // Find max for color scaling
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  // Generate 90 days in reverse
  const allDays: Array<{ date: string; count: number; dayOfWeek: number }> = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    allDays.push({
      date: dateStr,
      count: dayMap.get(dateStr) || 0,
      dayOfWeek: d.getDay(),
    });
  }

  // Group into weeks (columns)
  const weeks: Array<typeof allDays> = [];
  let currentWeek: typeof allDays = [];

  // Pad the first week if it doesn't start on Sunday
  if (allDays.length > 0 && allDays[0].dayOfWeek !== 0) {
    for (let i = 0; i < allDays[0].dayOfWeek; i++) {
      currentWeek.push({ date: "", count: -1, dayOfWeek: i }); // placeholder
    }
  }

  for (const day of allDays) {
    currentWeek.push(day);
    if (day.dayOfWeek === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  function getColor(count: number): string {
    if (count < 0) return "transparent";
    if (count === 0) return "var(--bg-tertiary)";
    const intensity = Math.min(1, count / maxCount);
    if (intensity < 0.25) return "rgba(229, 168, 75, 0.2)";
    if (intensity < 0.5) return "rgba(229, 168, 75, 0.4)";
    if (intensity < 0.75) return "rgba(229, 168, 75, 0.65)";
    return "var(--accent-primary)";
  }

  return (
    <>
      <div className={styles.heatmapGrid}>
        {weeks.map((week, wi) => (
          <div key={wi} className={styles.heatmapWeek}>
            {week.map((day, di) => (
              <div
                key={di}
                className={styles.heatmapDay}
                style={{ backgroundColor: getColor(day.count) }}
                title={day.count >= 0 ? `${day.date}: ${day.count} review${day.count !== 1 ? "s" : ""}` : ""}
              />
            ))}
          </div>
        ))}
      </div>
      <div className={styles.heatmapLegend}>
        <span>Less</span>
        <div className={styles.heatmapLegendBlock} style={{ backgroundColor: "var(--bg-tertiary)" }} />
        <div className={styles.heatmapLegendBlock} style={{ backgroundColor: "rgba(229, 168, 75, 0.2)" }} />
        <div className={styles.heatmapLegendBlock} style={{ backgroundColor: "rgba(229, 168, 75, 0.4)" }} />
        <div className={styles.heatmapLegendBlock} style={{ backgroundColor: "rgba(229, 168, 75, 0.65)" }} />
        <div className={styles.heatmapLegendBlock} style={{ backgroundColor: "var(--accent-primary)" }} />
        <span>More</span>
      </div>
    </>
  );
}
