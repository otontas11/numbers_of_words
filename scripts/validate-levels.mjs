import { findSolutionIndices, generateLevelData } from '../src/game/levels.ts';

const RUN_COUNT = 25;
const LAST_LEVEL = 300;
let checkedLevelCount = 0;

for (let run = 0; run < RUN_COUNT; run += 1) {
  let previousTargetValues = [];

  for (let level = 1; level <= LAST_LEVEL; level += 1) {
    const data = generateLevelData(level, previousTargetValues);
    const expectedNodeCount = level <= 10 ? 5 : level <= 30 ? 6 : 7;
    const expectedTargetCount = level <= 10 ? 3 : 4;
    const targetValues = data.targets.map((target) => target.value);

    if (data.numbers.length !== expectedNodeCount) {
      throw new Error(`Seviye ${level}: düğüm adedi geçersiz.`);
    }
    if (data.targets.length !== expectedTargetCount) {
      throw new Error(`Seviye ${level}: hedef adedi geçersiz.`);
    }
    if (new Set(data.numbers).size !== data.numbers.length) {
      throw new Error(`Seviye ${level}: yinelenen düğüm var.`);
    }
    if (new Set(targetValues).size !== targetValues.length) {
      throw new Error(`Seviye ${level}: yinelenen hedef var.`);
    }
    if (data.targets.some((target) => target.steps !== data.steps || target.op !== data.op)) {
      throw new Error(`Seviye ${level}: işlem veya adım başlıkla uyuşmuyor.`);
    }
    if (targetValues.some((value) => previousTargetValues.includes(value))) {
      throw new Error(`Seviye ${level}: önceki seviyeden yinelenen hedef var.`);
    }
    if (data.targets.some((target) => !findSolutionIndices(target, data.numbers))) {
      throw new Error(`Seviye ${level}: çözülemeyen hedef var.`);
    }

    previousTargetValues = targetValues;
    checkedLevelCount += 1;
  }
}

console.log(`OK: ${checkedLevelCount} prosedürel seviye doğrulandı.`);
