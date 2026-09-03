import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useEffect, useState } from 'react';

export const SUPPORTED_LANGUAGES = ['tr', 'en', 'ru'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = '@numbers-of-wonders/language';

const translations = {
  tr: {
    'language.tr': 'Türkçe',
    'language.en': 'English',
    'language.ru': 'Русский',
    'settings.title': 'Oyun Ayarları',
    'settings.subtitle': 'Sayı yolculuğunda kullanmak istediğin sesleri seç.',
    'settings.sound': 'Ses',
    'settings.soundSubtitle': 'Sayı, cevap ve başarı sesleri',
    'settings.music': 'Müzik',
    'settings.musicSubtitle': 'Sakin yolculuk arka plan müziği',
    'settings.volume': 'Müzik seviyesi',
    'settings.language': 'Dil',
    'settings.done': 'TAMAM',
    'settings.open': 'açık',
    'settings.closed': 'kapalı',
    'settings.closeA11y': 'Ayarları kapat',
    'settings.openA11y': 'Oyun ayarlarını aç',
    'settings.volumeA11y': 'Müzik seviyesi yüzde {{value}}',
    'common.score': 'PUAN',
    'common.gems': 'ELMAS',
    'common.gem': 'mücevher',
    'common.level': 'SEVİYE',
    'common.levelLower': 'bölüm',
    'common.puzzle': 'puzzle',
    'common.continue': 'DEVAM ET',
    'common.locked': 'KİLİTLİ',
    'common.challenge': 'CHALLENGE',
    'common.closeWindow': 'Pencereyi kapat',
    'footer.home': 'ANASAYFA',
    'footer.map': 'HARİTA',
    'footer.collection': 'KOLEKSİYON',
    'footer.tasks': 'GÖREVLER',
    'footer.homeA11y': 'Ana sayfayı aç',
    'footer.mapA11y': 'Dünya haritasını aç',
    'footer.collectionA11y': 'Pasaport koleksiyonunu aç',
    'footer.tasksA11y': 'Görevleri aç',
    'home.pointsA11y': '{{value}} puan',
    'home.gemsA11y': '{{value}} mücevher',
    'home.playA11y': 'Seviye {{level}}, devam et',
    'home.playHint': 'Kaldığın sayı bulmacasını açar',
    'home.worldRoute': 'Dünya rotası',
    'home.routeProgress': '{{route}}, {{progress}}/{{total}} ülke tamamlandı',
    'home.countryDone': 'tamamlandı',
    'home.currentCountry': 'mevcut ülke',
    'home.notUnlocked': 'henüz açılmadı',
    'home.discovered': '🌍 {{done}}/{{total}} ülke keşfedildi',
    'profile.title': 'PROFİL',
    'profile.explorer': 'Dünya Gezgini',
    'profile.location': 'Seviye {{level}} • {{country}} • {{city}}',
    'profile.difficultyEyebrow': 'OYUN ZORLUK AYARI',
    'profile.learningLevel': 'Öğrenme seviyesi: {{level}}',
    'profile.difficultyAdvanced': 'İLERİ',
    'profile.difficultySupported': 'DESTEKLİ',
    'profile.difficultyBalanced': 'DENGELİ',
    'profile.difficultyPending': 'Birkaç puzzle daha çözüldüğünde sana uygun zorluk seviyesi netleşecek.',
    'profile.difficultyHarder': 'Son performansına göre sonraki şehirlerde sayı havuzu biraz daha geniş olacak.',
    'profile.difficultyEasier': 'Son performansına göre sonraki şehirlerde sayı havuzu biraz daha erişilebilir olacak.',
    'profile.difficultySame': 'Son performansına göre mevcut zorluk seviyesi korunuyor.',
    'profile.difficultyMeta': 'Son {{count}} puzzle değerlendirildi • Zorluk yalnız yeni şehirde değişir',
    'profile.completedPuzzles': 'TAMAMLANAN PUZZLE',
    'profile.country': 'ÜLKE',
    'profile.gem': 'MÜCEVHER',
    'profile.currentJourney': 'MEVCUT YOLCULUK',
    'profile.worldTour': 'Dünya turu: {{done}}/{{total}}',
    'profile.playerLevel': 'Oyuncu seviyesi: {{level}}',
    'profile.bonuses': '⭐ {{count}} bonus kombinasyon keşfedildi',
    'profile.passport': 'Seyahat Pasaportu',
    'profile.passportStamps': '{{done}}/{{total}} ülke damgası',
    'profile.openPassport': 'Seyahat pasaportunu aç',
    'profile.resume': '▶  BÖLÜME DEVAM ET',
    'profile.resumeA11y': 'Kaldığın bölüme devam et',
    'passport.label': 'PASAPORT',
    'passport.approved': 'ONAYLANDI',
    'passport.title': 'PASAPORT KOLEKSİYONU',
    'passport.earned': '{{done}}/{{total}} kazanılmış pasaport',
    'passport.emptyTitle': 'Henüz pasaport kazanılmadı',
    'passport.emptyText': 'Bir ülkenin tüm bölümlerini tamamladığında gerçek seyahat damgan burada görünecek.',
    'map.routeA11y': '{{route}}, {{done}}/{{total}} bölüm',
    'map.currentPuzzleHint': 'Mevcut sayı bulmacasını açar',
    'map.unlockCountry': 'Önceki ülkeyi tamamlayarak aç',
    'map.countryCompleted': 'Ülke tamamlandı',
    'map.currentJourney': 'Mevcut yolculuk',
    'map.ready': 'Keşfedilmeye hazır',
    'map.completePreviousRoute': 'Önce {{route}} rotasını tamamla',
    'map.countryUnavailable': 'Bu ülke seyahat rotasında henüz açılmadı',
    'map.completedCurrent': '{{country}} tamamlandı ✓ • Mevcut yolculuk: {{current}}',
    'map.currentCountry': 'Mevcut ülke: {{country}}',
    'map.backToRoutes': 'Rota listesine dön',
    'map.route': 'ROTA {{number}}',
    'map.routeSummary': '{{countries}} ülke • {{levels}} bölüm',
    'game.destinationComplete': 'DESTİNASYON TAMAMLANDI',
    'game.newDestination': 'YENİ DESTİNASYON AÇILDI',
    'game.targetA11y': '{{value}} hedefi, {{steps}} sayı',
    'game.bonusA11y': 'İsteğe bağlı bonus hedef {{value}}, ödül {{reward}} mücevher',
    'game.combine': 'SAYILARI BİRLEŞTİR',
    'game.bonusEarned': '💎 +{{reward}} mücevher kazanıldı',
    'game.makeBonus': 'Sağdaki bonus sayısını oluştur • +{{reward}} mücevher',
    'game.operationType': 'İŞLEM TÜRÜ',
    'game.stepCount': 'ADIM SAYISI',
    'game.instruction': 'Ana hedefleri çöz; bonus mücevher isteğe bağlı!',
    'game.homeA11y': 'Ana sayfaya dön',
    'game.cityProgress': '{{country}} şehir ilerlemesi',
    'game.challengeProgress': 'Challenge ilerlemesi {{progress}}/1',
    'game.addition': 'Toplama', 'game.subtraction': 'Çıkarma', 'game.multiplication': 'Çarpma', 'game.division': 'Bölme',
    'tutorial.eyebrow': 'OYUN EĞİTİMİ · {{current}}/{{total}}', 'tutorial.bonusTitle': '💎 BONUS HEDEFİ BUL', 'tutorial.targetTitle': 'HEDEF SAYIYI BUL', 'tutorial.explanation': '{{operation}} işlemi • {{steps}} adım', 'tutorial.shuffleInstruction': 'Önce sayıları karıştır.', 'tutorial.hintInstruction': 'Şimdi ipucuna dokun; çözüm gösterilecek.', 'tutorial.demoInstruction': 'İpucu: sayıları sırayla bağlanır.', 'tutorial.practiceInstruction': 'Aynı soruyu şimdi sen çöz.', 'tutorial.connectInstruction': 'Doğru sayıları sırayla birleştir.', 'tutorial.practiceButton': 'ŞİMDİ SEN ÇÖZ', 'tutorial.shuffleButton': '↻ KARIŞTIR', 'tutorial.hintButton': '💡 İPUCU', 'tutorial.expression': '{{expression}} = {{target}}',
    'wheel.a11y': 'Sayı bağlantı çemberi',
    'wheel.hint': 'İpucu • {{count}}',
    'wheel.hintA11y': 'İpucu göster, {{count}} kredi kaldı',
    'wheel.noHints': 'İpucu kredisi bitti',
    'wheel.shuffle': 'Karıştır',
    'wheel.shuffleA11y': 'Sayıları karıştır',
    'modal.passportTitle': 'Pasaport Koleksiyonu',
    'modal.passportFooter': 'Her ülkenin 3 destinasyonu ve Country Challenge’ı tamamlandığında yeni bir pasaport kazanılır. Koleksiyon: {{done}}/{{total}}.',
    'modal.firstPassport': 'Bir ülkenin tüm bölümlerini tamamladığında ilk pasaportun burada yer alacak.',
    'modal.passportWon': 'PASAPORT KAZANILDI ✓',
    'modal.startGame': 'Oyuna başla',
    'modal.start': 'BAŞLA',
    'modal.finalGame': 'SON OYUN',
    'modal.countryChallenge': 'COUNTRY CHALLENGE',
    'modal.worldFinal': 'WORLD TOUR FINAL CHALLENGE',
    'modal.masterTour': 'Master World Tour turuna geç',
    'modal.goToCountry': '{{country}} ülkesine geç',
    'modal.masterTourButton': 'MASTER WORLD TOUR’A GEÇ',
    'modal.countryButton': '{{flag}} {{country}}’A GEÇ',
    'modal.worldDiscovered': '{{count}} / {{count}} ülke keşfedildi',
    'modal.countryReward': '{{count}} / {{count}} puzzle • Pasaport damgası kazanıldı',
    'modal.countryComplete': '{{country}} Tamamlandı!',
    'modal.newRouteStamp': 'Yeni Rota Mührü',
    'modal.passportStamp': 'Pasaport Damgası',
    'modal.newLeg': 'YENİ ROTA ETABI AÇILDI',
    'modal.firstStop': 'İlk durak: {{destination}}',
    'modal.specialRewards': 'ÖZEL ÖDÜLLER',
    'modal.worldLit': 'Dünya haritasının tamamı aydınlandı.',
    'feedback.tryAnother': 'Başka bir sıra dene',
    'feedback.invalid': 'Bu sıra geçerli bir işlem oluşturmuyor',
    'feedback.alreadyFound': 'Bu kombinasyonu zaten keşfettin',
    'feedback.noHints': 'İpucu kredin bitti • Ödüllü reklam veya yeni rota ile +3 kazan',
    'feedback.hintUnavailable': 'Bu hedef için ipucu hazırlanamadı',
    'feedback.followGlow': 'Parlayan sayıları sırayla birleştir',
    'feedback.newRouteStamp': 'yeni rota mührü', 'feedback.passportStamp': 'pasaport damgası',
    'feedback.worldComplete': '{{done}}/{{total}} ülke • WORLD TOUR COMPLETED! Golden Compass ve World Explorer kazanıldı',
    'feedback.countryComplete': '{{country}} tamamlandı! {{passport}} ve {{landmark}} kartı kazanıldı',
    'feedback.locationComplete': '{{city}} tamamlandı! {{next}}', 'feedback.challengeUnlocked': '{{country}} Challenge açıldı', 'feedback.destinationUnlocked': '{{destination}} açıldı',
    'feedback.puzzleComplete': 'Puzzle {{current}}/{{total}} tamamlandı • {{city}}',
    'feedback.levelComplete': 'Bölüm tamamlandı • +{{points}} puan • Harika! {{message}} 🎉',
    'feedback.targetFound': 'Hedef bulundu: {{result}} ✓ • +{{points}} puan',
    'feedback.bonusSolved': '💎 Bonus hedef çözüldü! +{{reward}} mücevher',
    'feedback.bonusDiscovery': '⭐ Bonus Keşif! +{{reward}} mücevher • {{expression}} = {{result}}',
    'feedback.masterStarted': '🌍 Master World Tour başladı!', 'feedback.countryUnlocked': '{{flag}} {{country}} açıldı • {{destination}}{{reward}}', 'feedback.routeHintReward': ' • Yeni rota ödülü: +{{count}} ipucu',
  },
  en: {
    'language.tr': 'Türkçe', 'language.en': 'English', 'language.ru': 'Русский',
    'settings.title': 'Game Settings', 'settings.subtitle': 'Choose the sounds and language for your number journey.', 'settings.sound': 'Sound', 'settings.soundSubtitle': 'Number, answer, and success sounds', 'settings.music': 'Music', 'settings.musicSubtitle': 'Calm journey background music', 'settings.volume': 'Music volume', 'settings.language': 'Language', 'settings.done': 'DONE', 'settings.open': 'on', 'settings.closed': 'off', 'settings.closeA11y': 'Close settings', 'settings.openA11y': 'Open game settings', 'settings.volumeA11y': 'Music volume {{value}} percent',
    'common.score': 'SCORE', 'common.gems': 'GEMS', 'common.gem': 'gem', 'common.level': 'LEVEL', 'common.levelLower': 'level', 'common.puzzle': 'puzzle', 'common.continue': 'CONTINUE', 'common.locked': 'LOCKED', 'common.challenge': 'CHALLENGE', 'common.closeWindow': 'Close window',
    'footer.home': 'HOME', 'footer.map': 'MAP', 'footer.collection': 'COLLECTION', 'footer.tasks': 'TASKS', 'footer.homeA11y': 'Open home', 'footer.mapA11y': 'Open world map', 'footer.collectionA11y': 'Open passport collection', 'footer.tasksA11y': 'Open tasks',
    'home.pointsA11y': '{{value}} points', 'home.gemsA11y': '{{value}} gems', 'home.playA11y': 'Level {{level}}, continue', 'home.playHint': 'Opens your current number puzzle', 'home.worldRoute': 'World route', 'home.routeProgress': '{{route}}, {{progress}}/{{total}} countries completed', 'home.countryDone': 'completed', 'home.currentCountry': 'current country', 'home.notUnlocked': 'not unlocked yet', 'home.discovered': '🌍 {{done}}/{{total}} countries discovered',
    'profile.title': 'PROFILE', 'profile.explorer': 'World Explorer', 'profile.location': 'Level {{level}} • {{country}} • {{city}}', 'profile.difficultyEyebrow': 'GAME DIFFICULTY', 'profile.learningLevel': 'Learning level: {{level}}', 'profile.difficultyAdvanced': 'ADVANCED', 'profile.difficultySupported': 'SUPPORTED', 'profile.difficultyBalanced': 'BALANCED', 'profile.difficultyPending': 'Solve a few more puzzles to determine your ideal difficulty.', 'profile.difficultyHarder': 'Based on your recent performance, the number pool will be slightly larger in the next cities.', 'profile.difficultyEasier': 'Based on your recent performance, the number pool will be a little more accessible in the next cities.', 'profile.difficultySame': 'Your current difficulty is being maintained based on recent performance.', 'profile.difficultyMeta': '{{count}} recent puzzles evaluated • Difficulty changes only in a new city', 'profile.completedPuzzles': 'PUZZLES COMPLETED', 'profile.country': 'COUNTRY', 'profile.gem': 'GEMS', 'profile.currentJourney': 'CURRENT JOURNEY', 'profile.worldTour': 'World tour: {{done}}/{{total}}', 'profile.playerLevel': 'Player level: {{level}}', 'profile.bonuses': '⭐ {{count}} bonus combinations discovered', 'profile.passport': 'Travel Passport', 'profile.passportStamps': '{{done}}/{{total}} country stamps', 'profile.openPassport': 'Open travel passport', 'profile.resume': '▶  CONTINUE LEVEL', 'profile.resumeA11y': 'Continue your current level',
    'passport.label': 'PASSPORT', 'passport.approved': 'APPROVED', 'passport.title': 'PASSPORT COLLECTION', 'passport.earned': '{{done}}/{{total}} passports earned', 'passport.emptyTitle': 'No passports earned yet', 'passport.emptyText': 'Complete every level in a country to see its authentic travel stamp here.',
    'map.routeA11y': '{{route}}, {{done}}/{{total}} levels', 'map.currentPuzzleHint': 'Opens the current number puzzle', 'map.unlockCountry': 'Complete the previous country to unlock', 'map.countryCompleted': 'Country completed', 'map.currentJourney': 'Current journey', 'map.ready': 'Ready to explore', 'map.completePreviousRoute': 'Complete the {{route}} route first', 'map.countryUnavailable': 'This country has not been unlocked on the travel route yet', 'map.completedCurrent': '{{country}} completed ✓ • Current journey: {{current}}', 'map.currentCountry': 'Current country: {{country}}', 'map.backToRoutes': 'Back to route list', 'map.route': 'ROUTE {{number}}', 'map.routeSummary': '{{countries}} countries • {{levels}} levels',
    'game.destinationComplete': 'DESTINATION COMPLETED', 'game.newDestination': 'NEW DESTINATION UNLOCKED', 'game.targetA11y': 'Target {{value}}, {{steps}} numbers', 'game.bonusA11y': 'Optional bonus target {{value}}, reward {{reward}} gems', 'game.combine': 'CONNECT THE NUMBERS', 'game.bonusEarned': '💎 +{{reward}} gems earned', 'game.makeBonus': 'Create the bonus number on the right • +{{reward}} gems', 'game.operationType': 'OPERATION', 'game.stepCount': 'NUMBER OF STEPS', 'game.instruction': 'Solve the main targets; the bonus gem is optional!', 'game.homeA11y': 'Return to home', 'game.cityProgress': '{{country}} city progress', 'game.challengeProgress': 'Challenge progress {{progress}}/1', 'game.addition': 'Addition', 'game.subtraction': 'Subtraction', 'game.multiplication': 'Multiplication', 'game.division': 'Division',
    'tutorial.eyebrow': 'GAME TUTORIAL · {{current}}/{{total}}', 'tutorial.bonusTitle': '💎 FIND THE BONUS TARGET', 'tutorial.targetTitle': 'FIND THE TARGET', 'tutorial.explanation': '{{operation}} operation • {{steps}} steps', 'tutorial.shuffleInstruction': 'Shuffle the numbers first.', 'tutorial.hintInstruction': 'Tap the hint to reveal the solution.', 'tutorial.demoInstruction': 'Hint: connect the numbers in order.', 'tutorial.practiceInstruction': 'Now solve the same puzzle yourself.', 'tutorial.connectInstruction': 'Connect the correct numbers in order.', 'tutorial.practiceButton': 'SOLVE IT YOURSELF', 'tutorial.shuffleButton': '↻ SHUFFLE', 'tutorial.hintButton': '💡 HINT', 'tutorial.expression': '{{expression}} = {{target}}',
    'wheel.a11y': 'Number connection wheel', 'wheel.hint': 'Hint • {{count}}', 'wheel.hintA11y': 'Show hint, {{count}} credits left', 'wheel.noHints': 'No hint credits left', 'wheel.shuffle': 'Shuffle', 'wheel.shuffleA11y': 'Shuffle numbers',
    'modal.passportTitle': 'Passport Collection', 'modal.passportFooter': 'Earn a new passport by completing all 3 destinations and the Country Challenge. Collection: {{done}}/{{total}}.', 'modal.firstPassport': 'Complete all levels in a country and your first passport will appear here.', 'modal.passportWon': 'PASSPORT EARNED ✓', 'modal.startGame': 'Start game', 'modal.start': 'START', 'modal.finalGame': 'FINAL GAME', 'modal.countryChallenge': 'COUNTRY CHALLENGE', 'modal.worldFinal': 'WORLD TOUR FINAL CHALLENGE', 'modal.masterTour': 'Continue to the Master World Tour', 'modal.goToCountry': 'Continue to {{country}}', 'modal.masterTourButton': 'START MASTER WORLD TOUR', 'modal.countryButton': '{{flag}} GO TO {{country}}', 'modal.worldDiscovered': '{{count}} / {{count}} countries discovered', 'modal.countryReward': '{{count}} / {{count}} puzzles • Passport stamp earned', 'modal.countryComplete': '{{country}} Completed!', 'modal.newRouteStamp': 'New Route Stamp', 'modal.passportStamp': 'Passport Stamp', 'modal.newLeg': 'NEW ROUTE LEG UNLOCKED', 'modal.firstStop': 'First stop: {{destination}}', 'modal.specialRewards': 'SPECIAL REWARDS', 'modal.worldLit': 'The entire world map is now illuminated.',
    'feedback.tryAnother': 'Try another order', 'feedback.invalid': 'This order does not form a valid operation', 'feedback.alreadyFound': 'You already discovered this combination', 'feedback.noHints': 'No hint credits left • Earn +3 from a rewarded ad or a new route', 'feedback.hintUnavailable': 'No hint could be prepared for this target', 'feedback.followGlow': 'Connect the glowing numbers in order',
    'feedback.newRouteStamp': 'a new route stamp', 'feedback.passportStamp': 'a passport stamp', 'feedback.worldComplete': '{{done}}/{{total}} countries • WORLD TOUR COMPLETED! Golden Compass and World Explorer earned', 'feedback.countryComplete': '{{country}} completed! You earned {{passport}} and the {{landmark}} card', 'feedback.locationComplete': '{{city}} completed! {{next}}', 'feedback.challengeUnlocked': '{{country}} Challenge unlocked', 'feedback.destinationUnlocked': '{{destination}} unlocked', 'feedback.puzzleComplete': 'Puzzle {{current}}/{{total}} completed • {{city}}', 'feedback.levelComplete': 'Level completed • +{{points}} points • Great! {{message}} 🎉', 'feedback.targetFound': 'Target found: {{result}} ✓ • +{{points}} points', 'feedback.bonusSolved': '💎 Bonus target solved! +{{reward}} gems', 'feedback.bonusDiscovery': '⭐ Bonus Discovery! +{{reward}} gem • {{expression}} = {{result}}',
    'feedback.masterStarted': '🌍 Master World Tour started!', 'feedback.countryUnlocked': '{{flag}} {{country}} unlocked • {{destination}}{{reward}}', 'feedback.routeHintReward': ' • New route reward: +{{count}} hints',
  },
  ru: {
    'language.tr': 'Türkçe', 'language.en': 'English', 'language.ru': 'Русский',
    'settings.title': 'Настройки игры', 'settings.subtitle': 'Выберите звуки и язык для путешествия по миру чисел.', 'settings.sound': 'Звук', 'settings.soundSubtitle': 'Звуки чисел, ответов и успеха', 'settings.music': 'Музыка', 'settings.musicSubtitle': 'Спокойная фоновая музыка', 'settings.volume': 'Громкость музыки', 'settings.language': 'Язык', 'settings.done': 'ГОТОВО', 'settings.open': 'вкл.', 'settings.closed': 'выкл.', 'settings.closeA11y': 'Закрыть настройки', 'settings.openA11y': 'Открыть настройки игры', 'settings.volumeA11y': 'Громкость музыки {{value}} процентов',
    'common.score': 'ОЧКИ', 'common.gems': 'АЛМАЗЫ', 'common.gem': 'алмаз', 'common.level': 'УРОВЕНЬ', 'common.levelLower': 'уровень', 'common.puzzle': 'головоломка', 'common.continue': 'ПРОДОЛЖИТЬ', 'common.locked': 'ЗАКРЫТО', 'common.challenge': 'ИСПЫТАНИЕ', 'common.closeWindow': 'Закрыть окно',
    'footer.home': 'ГЛАВНАЯ', 'footer.map': 'КАРТА', 'footer.collection': 'КОЛЛЕКЦИЯ', 'footer.tasks': 'ЗАДАНИЯ', 'footer.homeA11y': 'Открыть главную', 'footer.mapA11y': 'Открыть карту мира', 'footer.collectionA11y': 'Открыть коллекцию паспортов', 'footer.tasksA11y': 'Открыть задания',
    'home.pointsA11y': '{{value}} очков', 'home.gemsA11y': '{{value}} алмазов', 'home.playA11y': 'Уровень {{level}}, продолжить', 'home.playHint': 'Открывает текущую головоломку', 'home.worldRoute': 'Мировой маршрут', 'home.routeProgress': '{{route}}, пройдено стран: {{progress}}/{{total}}', 'home.countryDone': 'пройдено', 'home.currentCountry': 'текущая страна', 'home.notUnlocked': 'ещё не открыто', 'home.discovered': '🌍 Открыто стран: {{done}}/{{total}}',
    'profile.title': 'ПРОФИЛЬ', 'profile.explorer': 'Исследователь мира', 'profile.location': 'Уровень {{level}} • {{country}} • {{city}}', 'profile.difficultyEyebrow': 'СЛОЖНОСТЬ ИГРЫ', 'profile.learningLevel': 'Уровень обучения: {{level}}', 'profile.difficultyAdvanced': 'ВЫСОКИЙ', 'profile.difficultySupported': 'С ПОДДЕРЖКОЙ', 'profile.difficultyBalanced': 'СБАЛАНСИРОВАННЫЙ', 'profile.difficultyPending': 'Решите ещё несколько головоломок, чтобы определить подходящую сложность.', 'profile.difficultyHarder': 'С учётом последних результатов набор чисел в следующих городах станет немного шире.', 'profile.difficultyEasier': 'С учётом последних результатов набор чисел в следующих городах станет немного доступнее.', 'profile.difficultySame': 'Текущая сложность сохраняется с учётом последних результатов.', 'profile.difficultyMeta': 'Оценено последних головоломок: {{count}} • Сложность меняется только в новом городе', 'profile.completedPuzzles': 'РЕШЕНО ГОЛОВОЛОМОК', 'profile.country': 'СТРАНЫ', 'profile.gem': 'АЛМАЗЫ', 'profile.currentJourney': 'ТЕКУЩЕЕ ПУТЕШЕСТВИЕ', 'profile.worldTour': 'Тур по миру: {{done}}/{{total}}', 'profile.playerLevel': 'Уровень игрока: {{level}}', 'profile.bonuses': '⭐ Найдено бонусных комбинаций: {{count}}', 'profile.passport': 'Паспорт путешественника', 'profile.passportStamps': 'Штампы стран: {{done}}/{{total}}', 'profile.openPassport': 'Открыть паспорт путешественника', 'profile.resume': '▶  ПРОДОЛЖИТЬ УРОВЕНЬ', 'profile.resumeA11y': 'Продолжить текущий уровень',
    'passport.label': 'ПАСПОРТ', 'passport.approved': 'ОДОБРЕНО', 'passport.title': 'КОЛЛЕКЦИЯ ПАСПОРТОВ', 'passport.earned': 'Получено паспортов: {{done}}/{{total}}', 'passport.emptyTitle': 'Паспортов пока нет', 'passport.emptyText': 'Завершите все уровни страны, и здесь появится настоящий туристический штамп.',
    'map.routeA11y': '{{route}}, уровни: {{done}}/{{total}}', 'map.currentPuzzleHint': 'Открывает текущую головоломку', 'map.unlockCountry': 'Завершите предыдущую страну', 'map.countryCompleted': 'Страна пройдена', 'map.currentJourney': 'Текущее путешествие', 'map.ready': 'Готово к исследованию', 'map.completePreviousRoute': 'Сначала завершите маршрут «{{route}}»', 'map.countryUnavailable': 'Эта страна ещё не открыта на маршруте', 'map.completedCurrent': '{{country}} пройдена ✓ • Текущее путешествие: {{current}}', 'map.currentCountry': 'Текущая страна: {{country}}', 'map.backToRoutes': 'К списку маршрутов', 'map.route': 'МАРШРУТ {{number}}', 'map.routeSummary': 'Страны: {{countries}} • уровни: {{levels}}',
    'game.destinationComplete': 'ПУНКТ НАЗНАЧЕНИЯ ПРОЙДЕН', 'game.newDestination': 'ОТКРЫТ НОВЫЙ ПУНКТ', 'game.targetA11y': 'Цель {{value}}, чисел: {{steps}}', 'game.bonusA11y': 'Дополнительная цель {{value}}, награда: {{reward}} алмазов', 'game.combine': 'СОЕДИНИТЕ ЧИСЛА', 'game.bonusEarned': '💎 Получено алмазов: +{{reward}}', 'game.makeBonus': 'Составьте бонусное число справа • +{{reward}} алмазов', 'game.operationType': 'ОПЕРАЦИЯ', 'game.stepCount': 'КОЛИЧЕСТВО ШАГОВ', 'game.instruction': 'Решите основные цели; бонусный алмаз необязателен!', 'game.homeA11y': 'Вернуться на главную', 'game.cityProgress': 'Прогресс города: {{country}}', 'game.challengeProgress': 'Прогресс испытания {{progress}}/1', 'game.addition': 'Сложение', 'game.subtraction': 'Вычитание', 'game.multiplication': 'Умножение', 'game.division': 'Деление',
    'tutorial.eyebrow': 'ОБУЧЕНИЕ · {{current}}/{{total}}', 'tutorial.bonusTitle': '💎 НАЙДИТЕ БОНУСНУЮ ЦЕЛЬ', 'tutorial.targetTitle': 'НАЙДИТЕ ЦЕЛЬ', 'tutorial.explanation': '{{operation}} • шагов: {{steps}}', 'tutorial.shuffleInstruction': 'Сначала перемешайте числа.', 'tutorial.hintInstruction': 'Нажмите подсказку, чтобы увидеть решение.', 'tutorial.demoInstruction': 'Подсказка: соединяйте числа по порядку.', 'tutorial.practiceInstruction': 'Теперь решите ту же задачу сами.', 'tutorial.connectInstruction': 'Соедините правильные числа по порядку.', 'tutorial.practiceButton': 'РЕШИТЕ САМИ', 'tutorial.shuffleButton': '↻ ПЕРЕМЕШАТЬ', 'tutorial.hintButton': '💡 ПОДСКАЗКА', 'tutorial.expression': '{{expression}} = {{target}}',
    'wheel.a11y': 'Круг соединения чисел', 'wheel.hint': 'Подсказка • {{count}}', 'wheel.hintA11y': 'Показать подсказку, осталось: {{count}}', 'wheel.noHints': 'Подсказки закончились', 'wheel.shuffle': 'Перемешать', 'wheel.shuffleA11y': 'Перемешать числа',
    'modal.passportTitle': 'Коллекция паспортов', 'modal.passportFooter': 'Новый паспорт выдаётся за 3 пункта назначения и испытание страны. Коллекция: {{done}}/{{total}}.', 'modal.firstPassport': 'Завершите все уровни страны, и здесь появится ваш первый паспорт.', 'modal.passportWon': 'ПАСПОРТ ПОЛУЧЕН ✓', 'modal.startGame': 'Начать игру', 'modal.start': 'НАЧАТЬ', 'modal.finalGame': 'ФИНАЛЬНАЯ ИГРА', 'modal.countryChallenge': 'ИСПЫТАНИЕ СТРАНЫ', 'modal.worldFinal': 'ФИНАЛЬНОЕ ИСПЫТАНИЕ МИРОВОГО ТУРА', 'modal.masterTour': 'Перейти в мастер-тур по миру', 'modal.goToCountry': 'Перейти в страну {{country}}', 'modal.masterTourButton': 'НАЧАТЬ МАСТЕР-ТУР', 'modal.countryButton': '{{flag}} ПЕРЕЙТИ: {{country}}', 'modal.worldDiscovered': 'Открыто стран: {{count}} / {{count}}', 'modal.countryReward': 'Головоломки: {{count}} / {{count}} • Получен штамп', 'modal.countryComplete': '{{country}} — пройдено!', 'modal.newRouteStamp': 'Новый штамп маршрута', 'modal.passportStamp': 'Штамп в паспорт', 'modal.newLeg': 'ОТКРЫТ НОВЫЙ ЭТАП МАРШРУТА', 'modal.firstStop': 'Первая остановка: {{destination}}', 'modal.specialRewards': 'ОСОБЫЕ НАГРАДЫ', 'modal.worldLit': 'Вся карта мира теперь освещена.',
    'feedback.tryAnother': 'Попробуйте другой порядок', 'feedback.invalid': 'Этот порядок не образует допустимую операцию', 'feedback.alreadyFound': 'Вы уже нашли эту комбинацию', 'feedback.noHints': 'Подсказки закончились • Получите +3 за рекламу или новый маршрут', 'feedback.hintUnavailable': 'Не удалось подготовить подсказку для этой цели', 'feedback.followGlow': 'Соедините светящиеся числа по порядку',
    'feedback.newRouteStamp': 'новый штамп маршрута', 'feedback.passportStamp': 'штамп в паспорт', 'feedback.worldComplete': 'Открыто стран: {{done}}/{{total}} • WORLD TOUR COMPLETED! Получены Golden Compass и World Explorer', 'feedback.countryComplete': '{{country}} пройдена! Получены {{passport}} и карточка «{{landmark}}»', 'feedback.locationComplete': '{{city}} пройден! {{next}}', 'feedback.challengeUnlocked': 'Открыто испытание страны {{country}}', 'feedback.destinationUnlocked': 'Открыто: {{destination}}', 'feedback.puzzleComplete': 'Головоломка {{current}}/{{total}} решена • {{city}}', 'feedback.levelComplete': 'Уровень пройден • +{{points}} очков • Отлично! {{message}} 🎉', 'feedback.targetFound': 'Цель найдена: {{result}} ✓ • +{{points}} очков', 'feedback.bonusSolved': '💎 Бонусная цель решена! +{{reward}} алмазов', 'feedback.bonusDiscovery': '⭐ Бонусное открытие! +{{reward}} алмаз • {{expression}} = {{result}}',
    'feedback.masterStarted': '🌍 Начался мастер-тур по миру!', 'feedback.countryUnlocked': '{{flag}} {{country}} открыта • {{destination}}{{reward}}', 'feedback.routeHintReward': ' • Награда за маршрут: +{{count}} подсказки',
  },
} as const;

export type TranslationKey = keyof typeof translations.tr;
type TranslationParams = Record<string, string | number>;

function detectLanguage(): Language {
  const language = getLocales()[0]?.languageCode?.toLowerCase();
  return SUPPORTED_LANGUAGES.includes(language as Language) ? (language as Language) : 'en';
}

let currentLanguage: Language = detectLanguage();
let hasManualLanguageSelection = false;
const listeners = new Set<() => void>();

void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((savedLanguage) => {
  // Do not let a late storage read overwrite a choice made while the app was
  // starting (this is especially visible on the home footer).
  if (!hasManualLanguageSelection && SUPPORTED_LANGUAGES.includes(savedLanguage as Language) && savedLanguage !== currentLanguage) {
    currentLanguage = savedLanguage as Language;
    listeners.forEach((listener) => listener());
  }
});

export function setLanguage(language: Language) {
  hasManualLanguageSelection = true;
  if (language === currentLanguage) return;
  currentLanguage = language;
  listeners.forEach((listener) => listener());
  void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function translate(key: TranslationKey, params: TranslationParams = {}) {
  const dictionary = translations[currentLanguage] as Record<TranslationKey, string>;
  return (dictionary[key] ?? translations.tr[key]).replace(/{{(\w+)}}/g, (_, name: string) =>
    String(params[name] ?? `{{${name}}}`),
  );
}

export function useI18n() {
  const [language, setObservedLanguage] = useState(currentLanguage);

  useEffect(() => {
    const listener = () => setObservedLanguage(currentLanguage);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    language,
    locale: language === 'tr' ? 'tr-TR' : language === 'ru' ? 'ru-RU' : 'en-US',
    setLanguage,
    t: translate,
  };
}

function flagToRegion(flag: string) {
  const points = Array.from(flag, (character) => character.codePointAt(0) ?? 0);
  if (points.length !== 2 || points.some((point) => point < 0x1f1e6 || point > 0x1f1ff)) return null;
  return points.map((point) => String.fromCharCode(point - 0x1f1e6 + 65)).join('');
}

export function localizeCountry(country: { country: string; flag: string }, language = currentLanguage) {
  if (language === 'tr') return country.country;
  const region = flagToRegion(country.flag);
  if (!region || typeof Intl.DisplayNames !== 'function') return country.country;
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(region) ?? country.country;
  } catch {
    return country.country;
  }
}

const routeNames: Record<Language, Record<string, string>> = {
  tr: {},
  en: {
    'mediterranean-gateway': 'Gateway to the Mediterranean', 'western-mediterranean-atlantic': 'Western Mediterranean & Atlantic', 'heart-of-europe': 'Heart of Europe', 'northern-lights': 'Northern Lights', 'danube-to-caucasus': 'Danube to the Caucasus', 'desert-wonders': 'Desert Wonders', 'silk-road': 'Silk Road', 'himalayas-indian-ocean': 'Himalayas & Indian Ocean', 'southeast-asia': 'Southeast Asia', 'far-east-pacific': 'Far East & Pacific', 'nile-to-south-africa': 'Nile to Southern Africa', 'africa-adventure': 'African Adventure', 'americas-journey': 'Journey Through the Americas', 'andes-to-pacific': 'Andes to the Pacific', 'caribbean-treasures': 'Caribbean Treasures', 'central-america-guianas': 'Central America & the Guianas', 'heart-of-africa': 'Heart of Africa', 'west-africa': 'West Africa', 'pacific-islands': 'Pacific Islands', 'north-america-arctic': 'North America & Arctic', 'hidden-africa': 'Hidden Treasures of Africa', 'levant-mesopotamia': 'Levant & Mesopotamia', 'west-africa-coast': 'West African Coast', 'southeast-asia-pacific': 'Southeast Asia & Pacific',
  },
  ru: {
    'mediterranean-gateway': 'Ворота Средиземноморья', 'western-mediterranean-atlantic': 'Западное Средиземноморье и Атлантика', 'heart-of-europe': 'Сердце Европы', 'northern-lights': 'Северное сияние', 'danube-to-caucasus': 'От Дуная до Кавказа', 'desert-wonders': 'Чудеса пустыни', 'silk-road': 'Шёлковый путь', 'himalayas-indian-ocean': 'Гималаи и Индийский океан', 'southeast-asia': 'Юго-Восточная Азия', 'far-east-pacific': 'Дальний Восток и Тихий океан', 'nile-to-south-africa': 'От Нила до юга Африки', 'africa-adventure': 'Африканское приключение', 'americas-journey': 'Путешествие по Америке', 'andes-to-pacific': 'От Анд до Тихого океана', 'caribbean-treasures': 'Сокровища Карибов', 'central-america-guianas': 'Центральная Америка и Гвианы', 'heart-of-africa': 'Сердце Африки', 'west-africa': 'Западная Африка', 'pacific-islands': 'Острова Тихого океана', 'north-america-arctic': 'Северная Америка и Арктика', 'hidden-africa': 'Скрытые сокровища Африки', 'levant-mesopotamia': 'Левант и Месопотамия', 'west-africa-coast': 'Побережье Западной Африки', 'southeast-asia-pacific': 'Юго-Восточная Азия и Тихий океан',
  },
};

export function localizeRoute(route: { id: string; name: string }, language = currentLanguage) {
  return routeNames[language][route.id] ?? route.name;
}

export function localizeOperation(symbol: string) {
  if (symbol === '+') return translate('game.addition');
  if (symbol === '-' || symbol === '−') return translate('game.subtraction');
  if (symbol === '×' || symbol === '*') return translate('game.multiplication');
  if (symbol === '÷' || symbol === '/') return translate('game.division');
  return symbol;
}
