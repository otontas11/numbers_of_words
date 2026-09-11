import {
  difficultyModifierFromLearningScore,
  isAdaptiveDifficultyEnabled,
  type DifficultyModifier,
} from './adaptive-difficulty.ts';
import {
  findSolutionIndices,
  generateDailyPuzzleBoard,
  type Operation,
  type Target,
} from './levels.ts';
import { COUNTRY_LEVEL_COUNT, WORLD_COUNTRIES } from './travel.ts';

/** Five rising puzzles make up a single daily challenge. */
export const DAILY_CHALLENGE_PUZZLE_COUNT = 5;

/** Mid-tour country used when the player has no main-tour snapshot yet. */
export const DAILY_CHALLENGE_MID_COUNTRY_INDEX = 8;

/** Rewards are intentionally small and independent from the regular level economy. */
export const DAILY_CHALLENGE_BASE_REWARD = 15;
/** Extra gem pack when every bonus card is solved. First claim only. */
export const DAILY_CHALLENGE_ALL_BONUS_REWARD = 8;
export const DAILY_CHALLENGE_NO_HINT_REWARD = 2;

export const DAILY_CHALLENGE_REWARDS = {
  base: DAILY_CHALLENGE_BASE_REWARD,
  allBonuses: DAILY_CHALLENGE_ALL_BONUS_REWARD,
  noHint: DAILY_CHALLENGE_NO_HINT_REWARD,
} as const;

export type DailyPuzzleTier = 'warmup' | 'tempo' | 'peak';

export type DailyPuzzle = {
  /** Stable across launches, so it can safely be persisted as completion state. */
  id: string;
  numbers: number[];
  op: Operation;
  target: Target;
  bonusTarget: Target;
  tier: DailyPuzzleTier;
  miniChallenge: boolean;
  venueName: string;
  venueEmoji: string;
  countryName: string;
  flag: string;
};

export type DailyChallengePack = {
  id: string;
  puzzles: readonly DailyPuzzle[];
};

export type DailyChallengeSkill = {
  countryIndex: number;
  difficultyModifier: DifficultyModifier;
};

export type DailyChallenge = {
  /** Local calendar date, never a UTC ISO timestamp. */
  dateKey: string;
  packId: string;
  puzzles: DailyPuzzle[];
  rewards: typeof DAILY_CHALLENGE_REWARDS;
  skill: DailyChallengeSkill;
};

export type DailyChallengeProgress = {
  dateKey: string;
  completedPuzzleIds: string[];
  completedBonusPuzzleIds: string[];
  usedHint: boolean;
  claimed: boolean;
  claimedAllBonuses: boolean;
  claimedNoHint: boolean;
  streak: number;
  lastCompletedDate: string | null;
  sourceCountryIndex: number;
  sourceDifficultyModifier: DifficultyModifier;
  /** Session/run score for the daily HUD. Replay resets it. */
  runScore: number;
};

export type DailyChallengeReward = {
  baseReward: number;
  allBonusesReward: number;
  noHintReward: number;
  total: number;
};

export type DailyChallengeSkillInput = {
  countryIndex?: number;
  learningScore?: number;
  cityDifficultyModifier?: DifficultyModifier;
};

type DailyTargetDefinition = readonly [value: number, steps: 2 | 3 | 4];

