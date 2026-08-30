export type Operation = '+' | '-' | '*' | '/';

export type Target = {
  value: number;
  steps: 2 | 3;
  op: Operation;
};

type Candidate = Target & {
  indices: number[];
};

export type City = {
  name: string;
  emoji: string;
  background: string;
};

export type Country = {
  country: string;
  flag: string;
  cities: City[];
};

export type LevelData = {
  level: number;
  countryIndex: number;
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
};

export type Calculation = {
  expression: string;
  result: number;
};

export const COUNTRIES: Country[] = [
  {
    country: 'TÜRKİYE',
    flag: '🇹🇷',
    cities: [
      {
        name: 'Kapadokya',
        emoji: '🎈',
        background:
          'https://images.unsplash.com/photo-1608889175123-8ee362201f81?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Efes',
        emoji: '🏛️',
        background:
          'https://images.unsplash.com/photo-1599827553202-0e9e4f40f2ef?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Ayasofya',
        emoji: '🕌',
        background:
          'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Göbeklitepe',
        emoji: '🗿',
        background:
          'https://images.unsplash.com/photo-1568832359672-e36cf5d74f54?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Pamukkale',
        emoji: '♨️',
        background:
          'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1200&q=80',
      },
    ],
  },
  {
    country: 'İTALYA',
    flag: '🇮🇹',
    cities: [
      {
        name: 'Kolezyum',
        emoji: '🏛️',
        background:
          'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Venedik',
        emoji: '🚣',
        background:
          'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Pisa',
        emoji: '🗼',
        background:
          'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Floransa',
        emoji: '🎨',
        background:
          'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Pompei',
        emoji: '🌋',
        background:
          'https://images.unsplash.com/photo-1599827553202-0e9e4f40f2ef?auto=format&fit=crop&w=1200&q=80',
      },
    ],
  },
  {
    country: 'JAPONYA',
    flag: '🇯🇵',
    cities: [
      {
        name: 'Fuji Dağı',
        emoji: '🗻',
        background:
          'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Kyoto',
        emoji: '🏯',
        background:
          'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Tokyo',
        emoji: '🗼',
        background:
          'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Nara',
        emoji: '🦌',
        background:
          'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Osaka',
        emoji: '🏯',
        background:
          'https://images.unsplash.com/photo-1590559899731-a382839e5549?auto=format&fit=crop&w=1200&q=80',
      },
    ],
  },
  {
    country: 'MISIR',
    flag: '🇪🇬',
    cities: [
      {
        name: 'Gize Piramitleri',
        emoji: '📐',
        background:
          'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Luksor',
        emoji: '🏛️',
        background:
          'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Abu Simbel',
        emoji: '🗿',
        background:
          'https://images.unsplash.com/photo-1568832359672-e36cf5d74f54?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'İskenderiye',
        emoji: '📚',
        background:
          'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Karnak',
        emoji: '⛩️',
        background:
          'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=80',
      },
    ],
  },
  {
    country: 'FRANSA',
    flag: '🇫🇷',
    cities: [
      {
        name: 'Eyfel Kulesi',
        emoji: '🗼',
        background:
          'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Louvre',
        emoji: '🖼️',
        background:
          'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Nizza',
        emoji: '🏖️',
        background:
          'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Mont Saint-Michel',
        emoji: '🏰',
        background:
          'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Şampanya',
        emoji: '🍾',
        background:
          'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
      },
    ],
  },
  {
    country: 'YUNANİSTAN',
    flag: '🇬🇷',
    cities: [
      {
        name: 'Akropolis',
        emoji: '🏛️',
        background:
          'https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Santorini',
        emoji: '🏛️',
        background:
          'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Meteora',
        emoji: '🏔️',
        background:
          'https://images.unsplash.com/photo-1560067174-c5a3a8f37060?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Delos',
        emoji: '☀️',
        background:
          'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Rodos',
        emoji: '🏰',
        background:
          'https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?auto=format&fit=crop&w=1200&q=80',
      },
    ],
  },
];

export const OPERATION_DETAILS: Record<
  Operation,
  { name: string; symbol: string; color: string; darkColor: string }
> = {
  '+': { name: 'Toplama', symbol: '+', color: '#2563EB', darkColor: '#1D4ED8' },
  '-': { name: 'Çıkarma', symbol: '−', color: '#4F46E5', darkColor: '#3730A3' },
  '*': { name: 'Çarpma', symbol: '×', color: '#D97706', darkColor: '#B45309' },
  '/': { name: 'Bölme', symbol: '÷', color: '#059669', darkColor: '#047857' },
};

const LEVELS_PER_CITY = 10;
const CITIES_PER_COUNTRY = 5;
const LEVELS_PER_COUNTRY = LEVELS_PER_CITY * CITIES_PER_COUNTRY;

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
  const countryIndex =
    Math.floor((normalizedLevel - 1) / LEVELS_PER_COUNTRY) % COUNTRIES.length;
  const cityIndex =
    Math.floor(((normalizedLevel - 1) % LEVELS_PER_COUNTRY) / LEVELS_PER_CITY) %
    CITIES_PER_COUNTRY;
  const cityLevel = ((normalizedLevel - 1) % LEVELS_PER_CITY) + 1;
  const country = COUNTRIES[countryIndex];
  const city = country.cities[cityIndex];
  const rules = getLevelRules(normalizedLevel);

  const excludedValues = new Set(
    excludedTargetValues.filter((value) => Number.isFinite(value)),
  );
  const coverageGoal = Math.min(rules.nodeCount, rules.targetCount * rules.steps);
  let numbers: number[] = [];
  let selectedCandidates: Candidate[] = [];
  let bestCoverage = -1;

  for (let attempt = 0; attempt < 160; attempt += 1) {
    const candidateNumbers = shuffle(getPool(rules.op)).slice(0, rules.nodeCount);
    const candidates = buildCandidates(candidateNumbers, rules.op, rules.steps);
    const selected = selectDiverseCandidates(
      candidates,
      rules.targetCount,
      rules.nodeCount,
      excludedValues,
    );
    const coverage = new Set(selected.flatMap((candidate) => candidate.indices)).size;

    if (
      selected.length > selectedCandidates.length ||
      (selected.length === selectedCandidates.length && coverage > bestCoverage)
    ) {
      numbers = candidateNumbers;
      selectedCandidates = selected;
      bestCoverage = coverage;
    }

    if (selected.length === rules.targetCount && coverage >= coverageGoal) break;
  }

  const targets = selectedCandidates.map(({ value, steps, op }) => ({ value, steps, op }));

  if (targets.length !== rules.targetCount || bestCoverage < coverageGoal) {
    throw new Error(`Seviye ${normalizedLevel} için çözülebilir hedef matrisi üretilemedi.`);
  }

  return {
    level: normalizedLevel,
    countryIndex,
    cityIndex,
    cityLevel,
    country: country.country,
    flag: country.flag,
    city: city.name,
    emoji: city.emoji,
    background: city.background,
    op: rules.op,
    steps: rules.steps,
    numbers,
    targets,
  };
}

export function computeResult(values: number[], op: Operation): Calculation | null {
  const symbol = OPERATION_DETAILS[op].symbol;

  if (values.length === 2) {
    const [left, right] = values;
    if (op === '+') return { expression: `${left} ${symbol} ${right}`, result: left + right };
    if (op === '-') {
      return { expression: `${left} ${symbol} ${right}`, result: Math.abs(left - right) };
    }
    if (op === '*') return { expression: `${left} ${symbol} ${right}`, result: left * right };
    if (right !== 0) {
      return { expression: `${left} ${symbol} ${right}`, result: left / right };
    }
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
