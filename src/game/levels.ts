import {
  COUNTRY_LEVEL_COUNT,
  DESTINATION_LEVEL_COUNT,
  WORLD_COUNTRIES,
  resolveTravelLevel,
  type TravelCountry,
  type TravelLocation,
} from './travel.ts';

export type Operation = '+' | '-' | '*' | '/';

export type Target = {
  value: number;
  steps: 2 | 3 | 4;
  op: Operation;
};

type Candidate = Target & {
  indices: number[];
};

export type City = TravelLocation;
export type Country = TravelCountry;

export type LevelData = {
  level: number;
  routeId: string;
  routeName: string;
  routeEmoji: string;
  routeIndex: number;
  routeCountryIndex: number;
  routeCountryCount: number;
  countryId: string;
  countryIndex: number;
  countryLevel: number;
  countryLevelCount: number;
  locationId: string;
  locationIndex: number;
  locationLevel: number;
  locationLevelCount: number;
  worldCountryCount: number;
  masterTour: number;
  countryChallenge: boolean;
  worldTourFinal: boolean;
  /** Eski kayıt alanları; artık şehir/destinasyon karşılığıdır. */
  cityIndex: number;
  cityLevel: number;
  country: string;
  flag: string;
  city: string;
  emoji: string;
  background: string;
  op: Operation;
  steps: 2 | 3 | 4;
  numbers: number[];
  targets: Target[];
  /** Ana hedeflerden bağımsız, tamamlanması zorunlu olmayan mücevher hedefi. */
  bonusTarget: Target;
};

export type LegacyLevelData = Omit<LevelData, 'bonusTarget'> & {
  bonusTarget?: Target;
};

export type Calculation = {
  expression: string;
  result: number;
};

export const COUNTRIES: Country[] = WORLD_COUNTRIES;

export const OPERATION_DETAILS: Record<
  Operation,
  { name: string; symbol: string; color: string; darkColor: string }
> = {
  '+': { name: 'Toplama', symbol: '+', color: '#2563EB', darkColor: '#1D4ED8' },
  '-': { name: 'Çıkarma', symbol: '−', color: '#4F46E5', darkColor: '#3730A3' },
  '*': { name: 'Çarpma', symbol: '×', color: '#D97706', darkColor: '#B45309' },
  '/': { name: 'Bölme', symbol: '÷', color: '#059669', darkColor: '#047857' },
};

