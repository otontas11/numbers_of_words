export const INITIAL_HINT_CREDITS = 3;
export const HINT_REWARD_AMOUNT = 3;
export const ACTIVITY_IDLE_TIMEOUT_MS = 15_000;
export const PERFORMANCE_HISTORY_LIMIT = 5;
export const INITIAL_LEARNING_SCORE = 50;

export type DifficultyModifier = -1 | 0 | 1;

export type PuzzlePerformance = {
  activeMs: number;
  hintsUsed: number;
  wrongAttempts: number;
};

export type LearningScore = number;

export type PerformanceRating = 'strong' | 'normal' | 'struggling';

export function ratePuzzlePerformance(
  performance: PuzzlePerformance,
): PerformanceRating {
  if (
    performance.hintsUsed >= 2 ||
    performance.wrongAttempts >= 5 ||
    performance.activeMs >= 120_000
  ) {
    return 'struggling';
  }

  if (
    performance.hintsUsed === 0 &&
    performance.wrongAttempts <= 1 &&
    performance.activeMs <= 45_000
  ) {
    return 'strong';
  }

  return 'normal';
}

export function appendPerformance(
  history: readonly PuzzlePerformance[],
  performance: PuzzlePerformance,
) {
  return [...history, performance].slice(-PERFORMANCE_HISTORY_LIMIT);
}

export function recommendDifficultyModifier(
  history: readonly PuzzlePerformance[],
): DifficultyModifier {
  if (history.length < 3) return 0;

  const score = history.reduce((total, performance) => {
    const rating = ratePuzzlePerformance(performance);
    return total + (rating === 'strong' ? 1 : rating === 'struggling' ? -1 : 0);
  }, 0);

  if (score >= 3) return 1;
  if (score <= -2) return -1;
  return 0;
}

/** Converts one completed puzzle into a 1–100 performance signal. */
export function scorePuzzlePerformance(performance: PuzzlePerformance): number {
  const timePenalty = Math.min(35, Math.round((performance.activeMs / 120_000) * 35));
  const hintPenalty = Math.min(30, performance.hintsUsed * 10);
  const mistakePenalty = Math.min(30, performance.wrongAttempts * 6);
  return Math.max(1, Math.min(100, 100 - timePenalty - hintPenalty - mistakePenalty));
}

/** Smoothly updates the score so a single difficult puzzle cannot swing it wildly. */
export function updateLearningScore(current: number, performance: PuzzlePerformance): number {
  const next = current * 0.75 + scorePuzzlePerformance(performance) * 0.25;
  return Math.max(1, Math.min(100, Math.round(next)));
}

export function difficultyModifierFromLearningScore(score: number): DifficultyModifier {
  if (score >= 66) return 1;
  if (score <= 35) return -1;
  return 0;
}

export function learningScoreLabel(score: number): PerformanceRating {
  if (score >= 66) return 'strong';
  if (score <= 35) return 'struggling';
  return 'normal';
}

export function isPuzzlePerformance(value: unknown): value is PuzzlePerformance {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.activeMs === 'number' &&
    Number.isFinite(item.activeMs) &&
    item.activeMs >= 0 &&
    Number.isInteger(item.hintsUsed) &&
    Number(item.hintsUsed) >= 0 &&
    Number.isInteger(item.wrongAttempts) &&
    Number(item.wrongAttempts) >= 0
  );
}
