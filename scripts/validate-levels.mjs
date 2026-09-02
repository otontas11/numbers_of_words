import {
  computeResult,
  findSolutionIndices,
  generateLevelData,
  getBonusGemReward,
  getCombinationKey,
  getTargetScore,
  hasCompletedRequiredTargets,
  normalizeLevelData,
} from '../src/game/levels.ts';
import {
  COUNTRY_CHALLENGE_LEVEL,
  COUNTRY_LEVEL_COUNT,
  DESTINATION_LEVEL_COUNT,
  TOTAL_WORLD_LEVELS,
  TOTAL_DESTINATIONS,
  TRAVEL_ROUTES,
  WORLD_COUNTRIES,
  assertTravelCatalog,
  getTravelLevelCompletion,
  resolveTravelLevel,
} from '../src/game/travel.ts';
import { updateWheelSelection } from '../src/game/wheel-selection.ts';

const RUN_COUNT = 5;
const LAST_LEVEL = TOTAL_WORLD_LEVELS + 50;
const TRAINING_CITY_OPERATIONS = [
  ['+', '+', '+'],
  ['+', '-', '+'],
  ['-', '+', '-'],
  ['*', '+', '*'],
  ['/', '*', '/'],
];
let checkedLevelCount = 0;

assertTravelCatalog();

if (
  getTargetScore([20, 18]) !== 76 ||
  getTargetScore([8, 7]) !== 30 ||
  getTargetScore([24, 3, 2]) !== 87
) {
  throw new Error('Ana hedef puan formülü sayı toplamı × adım sayısı değil.');
}

for (const [steps, normalReward, challengeReward] of [
  [2, 4, 6],
  [3, 8, 12],
  [4, 14, 21],
]) {
  if (
    getBonusGemReward(steps, false) !== normalReward ||
    getBonusGemReward(steps, true) !== challengeReward
  ) {
    throw new Error(`${steps} adımlı bonus mücevher ödülü hatalı.`);
  }
}

// İlk Yunanistan destinasyonu Atina, Türkiye'nin 25 puzzle'ından sonra başlar.
// İlk yedi puzzle şehri bitiremez; yalnız 8/8 olan puzzle Atina'yı tamamlar.
const firstGreeceLevel = COUNTRY_LEVEL_COUNT + 1;
for (
  let level = firstGreeceLevel;
  level < firstGreeceLevel + DESTINATION_LEVEL_COUNT - 1;
  level += 1
) {
  if (getTravelLevelCompletion(level).locationCompleted) {
    throw new Error(`Seviye ${level}: Atina 8/8 olmadan tamamlandı sayıldı.`);
  }
}
const firstGreeceCompletionLevel = firstGreeceLevel + DESTINATION_LEVEL_COUNT - 1;
if (!getTravelLevelCompletion(firstGreeceCompletionLevel).locationCompleted) {
  throw new Error(`Seviye ${firstGreeceCompletionLevel}: Atina 8/8 tamamlanmadı sayıldı.`);
}

const subtraction = computeResult([8, 3], '-');
if (subtraction?.expression !== '8 − 3' || subtraction.result !== 5) {
  throw new Error('Çıkarma seçilen sırayla hesaplanmıyor.');
}
if (computeResult([3, 8], '-') !== null) {
  throw new Error('Çıkarma geçersiz ters sırayı kabul ediyor.');
}
const division = computeResult([12, 3], '/');
if (division?.expression !== '12 ÷ 3' || division.result !== 4) {
  throw new Error('Bölme seçilen sırayla hesaplanmıyor.');
}
if (computeResult([3, 12], '/') !== null) {
  throw new Error('Bölme geçersiz ters sırayı kabul ediyor.');
}
if (computeResult([3, 7], '/') !== null) {
  throw new Error('Tam bölünmeyen ikili ondalıklı sonuç üretmemeli.');
}
if (getCombinationKey([3, 12], '/', 4) === getCombinationKey([12, 3], '/', 4)) {
  throw new Error('Bölmede ters sıra ayrı keşif anahtarı olmalı.');
}
if (getCombinationKey([3, 12], '+', 15) !== getCombinationKey([12, 3], '+', 15)) {
  throw new Error('Toplamada ters sıra aynı keşif anahtarı olmalı.');
}

const fullWheelSelection = updateWheelSelection([0], [0, 1, 2, 3, 4, 5, 6], 7);
if (fullWheelSelection.selection.join(',') !== '0,1,2,3,4,5,6') {
  throw new Error('WOW seçimi çarktaki tüm benzersiz düğümlere ilerleyebilmeli.');
}
if (fullWheelSelection.addedSelectionCounts.join(',') !== '2,3,4,5,6,7') {
  throw new Error('Her yeni WOW düğümü kendi yükselen seçim sesi olayını üretmeli.');
}
const rewoundSelection = updateWheelSelection(
  fullWheelSelection.selection,
  [6, 5, 4, 3, 2, 1, 0],
  7,
);
if (rewoundSelection.selection.join(',') !== '0') {
  throw new Error('WOW seçimi önceki düğümlerin üzerinden geriye sarılabilmeli.');
}

