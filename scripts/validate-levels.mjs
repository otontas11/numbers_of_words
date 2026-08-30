import { findSolutionIndices, generateLevelData } from '../src/game/levels.ts';
import {
  TOTAL_WORLD_LEVELS,
  TOTAL_DESTINATIONS,
  TRAVEL_ROUTES,
  WORLD_COUNTRIES,
  assertTravelCatalog,
  resolveTravelLevel,
} from '../src/game/travel.ts';

const RUN_COUNT = 5;
const LAST_LEVEL = TOTAL_WORLD_LEVELS + 50;
let checkedLevelCount = 0;

assertTravelCatalog();

for (let run = 0; run < RUN_COUNT; run += 1) {
  let previousTargetValues = [];

  for (let level = 1; level <= LAST_LEVEL; level += 1) {
    const data = generateLevelData(level, previousTargetValues);
    const destination = resolveTravelLevel(level);
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
    if (
      data.routeId !== destination.route.id ||
      data.countryId !== destination.country.id ||
      data.locationId !== destination.location.id ||
      data.countryLevel !== destination.countryLevel ||
      data.locationLevel !== destination.locationLevel
    ) {
      throw new Error(`Seviye ${level}: seyahat hedefi rota grafiğiyle uyuşmuyor.`);
    }
    if (data.countryChallenge !== (data.countryLevel === 20)) {
      throw new Error(`Seviye ${level}: Country Challenge konumu hatalı.`);
    }

    previousTargetValues = targetValues;
    checkedLevelCount += 1;
  }
}

console.log(
  `OK: ${TRAVEL_ROUTES.length} rota, ${WORLD_COUNTRIES.length} ülke, ${TOTAL_DESTINATIONS} destinasyon, ${TOTAL_WORLD_LEVELS} ana level ve ${checkedLevelCount} prosedürel puzzle doğrulandı.`,
);
