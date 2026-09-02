import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  INITIAL_HINT_CREDITS,
  isPuzzlePerformance,
  type DifficultyModifier,
  type PuzzlePerformance,
} from '@/game/adaptive-difficulty';
import {
  findSolutionIndices,
  generateLevelData,
  normalizeLevelData,
  type LegacyLevelData,
  type LevelData,
} from '@/game/levels';
import {
  COUNTRY_LEVEL_COUNT,
  TOTAL_COUNTRY_STAGES,
  TOTAL_WORLD_LEVELS,
} from '@/game/travel';

const STORAGE_KEY = '@number-of-wonders/progress-v2';
const STORAGE_VERSION = 4;
const LEGACY_TRAVEL_STORAGE_VERSION = 2;
const LEGACY_STORAGE_VERSION = 3;
const LEGACY_COUNTRY_LEVEL_COUNT = 20;
const LEGACY_WORLD_LEVEL_COUNT = TOTAL_COUNTRY_STAGES * LEGACY_COUNTRY_LEVEL_COUNT;

export type StoredGameProgress = {
  version: typeof STORAGE_VERSION;
  level: number;
  levelData: LevelData;
  solvedTargets: number[];
  /** Eski v2 kayıtlarında bulunmayabilir; ilk yüklemede mevcut görünür puandan türetilir. */
  score?: number;
  bonusSolved: boolean;
  bonusCount: number;
  gemCount: number;
  hintCredits: number;
  rewardedRouteIds: string[];
  performanceHistory: PuzzlePerformance[];
  cityDifficultyModifier: DifficultyModifier;
  cityDifficultyLocationId: string;
  consecutiveStruggles: number;
  discoveredBonuses: string[];
  effectsEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function migrateLegacyLevel(level: number) {
  const masterTour = Math.floor((level - 1) / LEGACY_WORLD_LEVEL_COUNT);
  const cycleLevel = ((level - 1) % LEGACY_WORLD_LEVEL_COUNT) + 1;
  const countryIndex = Math.floor((cycleLevel - 1) / LEGACY_COUNTRY_LEVEL_COUNT);
  const legacyCountryLevel = ((cycleLevel - 1) % LEGACY_COUNTRY_LEVEL_COUNT) + 1;

  // Eski 7+7+5+Challenge konumunu yeni 8+8+8+Challenge yapısında aynı
  // destinasyon ve destinasyon içi puzzle sırasına taşır.
  const countryLevel =
    legacyCountryLevel <= 7
      ? legacyCountryLevel
      : legacyCountryLevel <= 14
        ? legacyCountryLevel + 1
        : legacyCountryLevel <= 19
          ? legacyCountryLevel + 2
          : COUNTRY_LEVEL_COUNT;

  return (
    masterTour * TOTAL_WORLD_LEVELS +
    countryIndex * COUNTRY_LEVEL_COUNT +
    countryLevel
  );
}

function isValidLevelData(value: unknown, expectedLevel: number): value is LegacyLevelData {
  if (!isRecord(value)) return false;
  if (value.level !== expectedLevel) return false;
  if (
    typeof value.countryIndex !== 'number' ||
    !Number.isInteger(value.countryIndex) ||
    typeof value.cityIndex !== 'number' ||
    !Number.isInteger(value.cityIndex)
  ) {
    return false;
  }
  if (
    typeof value.cityLevel !== 'number' ||
    !Number.isInteger(value.cityLevel) ||
    value.cityLevel < 1 ||
    value.cityLevel > 10
  ) {
    return false;
  }
  if (
    typeof value.country !== 'string' ||
    typeof value.flag !== 'string' ||
    typeof value.city !== 'string' ||
    typeof value.emoji !== 'string' ||
    typeof value.background !== 'string'
  ) {
    return false;
  }
  if (!['+', '-', '*', '/'].includes(String(value.op))) return false;
  if (value.steps !== 2 && value.steps !== 3 && value.steps !== 4) return false;
  if (
    !Array.isArray(value.numbers) ||
    value.numbers.length < 5 ||
    value.numbers.length > 7 ||
    !value.numbers.every((number) => Number.isFinite(number))
  ) {
    return false;
  }
  if (!Array.isArray(value.targets) || value.targets.length < 3 || value.targets.length > 4) {
    return false;
  }

  const requiredTargetsValid = value.targets.every((target) => {
    if (!isRecord(target)) return false;
    if (!Number.isFinite(target.value)) return false;
    if (target.steps !== 2 && target.steps !== 3 && target.steps !== 4) return false;
    if (!['+', '-', '*', '/'].includes(String(target.op))) return false;
    return findSolutionIndices(target as LevelData['targets'][number], value.numbers as number[]) !== null;
  });
  if (!requiredTargetsValid) return false;

  if (value.bonusTarget === undefined) return true;
  if (!isRecord(value.bonusTarget)) return false;
  const bonusTarget = value.bonusTarget;
  if (!Number.isFinite(bonusTarget.value)) return false;
  if (bonusTarget.steps !== 2 && bonusTarget.steps !== 3 && bonusTarget.steps !== 4) return false;
  if (!['+', '-', '*', '/'].includes(String(bonusTarget.op))) return false;
  if (bonusTarget.op !== value.op) return false;
  return (
    !value.targets.some(
      (target) => isRecord(target) && target.value === bonusTarget.value,
    ) &&
    findSolutionIndices(
      bonusTarget as LevelData['bonusTarget'],
      value.numbers as number[],
    ) !== null
  );
}

function parseProgress(raw: string | null): StoredGameProgress | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      ![
        STORAGE_VERSION,
        LEGACY_STORAGE_VERSION,
        LEGACY_TRAVEL_STORAGE_VERSION,
      ].includes(Number(value.version))
    ) {
      return null;
    }
    if (!Number.isInteger(value.level) || Number(value.level) < 1) return null;
    const storedLevel = Number(value.level);
    const level =
      value.version === LEGACY_TRAVEL_STORAGE_VERSION
        ? migrateLegacyLevel(storedLevel)
        : storedLevel;
    const levelData = value.levelData;
    if (!isValidLevelData(levelData, storedLevel)) return null;
    if (
      !Array.isArray(value.solvedTargets) ||
      !value.solvedTargets.every(
        (index) => Number.isInteger(index) && index >= 0 && index < levelData.targets.length,
      )
    ) {
      return null;
    }
    const bonusSolved = typeof value.bonusSolved === 'boolean' ? value.bonusSolved : false;
    if (!Number.isInteger(value.bonusCount) || Number(value.bonusCount) < 0) return null;
    const bonusCount = Number(value.bonusCount);
    const storedGemCount =
      Number.isInteger(value.gemCount) && Number(value.gemCount) >= 0
        ? Number(value.gemCount)
        : 0;
    // Eski kayıtlarda serbest Bonus Keşifler istatistiğe yazılıyor, ancak
    // mücevher bakiyesine eklenmiyordu. Her bonusun mücevhere dönüştüğü yeni
    // ekonomiye geçerken oyuncunun daha önceki bonuslarını da koru.
    const gemCount = Math.max(storedGemCount, bonusCount);
    const score =
      Number.isInteger(value.score) && Number(value.score) >= 0
        ? Number(value.score)
        : undefined;
    if (
      !Array.isArray(value.discoveredBonuses) ||
      !value.discoveredBonuses.every((bonus) => typeof bonus === 'string')
    ) {
      return null;
    }
    if (typeof value.effectsEnabled !== 'boolean') return null;
    const musicEnabled =
      typeof value.musicEnabled === 'boolean' ? value.musicEnabled : false;
    const musicVolume =
      typeof value.musicVolume === 'number' && Number.isFinite(value.musicVolume)
        ? Math.max(0, Math.min(1, value.musicVolume))
        : 0.5;
    let normalizedLevelData: LevelData;
    let normalizedSolvedTargets = [...new Set(value.solvedTargets as number[])];
    let normalizedBonusSolved = bonusSolved;

    try {
      normalizedLevelData = normalizeLevelData(
        value.version === LEGACY_TRAVEL_STORAGE_VERSION
          ? { ...levelData, level }
          : levelData,
      );
    } catch {
      // Çok eski bir matriste ana hedeflerden farklı beşinci bir sonuç yoksa
      // dünya ilerlemesini koru, yalnız o anki puzzle matrisini güvenle yenile.
      normalizedLevelData = generateLevelData(
        level,
        levelData.targets.map((target) => target.value),
      );
      normalizedSolvedTargets = [];
      normalizedBonusSolved = false;
    }

    const hintCredits =
      Number.isInteger(value.hintCredits) && Number(value.hintCredits) >= 0
        ? Number(value.hintCredits)
        : INITIAL_HINT_CREDITS;
    const rewardedRouteIds =
      Array.isArray(value.rewardedRouteIds) &&
      value.rewardedRouteIds.every((routeId) => typeof routeId === 'string')
        ? [...new Set(value.rewardedRouteIds as string[])]
        : [];
    const performanceHistory =
      Array.isArray(value.performanceHistory) &&
      value.performanceHistory.every(isPuzzlePerformance)
        ? (value.performanceHistory as PuzzlePerformance[]).slice(-5)
        : [];
    const cityDifficultyModifier: DifficultyModifier =
      value.cityDifficultyModifier === -1 ||
      value.cityDifficultyModifier === 0 ||
      value.cityDifficultyModifier === 1
        ? value.cityDifficultyModifier
        : 0;
    const cityDifficultyLocationId =
      typeof value.cityDifficultyLocationId === 'string'
        ? value.cityDifficultyLocationId
        : normalizedLevelData.locationId;
    const consecutiveStruggles =
      Number.isInteger(value.consecutiveStruggles) && Number(value.consecutiveStruggles) >= 0
        ? Math.min(2, Number(value.consecutiveStruggles))
        : 0;

    return {
      version: STORAGE_VERSION,
      level,
      levelData: normalizedLevelData,
      solvedTargets: normalizedSolvedTargets,
      bonusSolved: normalizedBonusSolved,
      ...(score === undefined ? {} : { score }),
      bonusCount,
      gemCount,
      hintCredits,
      rewardedRouteIds,
      performanceHistory,
      cityDifficultyModifier,
      cityDifficultyLocationId,
      consecutiveStruggles,
      discoveredBonuses: [...new Set(value.discoveredBonuses as string[])],
      effectsEnabled: value.effectsEnabled,
      musicEnabled,
      musicVolume,
    };
  } catch {
    return null;
  }
}

let saveQueue: Promise<void> = Promise.resolve();

type GameProgressToSave = Omit<StoredGameProgress, 'version' | 'score'> & {
  score: number;
};

export async function loadGameProgress(): Promise<StoredGameProgress | null> {
  try {
    return parseProgress(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveGameProgress(progress: GameProgressToSave): Promise<void> {
  const serialized = JSON.stringify({ ...progress, version: STORAGE_VERSION });
  saveQueue = saveQueue
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(STORAGE_KEY, serialized));
  return saveQueue;
}