type DailyPuzzlePlan = {
  op: Operation;
  steps: 2 | 3 | 4;
  bonusSteps: 2 | 3 | 4;
  nodeCount: number;
  tier: DailyPuzzleTier;
  miniChallenge: boolean;
  sourceCountryLevel: number;
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ALL_OPERATIONS: readonly Operation[] = ['+', '-', '*', '/'];

function makeTarget(op: Operation, [value, steps]: DailyTargetDefinition): Target {
  return { value, steps, op };
}

function makePuzzle(
  id: string,
  numbers: number[],
  op: Operation,
  target: DailyTargetDefinition,
  bonusTarget: DailyTargetDefinition,
  tier: DailyPuzzleTier,
  extra: {
    miniChallenge?: boolean;
    venueName: string;
    venueEmoji: string;
    countryName: string;
    flag: string;
  },
): DailyPuzzle {
  return {
    id,
    numbers,
    op,
    target: makeTarget(op, target),
    bonusTarget: makeTarget(op, bonusTarget),
    tier,
    miniChallenge: extra.miniChallenge === true,
    venueName: extra.venueName,
    venueEmoji: extra.venueEmoji,
    countryName: extra.countryName,
    flag: extra.flag,
  };
}

/**
 * Hand-authored rising set used only if seeded generation fails. Puzzle ids are
 * rewritten per date so storage never collides across days.
 */
export const DAILY_CHALLENGE_FALLBACK_PACK: DailyChallengePack = {
  id: 'fallback',
  puzzles: [
    makePuzzle('fallback-1', [2, 3, 4, 5, 6], '+', [9, 2], [11, 2], 'warmup', {
      venueName: 'İstanbul',
      venueEmoji: '🕌',
      countryName: 'Türkiye',
      flag: '🇹🇷',
    }),
    makePuzzle('fallback-2', [12, 8, 5, 3, 2], '-', [7, 2], [5, 2], 'warmup', {
      venueName: 'Atina',
      venueEmoji: '🏛️',
      countryName: 'Yunanistan',
      flag: '🇬🇷',
    }),
    makePuzzle('fallback-3', [2, 3, 4, 5, 6], '*', [12, 2], [30, 2], 'tempo', {
      venueName: 'Roma',
      venueEmoji: '⛲',
      countryName: 'İtalya',
      flag: '🇮🇹',
    }),
    makePuzzle('fallback-4', [3, 4, 5, 6, 7], '+', [15, 3], [10, 2], 'tempo', {
      venueName: 'Paris',
      venueEmoji: '🗼',
      countryName: 'Fransa',
      flag: '🇫🇷',
    }),
    makePuzzle('fallback-5', [6, 7, 8, 9, 10], '+', [24, 3], [16, 2], 'peak', {
      miniChallenge: true,
      venueName: 'WORLD TOUR FINAL',
      venueEmoji: '🏆',
      countryName: 'Yeni Zelanda',
      flag: '🇳🇿',
    }),
  ],
};

/** @deprecated Kept so older validators still import a pack catalog. */
export const DAILY_CHALLENGE_PACKS: readonly DailyChallengePack[] = [
  DAILY_CHALLENGE_FALLBACK_PACK,
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

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function clonePuzzle(puzzle: DailyPuzzle): DailyPuzzle {
  return {
    ...puzzle,
    numbers: [...puzzle.numbers],
    target: { ...puzzle.target },
    bonusTarget: { ...puzzle.bonusTarget },
  };
}

export function isDailyChallengeDifficultyModifier(
  value: unknown,
): value is DifficultyModifier {
  return value === -1 || value === 0 || value === 1;
}

export function skillFromDailyChallengeProgress(
  progress: Pick<DailyChallengeProgress, 'sourceCountryIndex' | 'sourceDifficultyModifier'>,
): DailyChallengeSkill {
  return resolveDailyChallengeSkill({
    countryIndex: progress.sourceCountryIndex,
    cityDifficultyModifier: progress.sourceDifficultyModifier,
  });
}

/** Maps main-tour progress onto a daily number-pool band. Missing values use mid-tier. */
export function resolveDailyChallengeSkill(
  input: DailyChallengeSkillInput = {},
): DailyChallengeSkill {
  const countryCount = Math.max(1, WORLD_COUNTRIES.length);
  const countryIndex =
    typeof input.countryIndex === 'number' &&
    Number.isInteger(input.countryIndex) &&
    input.countryIndex >= 0
      ? Math.min(input.countryIndex, countryCount - 1)
      : DAILY_CHALLENGE_MID_COUNTRY_INDEX;

  if (!isAdaptiveDifficultyEnabled(countryIndex)) {
    return { countryIndex, difficultyModifier: 0 };
  }

  if (isDailyChallengeDifficultyModifier(input.cityDifficultyModifier)) {
    return { countryIndex, difficultyModifier: input.cityDifficultyModifier };
  }

  if (typeof input.learningScore === 'number' && Number.isFinite(input.learningScore)) {
    return {
      countryIndex,
      difficultyModifier: difficultyModifierFromLearningScore(input.learningScore),
    };
  }

  return { countryIndex, difficultyModifier: 0 };
}

function sourceLevelFor(countryIndex: number, countryLevel: number) {
  const clampedCountry = Math.max(0, Math.min(countryIndex, WORLD_COUNTRIES.length - 1));
  const clampedLevel = Math.max(1, Math.min(COUNTRY_LEVEL_COUNT, countryLevel));
  return clampedCountry * COUNTRY_LEVEL_COUNT + clampedLevel;
}

/** Daily sits one number-difficulty step above the player's main-tour snapshot. */
export const DAILY_CHALLENGE_NUMBER_DIFFICULTY_BUMP = 1;

function stepsForCountry(countryIndex: number, op: Operation, want: 2 | 3 | 4): 2 | 3 | 4 {
  // Division is the readability exception: always 2 steps, small exact quotients.
  if (op === '/') return 2;
  if (countryIndex < 5) return 2;
  if (want === 2) return 2;

  if (countryIndex < 8) {
    if (op === '+' || op === '*') return 3;
    return 2;
  }

  if (want === 4) {
    if (countryIndex < 16 || op === '-') return 3;
    return 4;
  }

  return 3;
}

function planDailyPuzzles(
  countryIndex: number,
  random: () => number,
): DailyPuzzlePlan[] {
  const ops = availableOperations(countryIndex, random);
  const tempoSteps = (op: Operation) => stepsForCountry(countryIndex, op, 3);
  const peakSteps = (op: Operation) =>
    stepsForCountry(countryIndex, op, countryIndex >= 16 ? 4 : 3);
  const tempoNodes = countryIndex < 3 ? 5 : 6;
  const peakNodes = countryIndex < 5 ? 6 : countryIndex < 12 ? 6 : 7;

  return [
    {
      op: ops[0],
      steps: 2,
      bonusSteps: 2,
      nodeCount: 5,
      tier: 'warmup',
      miniChallenge: false,
      sourceCountryLevel: 4,
    },
    {
      op: ops[1],
      steps: 2,
      bonusSteps: 2,
      nodeCount: 5,
      tier: 'warmup',
      miniChallenge: false,
      sourceCountryLevel: 8,
    },
    {
      op: ops[2],
      steps: tempoSteps(ops[2]),
      bonusSteps: 2,
      nodeCount: tempoNodes,
      tier: 'tempo',
      miniChallenge: false,
      sourceCountryLevel: 12,
    },
    {
      op: ops[3],
      steps: tempoSteps(ops[3]),
      bonusSteps: 2,
      nodeCount: tempoNodes,
      tier: 'tempo',
      miniChallenge: false,
      sourceCountryLevel: 18,
    },
    {
      op: ops[4],
      steps: peakSteps(ops[4]),
      bonusSteps: 2,
      nodeCount: peakNodes,
      tier: 'peak',
      miniChallenge: true,
      sourceCountryLevel: COUNTRY_LEVEL_COUNT,
    },
  ];
}

function availableOperations(countryIndex: number, random: () => number): Operation[] {
  if (countryIndex <= 0) return ['+', '-', '+', '*', '+'];
  if (countryIndex === 1) return ['+', '-', '*', '+', '-'];
  if (countryIndex === 2) return ['+', '-', '*', '/', '*'];
  if (countryIndex === 3) return ['-', '*', '/', '+', '*'];
  if (countryIndex === 4) return ['/', '*', '-', '+', '/'];

  const rotated = shuffleWith(ALL_OPERATIONS, random);
  // Peak stays a real finale: prefer multiplication once training cities are done.
  if (countryIndex >= 8) {
    const multiplyIndex = rotated.indexOf('*');
    const last = rotated.length - 1;
    if (multiplyIndex >= 0 && multiplyIndex !== last) {
      [rotated[multiplyIndex], rotated[last]] = [rotated[last], rotated[multiplyIndex]];
    }
    return [rotated[0], rotated[1], rotated[2], rotated[3], '*'];
  }
  const peak = countryIndex >= 12 ? rotated[rotated.length - 1] : rotated[0];
  return [rotated[0], rotated[1], rotated[2], rotated[3], peak];
}

function pickDailyVenues(dateKey: string, countryIndex: number) {
  const dayIndex = getChallengeDayIndex(dateKey);
  const countryCount = Math.max(1, WORLD_COUNTRIES.length);
  const start = positiveModulo(dayIndex * 3 + countryIndex * 5, countryCount);

  return Array.from({ length: DAILY_CHALLENGE_PUZZLE_COUNT }, (_, index) => {
    const country = WORLD_COUNTRIES[positiveModulo(start + index * 11, countryCount)];
    const location = country.locations[index % country.locations.length];
    if (index === DAILY_CHALLENGE_PUZZLE_COUNT - 1) {
      return {
        venueName: country.challenge.name,
        venueEmoji: country.challenge.emoji,
        countryName: country.country,
        flag: country.flag,
      };
    }
    return {
      venueName: location.name,
      venueEmoji: location.emoji,
      countryName: country.country,
      flag: country.flag,
    };
  });
}

function buildGeneratedPuzzles(
  dateKey: string,
  skill: DailyChallengeSkill,
): DailyPuzzle[] {
  const seed = hashString(
    `${dateKey}:${skill.countryIndex}:${skill.difficultyModifier}`,
  );
  const random = mulberry32(seed);
  const plan = planDailyPuzzles(skill.countryIndex, random);
  const venues = pickDailyVenues(dateKey, skill.countryIndex);

  return plan.map((slot, index) => {
    const isDivision = slot.op === '/';
    const board = generateDailyPuzzleBoard(
      {
        op: slot.op,
        steps: slot.steps,
        bonusSteps: slot.bonusSteps,
        nodeCount: isDivision ? Math.min(6, slot.nodeCount) : slot.nodeCount,
        sourceLevel: sourceLevelFor(skill.countryIndex, slot.sourceCountryLevel),
        difficultyModifier: skill.difficultyModifier,
        numberDifficultyBump: isDivision ? 0 : DAILY_CHALLENGE_NUMBER_DIFFICULTY_BUMP,
        exactQuotientLite: isDivision,
      },
      seed + (index + 1) * 97_411,
    );

    return {
      id: `${dateKey}-${index + 1}`,
      numbers: board.numbers,
      op: board.op,
      target: board.target,
      bonusTarget: board.bonusTarget,
      tier: slot.tier,
      miniChallenge: slot.miniChallenge,
      ...venues[index],
    };
  });
}

function buildFallbackPuzzles(dateKey: string): DailyPuzzle[] {
  return DAILY_CHALLENGE_FALLBACK_PACK.puzzles.map((puzzle, index) => ({
    ...clonePuzzle(puzzle),
    id: `${dateKey}-${index + 1}`,
  }));
}

/** Selects a deterministically generated 5-puzzle set from a local calendar date. */
export function getDailyChallenge(
  dateKey: string = getLocalDateKey(),
  skillInput: DailyChallengeSkill | DailyChallengeSkillInput = {},
): DailyChallenge {
  const normalizedDateKey = normalizeDailyChallengeDateKey(dateKey);
  const skill = resolveDailyChallengeSkill(skillInput);

  let puzzles: DailyPuzzle[];
  let packId = `tour-${normalizedDateKey}-c${skill.countryIndex}-m${skill.difficultyModifier}`;
  try {
    puzzles = buildGeneratedPuzzles(normalizedDateKey, skill);
  } catch {
    puzzles = buildFallbackPuzzles(normalizedDateKey);
    packId = `fallback-${normalizedDateKey}`;
  }

  return {
    dateKey: normalizedDateKey,
    packId,
    puzzles,
    rewards: { ...DAILY_CHALLENGE_REWARDS },
    skill,
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
  skillInput: DailyChallengeSkill | DailyChallengeSkillInput = {},
): DailyChallengeProgress {
  const skill = resolveDailyChallengeSkill(skillInput);
  return {
    dateKey: normalizeDailyChallengeDateKey(dateKey),
    completedPuzzleIds: [],
    completedBonusPuzzleIds: [],
    usedHint: false,
    claimed: false,
    claimedAllBonuses: false,
    claimedNoHint: false,
    streak: 0,
    lastCompletedDate: null,
    sourceCountryIndex: skill.countryIndex,
    sourceDifficultyModifier: skill.difficultyModifier,
    runScore: 0,
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
  challenge: DailyChallenge = getDailyChallenge(
    progress.dateKey,
    skillFromDailyChallengeProgress(progress),
  ),
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

export function getClaimedDailyChallengeReward(
  progress: Pick<DailyChallengeProgress, 'claimed' | 'claimedAllBonuses' | 'claimedNoHint'>,
) {
  if (!progress.claimed) {
    return { baseReward: 0, allBonusesReward: 0, noHintReward: 0, total: 0 };
  }

  const allBonusesReward = progress.claimedAllBonuses ? DAILY_CHALLENGE_ALL_BONUS_REWARD : 0;
  const noHintReward = progress.claimedNoHint ? DAILY_CHALLENGE_NO_HINT_REWARD : 0;
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
  challenge: DailyChallenge = getDailyChallenge(
    progress.dateKey,
    skillFromDailyChallengeProgress(progress),
  ),
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
    claimedAllBonuses: areAllDailyChallengeBonusesCompleted(progress, challenge),
    claimedNoHint: !progress.usedHint,
    streak,
    lastCompletedDate: progress.dateKey,
    runScore: progress.runScore,
  };
}

/** Opens a practice run after the first claim. Streak, claim, and snapshot stay. */
export function startDailyChallengeReplay(
  progress: DailyChallengeProgress,
): DailyChallengeProgress {
  if (!progress.claimed) {
    return {
      ...progress,
      completedPuzzleIds: [...progress.completedPuzzleIds],
      completedBonusPuzzleIds: [...progress.completedBonusPuzzleIds],
    };
  }

  return {
    ...progress,
    completedPuzzleIds: [],
    completedBonusPuzzleIds: [],
    usedHint: false,
    runScore: 0,
  };
}

function puzzleErrors(packId: string, puzzles: readonly DailyPuzzle[]): string[] {
  const errors: string[] = [];
  const puzzleIds = new Set<string>();

  if (puzzles.length !== DAILY_CHALLENGE_PUZZLE_COUNT) {
    errors.push(`${packId}: expected ${DAILY_CHALLENGE_PUZZLE_COUNT} puzzles`);
  }

  for (const puzzle of puzzles) {
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

  return errors;
}

/** Useful for tests and for catching accidental edits to generated daily sets. */
export function validateDailyChallengePacks(): string[] {
  const errors = puzzleErrors(
    DAILY_CHALLENGE_FALLBACK_PACK.id,
    DAILY_CHALLENGE_FALLBACK_PACK.puzzles,
  );
  const sampleDateKeys = ['2026-01-01', '2026-06-15', '2026-09-11', '2026-12-31'];
  const sampleSkills: DailyChallengeSkill[] = [
    { countryIndex: 0, difficultyModifier: 0 },
    { countryIndex: DAILY_CHALLENGE_MID_COUNTRY_INDEX, difficultyModifier: 0 },
    { countryIndex: 20, difficultyModifier: 1 },
  ];

  for (const dateKey of sampleDateKeys) {
    for (const skill of sampleSkills) {
      const challenge = getDailyChallenge(dateKey, skill);
      errors.push(...puzzleErrors(challenge.packId, challenge.puzzles));

      const again = getDailyChallenge(dateKey, skill);
      const sameTargets = challenge.puzzles.every((puzzle, index) => {
        const other = again.puzzles[index];
        return (
          other != null &&
          puzzle.id === other.id &&
          puzzle.op === other.op &&
          puzzle.target.value === other.target.value &&
          puzzle.target.steps === other.target.steps &&
          puzzle.bonusTarget.value === other.bonusTarget.value &&
          puzzle.numbers.join(',') === other.numbers.join(',')
        );
      });
      if (!sameTargets) {
        errors.push(`${challenge.packId}: same-day generation is not deterministic`);
      }
    }
  }

  return errors;
}
