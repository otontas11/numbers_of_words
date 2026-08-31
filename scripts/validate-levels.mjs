import {
  computeResult,
  findSolutionIndices,
  generateLevelData,
  getCombinationKey,
  hasCompletedRequiredTargets,
  normalizeLevelData,
} from '../src/game/levels.ts';
import {
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
let checkedLevelCount = 0;

assertTravelCatalog();

// İlk Yunanistan destinasyonu Atina global 21–27 arasındadır. İlk altı puzzle
// şehir bitiremez; yalnız 7/7 olan 27. puzzle Atina'yı tamamlar.
for (let level = 21; level <= 26; level += 1) {
  if (getTravelLevelCompletion(level).locationCompleted) {
    throw new Error(`Seviye ${level}: Atina 7/7 olmadan tamamlandı sayıldı.`);
  }
}
if (!getTravelLevelCompletion(27).locationCompleted) {
  throw new Error('Seviye 27: Atina 7/7 tamamlanmadı sayıldı.');
}

const subtraction = computeResult([3, 8], '-');
if (subtraction?.expression !== '8 − 3' || subtraction.result !== 5) {
  throw new Error('Çıkarma sonucu büyük sayı önce olacak şekilde kanonik değil.');
}
const reverseDivision = computeResult([3, 12], '/');
if (reverseDivision?.expression !== '12 ÷ 3' || reverseDivision.result !== 4) {
  throw new Error('Bölme, tam bölünen ters sırayı bulamıyor.');
}
if (computeResult([3, 7], '/') !== null) {
  throw new Error('Tam bölünmeyen ikili ondalıklı sonuç üretmemeli.');
}
if (getCombinationKey([3, 12], '/', 4) !== getCombinationKey([12, 3], '/', 4)) {
  throw new Error('Ters sıradaki aynı kombinasyon tek keşif anahtarına dönüşmeli.');
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
    if (data.countryChallenge !== (data.countryLevel === 20)) {
      throw new Error(`Seviye ${level}: Country Challenge konumu hatalı.`);
    }

    const completion = getTravelLevelCompletion(level);
    const expectedLocationCompletion = [7, 14, 19].includes(data.countryLevel);
    if (completion.locationCompleted !== expectedLocationCompletion) {
      throw new Error(`Seviye ${level}: destinasyon tamamlama sınırı hatalı.`);
    }
    if (completion.countryCompleted !== (data.countryLevel === 20)) {
      throw new Error(`Seviye ${level}: ülke tamamlama sınırı hatalı.`);
    }

    previousTargetValues = targetValues;
    checkedLevelCount += 1;
  }
}

console.log(
  `OK: ${TRAVEL_ROUTES.length} rota, ${WORLD_COUNTRIES.length} ülke, ${TOTAL_DESTINATIONS} destinasyon, ${TOTAL_WORLD_LEVELS} ana level ve ${checkedLevelCount} prosedürel puzzle doğrulandı.`,
);
