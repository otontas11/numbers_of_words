import {
  WORLD_COUNTRIES,
  resolveTravelLevel,
  type TravelCountry,
  type TravelLocation,
} from './travel.ts';

export type Operation = '+' | '-' | '*' | '/';

export type Target = {
  value: number;
  steps: 2 | 3;
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
  steps: 2 | 3;
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

function getLevelRules(level: number): {
  op: Operation;
  steps: 2 | 3;
  nodeCount: number;
  targetCount: number;
} {
  if (level <= 10) {
    return { op: '+', steps: 2, nodeCount: 5, targetCount: 3 };
  }
  if (level <= 30) {
    return { op: '+', steps: 2, nodeCount: 6, targetCount: 4 };
  }
  if (level <= 70) {
    const op: Operation = level % 2 === 0 ? '+' : '-';
    return {
      op,
      steps: op === '+' && level % 3 === 0 ? 3 : 2,
      nodeCount: 7,
      targetCount: 4,
    };
  }

  const operations: Operation[] = ['+', '-', '*', '/'];
  const op = operations[level % operations.length];
  return {
    op,
    steps: op === '+' ? 3 : 2,
    nodeCount: 7,
    targetCount: 4,
  };
}

function getPool(op: Operation): number[] {
  if (op === '+') return [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15];
  if (op === '-') return [20, 18, 16, 15, 12, 10, 8, 6, 5, 4, 3, 2];
  if (op === '*') return [2, 3, 4, 5, 6, 7, 8];
  return [24, 20, 18, 16, 12, 8, 6, 4, 3, 2];
}

function buildCandidates(numbers: number[], op: Operation, steps: 2 | 3): Candidate[] {
  const candidates: Candidate[] = [];

  if (steps === 2) {
    for (let first = 0; first < numbers.length; first += 1) {
      for (let second = first + 1; second < numbers.length; second += 1) {
        const left = numbers[first];
        const right = numbers[second];
        let value: number | null = null;

        if (op === '+') value = left + right;
        if (op === '-') value = Math.abs(left - right);
        if (op === '*') value = left * right;

        if (value !== null && value > 0) {
          candidates.push({ value, steps: 2, op, indices: [first, second] });
        }

        if (op === '/') {
          if (left % right === 0 && left / right > 1) {
            candidates.push({ value: left / right, steps: 2, op, indices: [first, second] });
          }
          if (right % left === 0 && right / left > 1) {
            candidates.push({ value: right / left, steps: 2, op, indices: [second, first] });
          }
        }
      }
    }
  }

  if (op === '+' && steps === 3) {
    for (let first = 0; first < numbers.length; first += 1) {
      for (let second = first + 1; second < numbers.length; second += 1) {
        for (let third = second + 1; third < numbers.length; third += 1) {
          candidates.push({
            value: numbers[first] + numbers[second] + numbers[third],
            steps: 3,
            op,
            indices: [first, second, third],
          });
        }
      }
    }
  }

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
  const rules = getLevelRules(normalizedLevel);

  const excludedValues = new Set(
    excludedTargetValues.filter((value) => Number.isFinite(value)),
  );
  const coverageGoal = Math.min(rules.nodeCount, rules.targetCount * rules.steps);
  let numbers: number[] = [];
  let selectedCandidates: Candidate[] = [];
  let bonusCandidate: Candidate | null = null;
  let bestCoverage = -1;
  let bestSelectionCount = -1;

  for (let attempt = 0; attempt < 160; attempt += 1) {
    const candidateNumbers = shuffle(getPool(rules.op)).slice(0, rules.nodeCount);
    const candidates = buildCandidates(candidateNumbers, rules.op, rules.steps);
    const selected = selectDiverseCandidates(
      candidates,
      rules.targetCount + 1,
      rules.nodeCount,
      excludedValues,
    );
    const requiredCandidates = selected.slice(0, rules.targetCount);
    const candidateBonus = selected[rules.targetCount] ?? null;
    const coverage = new Set(
      requiredCandidates.flatMap((candidate) => candidate.indices),
    ).size;

    if (
      selected.length > bestSelectionCount ||
      (selected.length === bestSelectionCount && coverage > bestCoverage)
    ) {
      numbers = candidateNumbers;
      selectedCandidates = requiredCandidates;
      bonusCandidate = candidateBonus;
      bestCoverage = coverage;
      bestSelectionCount = selected.length;
    }

    if (selected.length === rules.targetCount + 1 && coverage >= coverageGoal) break;
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
  const candidate = buildCandidates(levelData.numbers, levelData.op, levelData.steps).find(
    (item) => !requiredValues.has(item.value),
  );

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
    target.steps !== levelData.steps ||
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

  if (values.length === 2) {
    const [left, right] = values;
    if (op === '+') return { expression: `${left} ${symbol} ${right}`, result: left + right };
    if (op === '-') {
      const larger = Math.max(left, right);
      const smaller = Math.min(left, right);
      return { expression: `${larger} ${symbol} ${smaller}`, result: larger - smaller };
    }
    if (op === '*') return { expression: `${left} ${symbol} ${right}`, result: left * right };
    if (right !== 0 && left % right === 0) {
      return { expression: `${left} ${symbol} ${right}`, result: left / right };
    }
    if (left !== 0 && right % left === 0) {
      return { expression: `${right} ${symbol} ${left}`, result: right / left };
    }
    return null;
  }

  if (values.length === 3 && op === '+') {
    const [first, second, third] = values;
    return {
      expression: `${first} + ${second} + ${third}`,
      result: first + second + third,
    };
  }

  return null;
}

/**
 * Aynı düğüm kümesini farklı sırada sürüklemek aynı keşiftir. İşlem ve sonuç
 * anahtarda tutulduğu için aynı operandların farklı işlemdeki kullanımı ayrıdır.
 */
export function getCombinationKey(
  values: readonly number[],
  op: Operation,
  result: number,
): string {
  const canonicalOperands = [...values].sort((left, right) => left - right).join(',');
  return `${op}:${canonicalOperands}=${result}`;
}

export function findSolutionIndices(
  target: Target,
  numbers: number[],
): number[] | null {
  if (target.steps === 2) {
    for (let first = 0; first < numbers.length; first += 1) {
      for (let second = 0; second < numbers.length; second += 1) {
        if (first === second) continue;
        const calculation = computeResult([numbers[first], numbers[second]], target.op);
        if (calculation?.result === target.value) return [first, second];
      }
    }
  }

  if (target.steps === 3) {
    for (let first = 0; first < numbers.length; first += 1) {
      for (let second = 0; second < numbers.length; second += 1) {
        for (let third = 0; third < numbers.length; third += 1) {
          if (first === second || first === third || second === third) continue;
          const calculation = computeResult(
            [numbers[first], numbers[second], numbers[third]],
            target.op,
          );
          if (calculation?.result === target.value) return [first, second, third];
        }
      }
    }
  }

  return null;
}
