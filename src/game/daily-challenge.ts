import { findSolutionIndices, type Operation, type Target } from './levels.ts';

/** Three short puzzles make up a single daily challenge. */
export const DAILY_CHALLENGE_PUZZLE_COUNT = 3;

/** Rewards are intentionally small and independent from the regular level economy. */
export const DAILY_CHALLENGE_BASE_REWARD = 15;
export const DAILY_CHALLENGE_ALL_BONUS_REWARD = 4;
export const DAILY_CHALLENGE_NO_HINT_REWARD = 2;

export const DAILY_CHALLENGE_REWARDS = {
  base: DAILY_CHALLENGE_BASE_REWARD,
  allBonuses: DAILY_CHALLENGE_ALL_BONUS_REWARD,
  noHint: DAILY_CHALLENGE_NO_HINT_REWARD,
} as const;

export type DailyPuzzle = {
  /** Stable across launches, so it can safely be persisted as completion state. */
  id: string;
  numbers: number[];
  op: Operation;
  target: Target;
  bonusTarget: Target;
};

export type DailyChallengePack = {
  id: string;
  puzzles: readonly DailyPuzzle[];
};

export type DailyChallenge = {
  /** Local calendar date, never a UTC ISO timestamp. */
  dateKey: string;
  packId: string;
  puzzles: DailyPuzzle[];
  rewards: typeof DAILY_CHALLENGE_REWARDS;
};

export type DailyChallengeProgress = {
  dateKey: string;
  completedPuzzleIds: string[];
  completedBonusPuzzleIds: string[];
  usedHint: boolean;
  claimed: boolean;
  streak: number;
  lastCompletedDate: string | null;
};

export type DailyChallengeReward = {
  baseReward: number;
  allBonusesReward: number;
  noHintReward: number;
  total: number;
};

type DailyTargetDefinition = readonly [value: number, steps: 2 | 3 | 4];

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function makeTarget(
  op: Operation,
  [value, steps]: DailyTargetDefinition,
): Target {
  return { value, steps, op };
}

function makePuzzle(
  id: string,
  numbers: number[],
  op: Operation,
  target: DailyTargetDefinition,
  bonusTarget: DailyTargetDefinition,
): DailyPuzzle {
  return {
    id,
    numbers,
    op,
    target: makeTarget(op, target),
    bonusTarget: makeTarget(op, bonusTarget),
  };
}

/**
 * These packages are deliberately static. The local calendar selects a package
 * deterministically, while the individual puzzle ids remain stable for storage.
 */
export const DAILY_CHALLENGE_PACKS: readonly DailyChallengePack[] = [
  {
    id: 'sunrise',
    puzzles: [
      makePuzzle('sunrise-1', [2, 3, 4, 5, 6], '+', [9, 2], [11, 2]),
      makePuzzle('sunrise-2', [12, 8, 5, 3, 2], '-', [7, 2], [5, 2]),
      makePuzzle('sunrise-3', [2, 3, 4, 5, 6], '*', [12, 2], [30, 2]),
    ],
  },
  {
    id: 'harbor',
    puzzles: [
      makePuzzle('harbor-1', [24, 6, 4, 3, 2], '/', [4, 2], [3, 2]),
      makePuzzle('harbor-2', [3, 4, 5, 6, 7], '+', [15, 3], [10, 2]),
      makePuzzle('harbor-3', [20, 9, 6, 4, 2], '-', [11, 2], [5, 2]),
    ],
  },
  {
    id: 'observatory',
    puzzles: [
      makePuzzle('observatory-1', [2, 3, 4, 5, 6], '*', [24, 2], [30, 2]),
      makePuzzle('observatory-2', [36, 6, 3, 2, 4], '/', [6, 2], [3, 2]),
      makePuzzle('observatory-3', [5, 7, 8, 9, 4], '+', [20, 3], [13, 2]),
    ],
  },
  {
    id: 'garden',
    puzzles: [
      makePuzzle('garden-1', [18, 11, 7, 4, 2], '-', [7, 2], [9, 2]),
      makePuzzle('garden-2', [3, 4, 5, 6, 7], '*', [20, 2], [42, 2]),
      makePuzzle('garden-3', [48, 8, 6, 4, 2], '/', [6, 2], [2, 2]),
    ],
  },
  {
    id: 'market',
    puzzles: [
      makePuzzle('market-1', [1, 2, 3, 4, 5], '+', [9, 2], [6, 3]),
      makePuzzle('market-2', [15, 9, 6, 4, 2], '-', [9, 2], [5, 2]),
      makePuzzle('market-3', [2, 3, 4, 5, 7], '*', [21, 2], [20, 2]),
    ],
  },
  {
    id: 'summit',
    puzzles: [
      makePuzzle('summit-1', [60, 12, 5, 3, 2], '/', [5, 2], [6, 2]),
      makePuzzle('summit-2', [6, 7, 8, 9, 10], '+', [24, 3], [16, 2]),
      makePuzzle('summit-3', [25, 12, 8, 5, 3], '-', [13, 2], [5, 2]),
    ],
  },
  {
    id: 'starlight',
    puzzles: [
      makePuzzle('starlight-1', [4, 5, 6, 7, 8], '*', [35, 2], [48, 2]),
      makePuzzle('starlight-2', [72, 12, 6, 4, 3], '/', [6, 2], [3, 2]),
      makePuzzle('starlight-3', [8, 9, 10, 11, 12], '+', [30, 3], [21, 2]),
    ],
  },
];

function formatDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function formatUtcDateKey(date: Date) {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${formatDatePart(
    date.getUTCMonth() + 1,
  )}-${formatDatePart(date.getUTCDate())}`;
}

function getUtcDateFromKey(dateKey: string) {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // setUTCFullYear avoids Date.UTC's special 1900 offset for years 0–99.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

/** Returns a stable key from the device's local calendar, e.g. `2026-09-06`. */
export function getLocalDateKey(date: Date = new Date()) {
  if (!Number.isFinite(date.getTime())) return getLocalDateKey();

  return `${String(date.getFullYear()).padStart(4, '0')}-${formatDatePart(
    date.getMonth() + 1,
  )}-${formatDatePart(date.getDate())}`;
}

export const getDailyChallengeDateKey = getLocalDateKey;

export function isDailyChallengeDateKey(value: unknown): value is string {
  return typeof value === 'string' && getUtcDateFromKey(value) !== null;
}

/** Invalid external keys fall back to today's local key instead of throwing. */
export function normalizeDailyChallengeDateKey(value: unknown) {
  return isDailyChallengeDateKey(value) ? value : getLocalDateKey();
}

function getChallengeDayIndex(dateKey: string) {
  const date = getUtcDateFromKey(dateKey);
  // The public caller has already normalized this key. Keeping a fallback here
  // makes this helper total should it ever be used from within this module.
  return date ? Math.floor(date.getTime() / DAY_IN_MILLISECONDS) : 0;
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function clonePuzzle(puzzle: DailyPuzzle): DailyPuzzle {
  return {
    ...puzzle,
    numbers: [...puzzle.numbers],
    target: { ...puzzle.target },
    bonusTarget: { ...puzzle.bonusTarget },
  };
}

/** Selects one of the static packs from a local calendar date. */
export function getDailyChallenge(dateKey: string = getLocalDateKey()): DailyChallenge {
  const normalizedDateKey = normalizeDailyChallengeDateKey(dateKey);
  const packIndex = positiveModulo(
    getChallengeDayIndex(normalizedDateKey),
    DAILY_CHALLENGE_PACKS.length,
  );
  const pack = DAILY_CHALLENGE_PACKS[packIndex];

  return {
    dateKey: normalizedDateKey,
    packId: pack.id,
    puzzles: pack.puzzles.map(clonePuzzle),
    rewards: { ...DAILY_CHALLENGE_REWARDS },
  };
}

export function getDailyChallengeForDate(date: Date = new Date()) {
  return getDailyChallenge(getLocalDateKey(date));
}

export const getDailyChallengeForDateKey = getDailyChallenge;

export function getPreviousDailyChallengeDateKey(dateKey: string) {
  const date = getUtcDateFromKey(normalizeDailyChallengeDateKey(dateKey));
  if (!date) return getLocalDateKey();
  return formatUtcDateKey(new Date(date.getTime() - DAY_IN_MILLISECONDS));
}

export function createDailyChallengeProgress(
  dateKey: string = getLocalDateKey(),
): DailyChallengeProgress {
  return {
    dateKey: normalizeDailyChallengeDateKey(dateKey),
    completedPuzzleIds: [],
    completedBonusPuzzleIds: [],
    usedHint: false,
    claimed: false,
    streak: 0,
    lastCompletedDate: null,
  };
}

export function isDailyChallengeComplete(
  progress: Pick<DailyChallengeProgress, 'completedPuzzleIds'>,
  challenge: DailyChallenge,
) {
  const completedIds = new Set(progress.completedPuzzleIds);
  return challenge.puzzles.every((puzzle) => completedIds.has(puzzle.id));
}

export function areAllDailyChallengeBonusesCompleted(
  progress: Pick<DailyChallengeProgress, 'completedBonusPuzzleIds'>,
  challenge: DailyChallenge,
) {
  const completedIds = new Set(progress.completedBonusPuzzleIds);
  return challenge.puzzles.every((puzzle) => completedIds.has(puzzle.id));
}

/**
 * Returns the reward that can be claimed now. Incomplete challenges have no
 * claimable reward, which prevents a partially completed card from showing an
 * accidental payout.
 */
export function getDailyChallengeReward(
  progress: DailyChallengeProgress,
  challenge: DailyChallenge = getDailyChallenge(progress.dateKey),
): DailyChallengeReward {
  if (progress.claimed || !isDailyChallengeComplete(progress, challenge)) {
    return { baseReward: 0, allBonusesReward: 0, noHintReward: 0, total: 0 };
  }

  const allBonusesReward = areAllDailyChallengeBonusesCompleted(progress, challenge)
    ? DAILY_CHALLENGE_ALL_BONUS_REWARD
    : 0;
  const noHintReward = progress.usedHint ? 0 : DAILY_CHALLENGE_NO_HINT_REWARD;
  const baseReward = DAILY_CHALLENGE_BASE_REWARD;

  return {
    baseReward,
    allBonusesReward,
    noHintReward,
    total: baseReward + allBonusesReward + noHintReward,
  };
}

/**
 * Marks a fully completed challenge as claimed and advances its local-date
 * streak. Callers should persist the returned progress with
 * `saveDailyChallengeProgress`.
 */
export function claimDailyChallengeProgress(
  progress: DailyChallengeProgress,
  challenge: DailyChallenge = getDailyChallenge(progress.dateKey),
): DailyChallengeProgress {
  if (
    progress.claimed ||
    progress.dateKey !== challenge.dateKey ||
    !isDailyChallengeComplete(progress, challenge)
  ) {
    return {
      ...progress,
      completedPuzzleIds: [...progress.completedPuzzleIds],
      completedBonusPuzzleIds: [...progress.completedBonusPuzzleIds],
    };
  }

  const yesterday = getPreviousDailyChallengeDateKey(progress.dateKey);
  const continuingStreak = progress.lastCompletedDate === yesterday;
  const alreadyCompletedToday = progress.lastCompletedDate === progress.dateKey;
  const streak = alreadyCompletedToday
    ? Math.max(1, progress.streak)
    : continuingStreak
      ? Math.max(1, progress.streak) + 1
      : 1;

  return {
    ...progress,
    completedPuzzleIds: [...progress.completedPuzzleIds],
    completedBonusPuzzleIds: [...progress.completedBonusPuzzleIds],
    claimed: true,
    streak,
    lastCompletedDate: progress.dateKey,
  };
}

/** Useful for tests and for catching accidental edits to the static packs. */
export function validateDailyChallengePacks(): string[] {
  const errors: string[] = [];
  const puzzleIds = new Set<string>();

  for (const pack of DAILY_CHALLENGE_PACKS) {
    if (pack.puzzles.length !== DAILY_CHALLENGE_PUZZLE_COUNT) {
      errors.push(`${pack.id}: expected ${DAILY_CHALLENGE_PUZZLE_COUNT} puzzles`);
    }

    for (const puzzle of pack.puzzles) {
      if (puzzleIds.has(puzzle.id)) errors.push(`${puzzle.id}: duplicate puzzle id`);
      puzzleIds.add(puzzle.id);

      if (puzzle.target.op !== puzzle.op || puzzle.bonusTarget.op !== puzzle.op) {
        errors.push(`${puzzle.id}: target operation does not match puzzle operation`);
      }
      if (findSolutionIndices(puzzle.target, puzzle.numbers) === null) {
        errors.push(`${puzzle.id}: required target is not solvable`);
      }
      if (findSolutionIndices(puzzle.bonusTarget, puzzle.numbers) === null) {
        errors.push(`${puzzle.id}: bonus target is not solvable`);
      }
    }
  }

  return errors;
}