export function hasCompletedRequiredTargets(
  solvedTargetCount: number,
  levelData: Pick<LevelData, 'targets'>,
): boolean {
  return levelData.targets.length > 0 && solvedTargetCount === levelData.targets.length;
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

const TRAINING_CITY_OPERATIONS: readonly (readonly Operation[])[] = [
  ['+', '+', '+'],
  ['+', '-', '+'],
  ['-', '+', '-'],
  ['*', '+', '*'],
  ['/', '*', '/'],
];

const ADVANCED_CITY_OPERATIONS: readonly Operation[] = ['+', '-', '*', '/'];

function getCityOperation(level: number, countryChallenge: boolean): Operation {
  const countryIndex = Math.floor((level - 1) / COUNTRY_LEVEL_COUNT);
  const countryLevel = ((level - 1) % COUNTRY_LEVEL_COUNT) + 1;
  // Challenge, üçüncü destinasyonda öğrenilen işlemle devam eder.
  const locationIndex = countryChallenge
    ? 2
    : Math.floor((countryLevel - 1) / DESTINATION_LEVEL_COUNT);
  const trainingOperations = TRAINING_CITY_OPERATIONS[countryIndex];

  if (trainingOperations) return trainingOperations[locationIndex];

  const advancedLocationIndex =
    (countryIndex - TRAINING_CITY_OPERATIONS.length) * 3 + locationIndex;
  return ADVANCED_CITY_OPERATIONS[
    advancedLocationIndex % ADVANCED_CITY_OPERATIONS.length
  ];
}

function getStepCount(
  countryIndex: number,
  op: Operation,
  countryChallenge: boolean,
): 2 | 3 | 4 {
  // İlk beş ülke dört işlemi ayrı ayrı öğretir; adım sayısı sabit kalır.
  if (countryIndex < TRAINING_CITY_OPERATIONS.length) return 2;

  if (countryChallenge) {
    if (countryIndex < 8) return op === '+' || op === '*' ? 3 : 2;
    if (countryIndex < 16 || op === '-' || op === '/') return 3;
    return 4;
  }

  if (countryIndex < 8) return op === '+' || op === '*' ? 3 : 2;
  if (countryIndex < 16) return op === '/' ? 2 : 3;
  return 3;
}

function getBonusStepOptions(level: number): readonly (2 | 3 | 4)[] {
  const countryIndex = Math.floor((level - 1) / COUNTRY_LEVEL_COUNT);
  if (countryIndex < TRAINING_CITY_OPERATIONS.length) return [2];
  if (countryIndex < 8) return [2, 3];
  return [2, 3, 4];
}

function getLevelRules(level: number, countryChallenge: boolean): {
  op: Operation;
  steps: 2 | 3 | 4;
  nodeCount: number;
  targetCount: number;
} {
  const countryIndex = Math.floor((level - 1) / COUNTRY_LEVEL_COUNT);
  const op = getCityOperation(level, countryChallenge);
  return {
    op,
    steps: getStepCount(countryIndex, op, countryChallenge),
    nodeCount: level <= 10 ? 5 : countryIndex < 5 ? 6 : 7,
    targetCount: level <= 10 ? 3 : 4,
  };
}

function getPool(op: Operation, level: number): number[] {
  const countryIndex = Math.floor((level - 1) / COUNTRY_LEVEL_COUNT);
  const difficulty = countryIndex < 2 ? 0 : countryIndex < 5 ? 1 : countryIndex < 20 ? 2 : 3;

  if (op === '+') {
    if (difficulty === 0) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (difficulty === 1) return [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15];
    if (difficulty === 2) return [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20];
    return [4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 18, 20, 24, 25];
  }

  if (op === '-') {
    if (difficulty === 0) return [12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    if (difficulty === 1) return [20, 18, 16, 15, 12, 10, 8, 6, 5, 4, 3, 2];
    if (difficulty === 2) return [30, 27, 24, 21, 18, 15, 12, 10, 8, 6, 4, 3];
    return [45, 40, 36, 32, 28, 24, 20, 16, 12, 9, 6, 4];
  }

  if (op === '*') {
    if (difficulty <= 1) return [2, 3, 4, 5, 6, 7, 8];
    if (difficulty === 2) return [2, 3, 4, 5, 6, 7, 8, 9, 10];
    return [3, 4, 5, 6, 7, 8, 9, 10, 11];
  }

  // Bölme havuzları, sekiz bölümlük seri boyunca ardışık hedefleri tekrar
  // etmeden yeterli sayıda tam bölünen sonuç verecek çarpan aileleridir.
  if (difficulty <= 1) return [2, 3, 4, 6, 24, 120];
  if (difficulty === 2) return [2, 3, 4, 5, 10, 30, 120];
  return [3, 4, 5, 6, 12, 60, 180];
}

function buildCandidates(numbers: number[], op: Operation, steps: 2 | 3 | 4): Candidate[] {
  const candidates: Candidate[] = [];

  const build = (indices: number[]) => {
    if (indices.length === steps) {
      const calculation = computeResult(
        indices.map((index) => numbers[index]),
        op,
      );
      if (calculation && calculation.result > 0 && Number.isFinite(calculation.result)) {
        candidates.push({ value: calculation.result, steps, op, indices });
      }
      return;
    }

    for (let index = 0; index < numbers.length; index += 1) {
      if (indices.includes(index)) continue;
      build([...indices, index]);
    }
  };

  build([]);

  return candidates;
}

function selectDiverseCandidates(
  candidates: Candidate[],
  count: number,
  nodeCount: number,
  excludedTargetValues: ReadonlySet<number>,
): Candidate[] {
  const remaining = shuffle(
    candidates.filter((candidate) => !excludedTargetValues.has(candidate.value)),
  );
  const selected: Candidate[] = [];
  const indexUsage = new Map<number, number>();

  while (selected.length < count) {
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    remaining.forEach((candidate, index) => {
      if (selected.some((item) => item.value === candidate.value)) return;
      const trialUsage = Array.from(
        { length: nodeCount },
        (_, nodeIndex) => indexUsage.get(nodeIndex) ?? 0,
      );
      candidate.indices.forEach((nodeIndex) => {
        trialUsage[nodeIndex] += 1;
      });
      const maxUsage = Math.max(...trialUsage);
      const minUsage = Math.min(...trialUsage);
      const squaredUsage = trialUsage.reduce((total, usage) => total + usage * usage, 0);
      const score = (maxUsage - minUsage) * 100 + squaredUsage;
      if (score < bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    });

    if (bestIndex < 0) break;
    const [candidate] = remaining.splice(bestIndex, 1);
    selected.push(candidate);
    candidate.indices.forEach((index) => {
      indexUsage.set(index, (indexUsage.get(index) ?? 0) + 1);
    });
  }

  return selected;
}

export function generateLevelData(
  level: number,
  excludedTargetValues: readonly number[] = [],
): LevelData {
  const normalizedLevel = Math.max(1, Math.floor(level));
  const destination = resolveTravelLevel(normalizedLevel);
  const rules = getLevelRules(normalizedLevel, destination.countryChallenge);

  const excludedValues = new Set(
    excludedTargetValues.filter((value) => Number.isFinite(value)),
  );
  // Bölmede ardışık sekiz puzzle boyunca hedef değeri tekrarlamama kuralı,
  // bazı çarpanların bir tur için kullanılamamasına yol açabilir. Bu işlemde
  // çemberin biri hariç tüm düğümlerini kapsamak yeterlidir.
  const coverageGoal = Math.min(
    rules.op === '/' ? rules.nodeCount - 1 : rules.nodeCount,
    rules.targetCount * rules.steps,
  );
  let numbers: number[] = [];
  let selectedCandidates: Candidate[] = [];
  let bonusCandidate: Candidate | null = null;
  let bestCoverage = -1;
  let bestSelectionCount = -1;

  for (let attempt = 0; attempt < 160; attempt += 1) {
    const candidateNumbers = shuffle(getPool(rules.op, normalizedLevel)).slice(0, rules.nodeCount);
    const candidates = buildCandidates(candidateNumbers, rules.op, rules.steps);
    const selected = selectDiverseCandidates(
      candidates,
      rules.targetCount,
      rules.nodeCount,
      excludedValues,
    );
    const requiredCandidates = selected;
    const requiredValues = new Set(requiredCandidates.map((candidate) => candidate.value));
    const bonusCandidates = shuffle(
      getBonusStepOptions(normalizedLevel).flatMap((bonusSteps) =>
        buildCandidates(candidateNumbers, rules.op, bonusSteps),
      ),
    ).filter(
      (candidate) =>
        !excludedValues.has(candidate.value) && !requiredValues.has(candidate.value),
    );
    const candidateBonus = bonusCandidates[0] ?? null;
    const selectedWithBonus = candidateBonus
      ? [...requiredCandidates, candidateBonus]
      : requiredCandidates;
    const coverage = new Set(
      requiredCandidates.flatMap((candidate) => candidate.indices),
    ).size;

    if (
      selectedWithBonus.length > bestSelectionCount ||
      (selectedWithBonus.length === bestSelectionCount && coverage > bestCoverage)
    ) {
      numbers = candidateNumbers;
      selectedCandidates = requiredCandidates;
      bonusCandidate = candidateBonus;
      bestCoverage = coverage;
      bestSelectionCount = selectedWithBonus.length;
    }

    if (selectedWithBonus.length === rules.targetCount + 1 && coverage >= coverageGoal) break;
  }

  const targets = selectedCandidates.map(({ value, steps, op }) => ({ value, steps, op }));

  if (targets.length !== rules.targetCount || !bonusCandidate || bestCoverage < coverageGoal) {
    throw new Error(`Seviye ${normalizedLevel} için çözülebilir hedef matrisi üretilemedi.`);
  }

  const bonusTarget: Target = {
    value: bonusCandidate.value,
    steps: bonusCandidate.steps,
    op: bonusCandidate.op,
  };

  return {
    level: normalizedLevel,
    ...travelMetadata(normalizedLevel),
    op: rules.op,
    steps: rules.steps,
    numbers,
    targets,
    bonusTarget,
  };
}

function travelMetadata(
  level: number,
): Omit<LevelData, 'level' | 'op' | 'steps' | 'numbers' | 'targets' | 'bonusTarget'> {
  const destination = resolveTravelLevel(level);
  const { route, country, location } = destination;

  return {
    routeId: route.id,
    routeName: route.name,
    routeEmoji: route.emoji,
    routeIndex: destination.routeIndex,
    routeCountryIndex: destination.routeCountryIndex,
    routeCountryCount: route.countryIds.length,
    countryId: country.id,
    countryIndex: destination.countryIndex,
    countryLevel: destination.countryLevel,
    countryLevelCount: country.levelCount,
    locationId: location.id,
    locationIndex: destination.locationIndex,
    locationLevel: destination.locationLevel,
    locationLevelCount: location.levelCount,
    worldCountryCount: WORLD_COUNTRIES.length,
    masterTour: destination.masterTour,
    countryChallenge: destination.countryChallenge,
    worldTourFinal: destination.worldTourFinal,
    cityIndex: destination.locationIndex,
    cityLevel: destination.locationLevel,
    country: country.country,
    flag: country.flag,
    city: location.name,
    emoji: location.emoji,
    background: location.background,
  };
}

function deriveLegacyBonusTarget(levelData: LegacyLevelData): Target {
  const requiredValues = new Set(levelData.targets.map((target) => target.value));
  const candidate = getBonusStepOptions(levelData.level)
    .flatMap((steps) => buildCandidates(levelData.numbers, levelData.op, steps))
    .find((item) => !requiredValues.has(item.value));

  if (!candidate) {
    throw new Error(`Seviye ${levelData.level} için bonus hedefi türetilemedi.`);
  }

  return { value: candidate.value, steps: candidate.steps, op: candidate.op };
}

function isUsableBonusTarget(levelData: LegacyLevelData): levelData is LevelData {
  const target = levelData.bonusTarget;
  if (
    !target ||
    target.op !== levelData.op ||
    !getBonusStepOptions(levelData.level).includes(target.steps) ||
    levelData.targets.some((item) => item.value === target.value)
  ) {
    return false;
  }
  return findSolutionIndices(target, levelData.numbers) !== null;
}

/** Eski kayıt matrisini koruyup seyahat ve isteğe bağlı bonus metadatasını günceller. */
export function normalizeLevelData(levelData: LegacyLevelData): LevelData {
  return {
    ...levelData,
    ...travelMetadata(levelData.level),
    bonusTarget: isUsableBonusTarget(levelData)
      ? levelData.bonusTarget
      : deriveLegacyBonusTarget(levelData),
  };
}

export function computeResult(values: number[], op: Operation): Calculation | null {
  const symbol = OPERATION_DETAILS[op].symbol;

  if (values.length < 2 || values.length > 4) return null;

  if (op === '+') {
    return {
      expression: values.join(` ${symbol} `),
      result: values.reduce((total, value) => total + value, 0),
    };
  }

  if (op === '-') {
    const [first, ...remaining] = values;
    const result = first - remaining.reduce((total, value) => total + value, 0);
    return result > 0
      ? { expression: values.join(` ${symbol} `), result }
      : null;
  }

  if (op === '*') {
    return {
      expression: values.join(` ${symbol} `),
      result: values.reduce((total, value) => total * value, 1),
    };
  }

  let result = values[0];
  for (const divisor of values.slice(1)) {
    if (divisor === 0 || result % divisor !== 0) return null;
    result /= divisor;
  }
  return result > 0 ? { expression: values.join(` ${symbol} `), result } : null;
}

/**
 * Toplama ve çarpma değişmelidir; aynı düğüm kümesi farklı sırada aynı keşiftir.
 * Çıkarma ve bölmede ise sürükleme sırası işlemin ve keşfin bir parçasıdır.
 */
export function getCombinationKey(
  values: readonly number[],
  op: Operation,
  result: number,
): string {
  const canonicalOperands = (op === '+' || op === '*'
    ? [...values].sort((left, right) => left - right)
    : values
  ).join(',');
  return `${op}:${canonicalOperands}=${result}`;
}

export function findSolutionIndices(
  target: Target,
  numbers: number[],
): number[] | null {
  const search = (indices: number[]): number[] | null => {
    if (indices.length === target.steps) {
      const calculation = computeResult(
        indices.map((index) => numbers[index]),
        target.op,
      );
      return calculation?.result === target.value ? indices : null;
    }

    for (let index = 0; index < numbers.length; index += 1) {
      if (indices.includes(index)) continue;
      const result = search([...indices, index]);
      if (result) return result;
    }
    return null;
  };

  return search([]);
}
