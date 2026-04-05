/**
 * Mastery level definitions and calculation utilities.
 * Server-safe — no "use client" directive.
 */

export const MASTERY_LEVELS = [
  { min: 0, max: 20, label: "Unseen", color: "var(--mastery-unseen)" },
  { min: 21, max: 40, label: "Fragile", color: "var(--mastery-fragile)" },
  { min: 41, max: 60, label: "Developing", color: "var(--mastery-developing)" },
  { min: 61, max: 80, label: "Solid", color: "var(--mastery-solid)" },
  { min: 81, max: 100, label: "Exam-Ready", color: "var(--mastery-exam-ready)" },
];

export function getMasteryLevel(value: number) {
  return MASTERY_LEVELS.find((l) => value >= l.min && value <= l.max) || MASTERY_LEVELS[0];
}

/**
 * Classification scores for mastery calculation.
 */
const CLASSIFICATION_SCORES: Record<string, number> = {
  confident: 100,
  guessed: 60,
  partial: 30,
  incorrect: 0,
};

/**
 * Calculate new mastery from existing score + a new classification.
 * Weighted moving average: new = (old × 0.7) + (attemptScore × 0.3)
 */
export function calculateMastery(
  currentScore: number,
  classification: string
): number {
  const attemptScore = CLASSIFICATION_SCORES[classification] ?? 0;
  const newScore = currentScore * 0.7 + attemptScore * 0.3;
  return Math.round(Math.max(0, Math.min(100, newScore)));
}

/**
 * Mastery colour for CSS — returns the appropriate hex/var for a score.
 */
export function getMasteryColor(score: number): string {
  if (score <= 20) return "#5e574f";
  if (score <= 40) return "#d97a7a";
  if (score <= 60) return "#e5a84b";
  if (score <= 80) return "#7aaed4";
  return "#7bc47f";
}
