import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createDailyChallengeProgress,
  getDailyChallenge,
  getLocalDateKey,
  getPreviousDailyChallengeDateKey,
  isDailyChallengeDateKey,
  isDailyChallengeDifficultyModifier,
  normalizeDailyChallengeDateKey,
  resolveDailyChallengeSkill,
  skillFromDailyChallengeProgress,
  type DailyChallengeProgress,
  type DailyChallengeSkillInput,
} from '@/game/daily-challenge';

export const DAILY_CHALLENGE_STORAGE_KEY = '@number-of-wonders/daily-challenge-v1';
const STORAGE_VERSION = 1;
const MAX_STREAK = 100_000;

type StoredDailyChallengeProgress = {
  version: typeof STORAGE_VERSION;
  progress: DailyChallengeProgress;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeIds(value: unknown, allowedIds: Set<string>) {
  if (!Array.isArray(value)) return [];

  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !allowedIds.has(item) || ids.includes(item)) continue;
    ids.push(item);
  }
  return ids;
}

function normalizeStreak(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? Math.min(value, MAX_STREAK)
    : 0;
}

function normalizeRunScore(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(1_000_000, Math.round(value))
    : 0;
}

function normalizeCountryIndex(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

/**
 * Filters untrusted persisted values against the puzzle ids for their date.
 * This is also intentionally used before every save, so stale or manually
 * altered values cannot claim a challenge that was not actually completed.
 */
export function normalizeDailyChallengeProgress(
  value: unknown,
  fallbackDateKey: string = getLocalDateKey(),
  skillInput: DailyChallengeSkillInput = {},
): DailyChallengeProgress {
  const normalizedFallbackDateKey = normalizeDailyChallengeDateKey(fallbackDateKey);
  const liveSkill = resolveDailyChallengeSkill(skillInput);
  const defaultProgress = createDailyChallengeProgress(normalizedFallbackDateKey, liveSkill);
  if (!isRecord(value)) return defaultProgress;

  const dateKey = isDailyChallengeDateKey(value.dateKey)
    ? value.dateKey
    : normalizedFallbackDateKey;
  const sourceCountryIndex = normalizeCountryIndex(value.sourceCountryIndex, liveSkill.countryIndex);
  const sourceDifficultyModifier = isDailyChallengeDifficultyModifier(
    value.sourceDifficultyModifier,
  )
    ? value.sourceDifficultyModifier
    : liveSkill.difficultyModifier;
  const storedSkill = resolveDailyChallengeSkill({
    countryIndex: sourceCountryIndex,
    cityDifficultyModifier: sourceDifficultyModifier,
  });
  const challenge = getDailyChallenge(dateKey, storedSkill);
  const allowedIds = new Set(challenge.puzzles.map((puzzle) => puzzle.id));
  const completedPuzzleIds = normalizeIds(value.completedPuzzleIds, allowedIds);
  const completedBonusPuzzleIds = normalizeIds(value.completedBonusPuzzleIds, allowedIds);
  const usedHint = value.usedHint === true;
  const streak = normalizeStreak(value.streak);
  const lastCompletedDate = isDailyChallengeDateKey(value.lastCompletedDate)
    ? value.lastCompletedDate
    : null;
  const claimed = value.claimed === true && lastCompletedDate === dateKey;
  const hasClaimFlags = 'claimedAllBonuses' in value || 'claimedNoHint' in value;
  const claimedAllBonuses = claimed && value.claimedAllBonuses === true;
  const claimedNoHint =
    claimed && (hasClaimFlags ? value.claimedNoHint === true : value.usedHint !== true);

  return {
    dateKey,
    completedPuzzleIds,
    completedBonusPuzzleIds,
    usedHint,
    claimed,
    claimedAllBonuses,
    claimedNoHint,
    streak,
    lastCompletedDate,
    sourceCountryIndex: storedSkill.countryIndex,
    sourceDifficultyModifier: storedSkill.difficultyModifier,
    runScore: normalizeRunScore(value.runScore),
  };
}

function parseStoredProgress(
  raw: string | null,
  skillInput: DailyChallengeSkillInput,
): DailyChallengeProgress | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;

    // The plain-object branch makes the parser tolerant of a pre-release value
    // written before the versioned envelope existed.
    if (value.version === STORAGE_VERSION && isRecord(value.progress)) {
      return normalizeDailyChallengeProgress(value.progress, undefined, skillInput);
    }
    return normalizeDailyChallengeProgress(value, undefined, skillInput);
  } catch {
    return null;
  }
}

function carryStreakToDate(
  progress: DailyChallengeProgress,
  dateKey: string,
) {
  if (
    progress.lastCompletedDate === dateKey ||
    progress.lastCompletedDate === getPreviousDailyChallengeDateKey(dateKey)
  ) {
    return progress.streak;
  }
  return 0;
}

let saveQueue: Promise<void> = Promise.resolve();

/**
 * Loads progress for the requested local date. If a new calendar day has
 * started, only per-puzzle state resets; the eligible streak carry-over and
 * last completion date remain available for the next successful claim.
 * The first load of a day snapshots main-tour skill so replay keeps the same set.
 */
export async function loadDailyChallengeProgress(
  dateKey: string = getLocalDateKey(),
  skillInput: DailyChallengeSkillInput = {},
): Promise<DailyChallengeProgress> {
  const normalizedDateKey = normalizeDailyChallengeDateKey(dateKey);
  const liveSkill = resolveDailyChallengeSkill(skillInput);

  try {
    await saveQueue.catch(() => undefined);
    const storedProgress = parseStoredProgress(
      await AsyncStorage.getItem(DAILY_CHALLENGE_STORAGE_KEY),
      skillInput,
    );
    if (!storedProgress) return createDailyChallengeProgress(normalizedDateKey, liveSkill);

    if (storedProgress.dateKey === normalizedDateKey) {
      return {
        ...storedProgress,
        streak: carryStreakToDate(storedProgress, normalizedDateKey),
      };
    }

    return {
      ...createDailyChallengeProgress(normalizedDateKey, liveSkill),
      streak: carryStreakToDate(storedProgress, normalizedDateKey),
      lastCompletedDate: storedProgress.lastCompletedDate,
    };
  } catch {
    return createDailyChallengeProgress(normalizedDateKey, liveSkill);
  }
}

/**
 * Serializes saves through one queue so quick taps cannot race and overwrite
 * completion ids. The payload is normalized before it reaches AsyncStorage.
 */
export function saveDailyChallengeProgress(
  progress: DailyChallengeProgress,
): Promise<void> {
  const normalizedProgress = normalizeDailyChallengeProgress(
    progress,
    progress.dateKey,
    skillFromDailyChallengeProgress(progress),
  );
  const serialized = JSON.stringify({
    version: STORAGE_VERSION,
    progress: normalizedProgress,
  } satisfies StoredDailyChallengeProgress);

  saveQueue = saveQueue
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(DAILY_CHALLENGE_STORAGE_KEY, serialized));
  return saveQueue;
}
