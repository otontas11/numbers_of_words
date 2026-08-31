import AsyncStorage from '@react-native-async-storage/async-storage';

import { findSolutionIndices, normalizeLevelData, type LevelData } from '@/game/levels';

const STORAGE_KEY = '@number-of-wonders/progress-v2';
const STORAGE_VERSION = 2;

export type StoredGameProgress = {
  version: typeof STORAGE_VERSION;
  level: number;
  levelData: LevelData;
  solvedTargets: number[];
  bonusCount: number;
  discoveredBonuses: string[];
  effectsEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidLevelData(value: unknown, expectedLevel: number): value is LevelData {
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
  if (value.steps !== 2 && value.steps !== 3) return false;
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

  return value.targets.every((target) => {
    if (!isRecord(target)) return false;
    if (!Number.isFinite(target.value)) return false;
    if (target.steps !== 2 && target.steps !== 3) return false;
    if (!['+', '-', '*', '/'].includes(String(target.op))) return false;
    return findSolutionIndices(target as LevelData['targets'][number], value.numbers as number[]) !== null;
  });
}

function parseProgress(raw: string | null): StoredGameProgress | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== STORAGE_VERSION) return null;
    if (!Number.isInteger(value.level) || Number(value.level) < 1) return null;
    const level = Number(value.level);
    const levelData = value.levelData;
    if (!isValidLevelData(levelData, level)) return null;
    if (
      !Array.isArray(value.solvedTargets) ||
      !value.solvedTargets.every(
        (index) => Number.isInteger(index) && index >= 0 && index < levelData.targets.length,
      )
    ) {
      return null;
    }
    if (!Number.isInteger(value.bonusCount) || Number(value.bonusCount) < 0) return null;
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

    return {
      version: STORAGE_VERSION,
      level,
      levelData: normalizeLevelData(levelData),
      solvedTargets: [...new Set(value.solvedTargets as number[])],
      bonusCount: Number(value.bonusCount),
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

export async function loadGameProgress(): Promise<StoredGameProgress | null> {
  try {
    return parseProgress(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveGameProgress(progress: Omit<StoredGameProgress, 'version'>): Promise<void> {
  const serialized = JSON.stringify({ ...progress, version: STORAGE_VERSION });
  saveQueue = saveQueue
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(STORAGE_KEY, serialized));
  return saveQueue;
}