for (let run = 0; run < RUN_COUNT; run += 1) {
  let previousTargetValues = [];
  let previousOperation = null;

  for (let level = 1; level <= LAST_LEVEL; level += 1) {
    const data = generateLevelData(level, previousTargetValues);
    const destination = resolveTravelLevel(level);
    const globalCountryIndex = Math.floor((level - 1) / COUNTRY_LEVEL_COUNT);
    const expectedNodeCount = level <= 10 ? 5 : globalCountryIndex < 5 ? 6 : 7;
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
    if (data.targets.some((target) => target.value === data.bonusTarget.value)) {
      throw new Error(`Seviye ${level}: bonus hedef ana hedeflerden farklı değil.`);
    }
    if (
      hasCompletedRequiredTargets(data.targets.length - 1, data) ||
      !hasCompletedRequiredTargets(data.targets.length, data)
    ) {
      throw new Error(`Seviye ${level}: isteğe bağlı bonus ana tamamlama koşulunu bozuyor.`);
    }
    if (
      data.bonusTarget.op !== data.op ||
      ![2, 3, 4].includes(data.bonusTarget.steps) ||
      !findSolutionIndices(data.bonusTarget, data.numbers)
    ) {
      throw new Error(`Seviye ${level}: bonus hedef çözülebilir değil.`);
    }

    if (run === 0 && level === 1) {
      const legacyData = { ...data };
      delete legacyData.bonusTarget;
      const migrated = normalizeLevelData(legacyData);
      if (
        migrated.targets.some((target) => target.value === migrated.bonusTarget.value) ||
        !findSolutionIndices(migrated.bonusTarget, migrated.numbers)
      ) {
        throw new Error('Eski kayıt için bonus hedef migrasyonu geçersiz.');
      }
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
    if (data.countryChallenge !== (data.countryLevel === COUNTRY_CHALLENGE_LEVEL)) {
      throw new Error(`Seviye ${level}: Country Challenge konumu hatalı.`);
    }
    if (data.countryChallenge && data.op !== previousOperation) {
      throw new Error(`Seviye ${level}: Challenge üçüncü destinasyon işlemini sürdürmüyor.`);
    }
    if (!data.countryChallenge && data.locationLevel > 1 && data.op !== previousOperation) {
      throw new Error(`Seviye ${level}: destinasyon içinde işlem değişti.`);
    }
    if (
      globalCountryIndex >= TRAINING_CITY_OPERATIONS.length &&
      !data.countryChallenge &&
      data.locationLevel === 1 &&
      data.op === previousOperation
    ) {
      throw new Error(`Seviye ${level}: yeni destinasyonda işlem değişmedi.`);
    }

    const completion = getTravelLevelCompletion(level);
    if (level <= COUNTRY_LEVEL_COUNT && (data.op !== '+' || data.steps !== 2)) {
      throw new Error(`Seviye ${level}: ilk ülkenin toplama öğretimi bozuldu.`);
    }

    const trainingOperations = TRAINING_CITY_OPERATIONS[globalCountryIndex];
    if (trainingOperations) {
      const trainingLocationIndex = data.countryChallenge ? 2 : data.locationIndex;
      if (
        data.op !== trainingOperations[trainingLocationIndex] ||
        data.steps !== 2 ||
        data.bonusTarget.steps !== 2
      ) {
        throw new Error(`Seviye ${level}: öğretici ülke işlem planına uymuyor.`);
      }
    }

    const expectedLocationCompletion = [
      DESTINATION_LEVEL_COUNT,
      DESTINATION_LEVEL_COUNT * 2,
      DESTINATION_LEVEL_COUNT * 3,
    ].includes(data.countryLevel);
    if (completion.locationCompleted !== expectedLocationCompletion) {
      throw new Error(`Seviye ${level}: destinasyon tamamlama sınırı hatalı.`);
    }
    if (completion.countryCompleted !== (data.countryLevel === COUNTRY_CHALLENGE_LEVEL)) {
      throw new Error(`Seviye ${level}: ülke tamamlama sınırı hatalı.`);
    }

    previousTargetValues = targetValues;
    previousOperation = data.op;
    checkedLevelCount += 1;
  }
}

console.log(
  `OK: ${TRAVEL_ROUTES.length} rota, ${WORLD_COUNTRIES.length} ülke etabı, ${TOTAL_DESTINATIONS} destinasyon, ${TOTAL_WORLD_LEVELS} ana level ve ${checkedLevelCount} prosedürel puzzle doğrulandı.`,
);
