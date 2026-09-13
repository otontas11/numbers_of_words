# Play flow değişiklikleri

Bu dosya ses kadansı 1–6 ile eğitim, ekonomi, tempo ve günlük meydan okuma paketinin (A–D) ürün kararlarını kaydeder. Tempo ve ses, pixel-perfect ölçüleri bozmayan bilinçli ürün kararlarıdır. İpucu kredisi / sahte reklam ödülü geri getirilmez.

## Ses ve kapanış kadansı (1–6)

### 1. Son hedef ve konfeti ayrı olaylardır

- Ana hedef eşleşmesi doğrulanır doğrulanmaz `success` çalar.
- Bölüm konfetisi başladığında `levelComplete` çalar (`game-treasure.wav`).
- Eğitim kapanışında da aynı ayrım vardır: son pratik hedef `success`, kutlama `levelComplete`.

### 2. Puan uçuşu rising coin’dir; hazine değildir

- Rozetler HUD’a uçmaya başlayınca `pointsRising` bir kez çalar (`points-rising-coin.wav`, ~`0.82 sn`). Her rozette tekrar yok.
- Sayaç varışta artar; rezerv/varış defteri değişmedi.
- Kısa tik `points.wav` ayrı durur (`points` anahtarı). Daily hazine paketi yokken kapanış tiki bunu kullanır.
- `game-treasure.wav` yalnız `levelComplete` içindir; puan uçuşu anına girmez.
- Android SoundPool: `points-rising-coin.wav` → `pointsRising`, `points.wav` → `points`, `game-treasure.wav` → `levelComplete`. Native rebuild ister.

### 3. Tam tören zamanlaması

Sıra: son `success` → sonuç uçuşu bitsin (`LEVEL_CELEBRATION_DELAY` = uçuş + `100 ms`) → konfeti + `levelComplete` → `SCORE_FLIGHT_START_DELAY` (`320 ms`) → puan uçuşları + bir kez `pointsRising`.

Daily’de aynı an `launchHudFollowUps` içinde, rozet delay’i kadar bekleyip bir kez `pointsRising` çalar; varışta tekrar yok.

Bu tam tören yalnız destinasyon bitişi, Country Challenge girişi ve ülke bitişinde `levelComplete` kullanır. Kompakt bölüm kutlamasında rising coin yine uçuş başında bir kez çalar.

### 4. Müzik duck ve bed

Arka plan müziği kutlama, ülke tamamlama modalı ve destinasyon kartı açıkken `0.4` duck alır (puan uçuşu `celebrating` boyunca bu duck’ın içindedir). Bed gain `0.64`: müzik efekt bandının bir tık altındadır.

```text
ducked = celebrating || countryCompletionLevel !== null || destinationTransition !== null
music = userVolume * 0.64 * (ducked ? 0.4 : 1)
```

İlk açılış ve `musicVolume` alanı yokken slider varsayılanı `0.10` (eski `0.50`); kayıtlı seviye korunur, duck `0.4` bed üstüne çarpılmaya devam eder.

### 4b. Efekt loudness bandı

Kısa efekt çarpanları RMS’e göre eşitlendi; implicit `1.0` ve `0.30` sınıfı kısıklar kalktı. Master ≤ 0 tam mute; aksi halde efektif volume ≥ `0.12` (JS `resolveEffectVolume` + SoundPool `AUDIBLE_VOLUME_FLOOR`).

| Anahtar | Eski | Yeni |
| --- | --- | --- |
| select1–7 | 1.00 (implicit) | 0.56 |
| hint / shuffle | 1.00 (implicit) | 0.90 |
| success | 1.00 (implicit) | 0.82 |
| bonus | 0.55 | 0.90 |
| diamond | 0.30 | 0.78 |
| points | 0.38 | 0.68 |
| pointsRising | — | 0.64 |
| levelComplete | 0.35 | 0.58 |

Kristal (`diamond`) 0.78 → 0.52: duyulur kalır, bonus (0.90) ve `pointsRising` (0.64) altındadır; 0.30’a dönülmedi.

### 5. Müzik fade

Fade `320 ms`, `32 ms` tik. Açılış / ön plana dönüşte `0`’dan hedef sese; kapanış / arka planda `0`’a inip pause. `shouldPlayInBackground: false`. İlk play sesi `1` ile patlatılmaz (`audibleRef`). Duck `0.4` ve bed gain `0.64` loop çapraz geçişinde de bed hacmine uygulanır (player.volume = bed × loopGain).

### 5b. BGM loop çapraz geçiş

- Eski bed: `assets/sounds/journey.mp3` (~`107.1 sn`, stereo 256 kbps, F majör, ~`108 BPM`). Native `loop=true` ile başa sarınca kesiliyordu: son ~`4 sn` fade-to-silence / kadans, ilk `200 ms` tam enerjide.
- Yeni bed: `assets/sounds/bgm-loop.mp3` (aynı kayıt, kadans/fade kesildi, orta gerilimde biter; `journey.mp3` yedek kalır). Üretici: `tools/generate_bgm_loop.py`. Yeni beste / müzik API’si değil — env’de Suno/Replicate/ElevenLabs müzik anahtarı yoktu.
- Oynatma: iki `AudioPlayer`, native loop kapalı. Bitmeden `1600 ms` kala ikinci player equal-power fade-in (`sin`/`cos`), birincisi fade-out, sonra swap. Kaçırılan bitişte en az `240 ms`. Status poll `80 ms`.
- Native SoundPool değişmedi; JS asset. Dev’de Metro yeter. Mağaza ikilisine yeni mp3’ün girmesi için uygulama paketinin yeniden üretilmesi gerekir, native modül rebuild’i gerekmez.

### 6. İpucu / karıştır sine-pop ailesi

- `hint.wav`: `620 Hz` başlangıç, `80 ms` sine pop, `HINT_START_TIME = 0`.
- `shuffle.wav`: `360 Hz` başlangıç, aynı zarf, `SHUFFLE_START_TIME = 0`.
- Üretici ayrıca `pop_hint.wav` / `pop_shuffle.wav` yazar. Native plugin `hint.wav` ve `shuffle.wav` kopyalar; eski `hint.mp3` / `bubble_x.mp3` kullanılmaz.

Android SoundPool değişikliği native rebuild ister.

## A. Eğitim ve ilk oturum

### A1. Eğitime Atla

- İlk açılışta tam eğitim varsayılandır.
- Modalda görünür **Atla** vardır (`tutorial.skip` / `tutorial.skipA11y`, TR/EN/RU).
- Atla `@numbers-of-wonders/tutorial-completed` değerini `done` yazar ve modalı kapatır; kutlama çalmaz.
- Kutlama başlar başlamaz `phase = 'celebrate'` (Atla gizlenir), ardından `levelComplete`. Skip `doneRef` + `runRef` / `visibleRef` senkron; ses bittikten sonra skip yok sayılmaz.

### A2. Bölme minik adımı

`PRACTICE_LESSONS` sırası: toplama → çıkarma → çarpma → bonus → **bölme** (`8 ÷ 2 = 4`, 2 adım, tam sayı). Kutlama son dersten sonra başlar. Kutlama kopyası 5 dersi sayar (`tutorial.celebrateSubtitle`, TR/EN/RU).

### A3. Eğitim → gerçek tahta

- Eğitim kapanışı: `levelComplete` + konfeti (modal içinde).
- Modal kapanınca gerçek puzzle ikinci konfeti / kapanış sesi çalmaz.
- İşlem yönlendirmesi (`operation guide`) eğitim kapanana kadar bekler. Sonra her destinasyon/şehir değişiminde (`locationLevel === 1`) ve Country Challenge girişinde çarkın ortasında bir kez görünür; oyuncu ilk sayıya dokununca kapanır. Aynı şehirdeki 7 puzzle’da tekrarlanmaz. İşlem türü başına en fazla 2 gösterim kuralı yoktur. Storage `shownLocationIds` (`locationId`, Challenge ayrı id) listesidir; reklam/ekran değişimi sıfırlamaz.

## B. Oynanabilirlik ve ekonomi

### B1. Tek ipucu sözleşmesi — canlı mücevher ekonomisi

Dokümandaki ayrı ipucu kredisi (3 + reklam + rota) **kaldırıldı**. Kod zaten mücevher kullanıyordu; doküman koda hizalandı. İkinci bakiye eklenmedi.

| Kural | Değer |
| --- | --- |
| Başlangıç | `30` mücevher |
| İpucu | `10` mücevher (`HINT_GEM_COST`) |
| Rewarded izleme | `+30` kristal (yalnız gerçek `EARNED_REWARD`) |
| Yeni rota mührü | `+10` mücevher (rota başına bir kez) |

`feedback.noHints` mücevher dilindedir (TR mücevher / EN gems / RU алмазов). Kristal 10’un altına düşünce ipucu basılamaz; hint CTA reklam izletir.

### B2. Reklam

Sahte ödüllü reklam **yok** (timer / “izlendi varsay” yok). App ID `ca-app-pub-5659145727748457~8041376159` (`app.json` plugin). Unit ID tek kaynak: `src/components/ads/admob-ids.ts`. Web / Expo Go no-op (`*.web.ts`). Native’de `react-native-google-mobile-ads`.

**Rewarded (NOW-Rewarded `ca-app-pub-5659145727748457/1166461130`)**  
- Preload eşiği: `gemCount < HINT_GEM_COST` (10). `10+` iken reload yok.  
- Hint ikonu kalır; yetersiz kristalde overlay `wheel.hintAdCta` — “Reklam izle, 30 kristal kazan” (TR/EN/RU).  
- Tıklayınca hazırsa `RewardedAd.show`; değilse `feedback.hintAdPreparing` + load. Gösterilemezse kristal yok.  
- Ödeme yalnız `RewardedAdEventType.EARNED_REWARD` / `onAdEarnedReward` sonrası `setGemCount(c => c + 30)` + mevcut `saveGameProgress`. Kapanışta ödül yoksa 0.  
- Daily ve ana tur aynı kapı (`use-rewarded-hint.ts`). Eski hint-credit yok.

**Interstitial (NOW_Interstitial `ca-app-pub-5659145727748457/7543780183`)**  
- İlk ülke (`countryIndex === 0`) ve o ülkenin şehir/ülke geçişlerinde **yok**; orada load da yok.  
- İkinci ülkeden itibaren şehir/destinasyon veya ülke değişince göster (`locationId` / `countryIndex`). 7’li blok içi ara puzzle (1→2) **yok**. Daily **yok**.  
- Ready değilse oyunu bloklama; geçişe devam. Bir geçişten sonra sonrakini preload et.

### B3. Şehir içi zorluk rahatlaması

- İlk 5 öğretici ülkede adaptif kapalıdır (`countryIndex < 5`).
- Yeni şehirde (Challenge değil) öğrenme skorundan `−1/0/+1` uygulanır; işlem türü ve temel adım kuralı değişmez.
- Aynı şehirde, Challenge değilken, art arda 2 “zorlandı” sonrası **sonraki puzzle** zorluğu en fazla 1 kademe düşer; sayaç sıfırlanır.
- Challenge puzzle’ı bu düşüşü almaz.

### B3b. Ana sayfa Ustalık (öğrenme seviyesi)

Oyuncuya gösterilen 0–100 metre. Mutfak `learningScore` (varsayılan 50, puzzle EMA) ve şehir `−1/0/+1` ayrı kalır; ana sayfada ve profilde `−1/0/+1` yazılmaz.

- Persist: `learningLevel` (`@number-of-wonders/progress-v2`). Yoksa / ilk açılış **100**. Aralık 0–100, tavan 100.
- Güncelleme: yeni şehirde adaptif modifier uygulandığı an (`startLevel`, Challenge değil, `locationId` değişti). Sinyal mevcut `difficultyModifierFromLearningScore(learningScore)`:
  - `+1` (hızlı, az hint): **+2…+5**
  - `0`: **0 veya +1** (`learningScore >= 50` ise +1)
  - `−1` (çok hint, yavaş): **−3…−8**
- İlk 5 öğretici ülkede değişmez (100 kalır); adaptif kapalı olduğu için bu şehirler sayılmaz.
- Daily bu sayıyı değiştirmez (kendi ekonomisi / mutfak skoru okur, `learningLevel` yazmaz).
- UI: ülke kartında küçük satır `home.learningLevel` — TR `Ustalık {{level}}` / EN `Skill {{level}}` / RU `Мастерство {{level}}`. Play CTA `X. SEVİYE` seyahat ilerlemesidir, karışmaz. Büyük halka yok.

## C. Akış ve tempo

### C1. Ara puzzle kısa, mileston tam tören

| Olay | Konfeti | `levelComplete` | Puan uçuşu | Settle |
| --- | --- | --- | --- | --- |
| Ara puzzle | kompakt (`56` flake) | hayır | hemen | `max(280 ms, settle)` — 1 sn tabanı yok |
| Destinasyon / Challenge girişi / ülke | tam (`180` flake) | evet, konfetiyle | `320 ms` sonra | destinasyon kartı veya `max(1000 ms, settle)` |

Ana tur puzzle geçişinde çark doğumu **görünür** olmalıdır (`NumberWheel` `key` yalnız `wheelSize`, GameScreen unmount olmaz):

1. Son hedef uçuşu + kısa kutlama.
2. Konfeti / destinasyon kartı kapanır; çark görünürken **outro `220 ms`** (sayılar merkeze, kaybolmadan). Kartın veya konfetinin arkasında sessiz token yoktur.
3. `startLevel` + **intro `460 ms`** yörüngeye.
4. Sonra çizim serbest.

Ülke modalı: outro modal altında park edebilir; modal kapanıp `gameplayVisible` olunca intro `460 ms` oynar (overlay açıkken 0 ms yörünge snap intro’yu tüketmez). İlk Play / kayıtlı devamda intro zorunlu değildir. Karıştırma bozulmaz.

### C2. Kart süreleri

- Destinasyon kartı: `1150 ms` (eski `1600 ms`).
- Country Challenge giriş kartı: `2100 ms`.

### C3. Ülke bitişi — Haritayı gör / geri

`CountryCompletionModal` kapanışları artık ayrık:

- Birincil eylem (`onContinue`): sonraki ülke/puzzle (`settleCountryCompletion('game')`).
- “Haritayı gör”: Seyahat ekranını açar; `startLevel` yok, kayıtlı puzzle ezilmez. Modal yalnız oyun ekranında görünür; `countryCompletionLevel` kalabilir, kayıt yeniden açılınca modal geri gelir.
- Geri tuşu ve ✕ (`onClose`): ana menü. Sonraki ülkeyi başlatmaz.

## D. Bağlayıcılık

### D1. Günlük meydan okuma ana menüde

- `DailyChallengeScreen` yalnız ana menüdeki günlük meydan okuma kartından açılır. Alt `GÖREVLER` profil/görevler ekranına gider (koleksiyon ve harita footer’ıyla aynı).
- Ana menü daily kartı ülke kartıyla aynı krem/altın dilde: 🔥 rozeti, `daily.title`, durum satırı (`home.dailyReady` / `home.dailyClaim` / `home.dailyDone`) ve `daily.hudStreak`. Tıklanınca doğrudan play tahtası (briefing yok). `Tekrar oyna` da öyle. Play HUD’da 8 yuvalı x/8 ray, play tahta satırı `[hedef + Footprint + dolan ○ adım] [İŞLEM / sembol] [SERİ / 🔥 n]` (üstte ayrı `İŞLEM TÜRÜ` şeridi yok; adım hedef kartı sayısının altında `FootprintIcon` + `steps` kadar stroke daire, `selectionCount` kadar dolu; sağda iki eşit krem-turkuaz chip, hedef kartı yüksekliği), Işınma/Tempo/Zirve yok. 8/8 hazine ve completed + Tekrar oyna durur.
- Ülkeler kartı seviye düğmesiyle aynı `onPlay` handler’ına gider (kaldığın tur); seyahat/ülke listesine değil.
- Daily kendi progress storage’sunu kullanır; ana tur level / tahta / mücevher ilerlemesini ezmez.
- Bonus kart kristali ve puan eşleşmede **rezerve** edilir, sayaca yazılmaz; kristal üst 💎 hapına, ★ rozeti puan hapına varınca yazılır. Günün daily’si tamamlanmış/claim edilmiş olsa bile tekrar oynayan kullanıcı **tam ödül setini** yeniden kazanır: her hedef puanı, her bonus puanı, her bonus kristali, tüm-bonus ek paketi ve hazine paketi. Günlük tekrar sayısı sınırsızdır; 1. koşu ile 40. koşu birebir aynı öder. Replay streak’i bozmaz.

### D2. Günlük kadans

- Ana hedef: paylaşılan `ResultFlight` önce hedef kartına (`720 ms`) kısa iniş/emerald (`300/320 ms`), sonra aynı uçuşla x/8 ray yuvasına (`720 ms`); ara puzzle’da destinasyon kartı yok. Ray yuvasına ✓ oturunca `select1` (`80 ms` sine pop) bir kez tikler; 8/8’te `levelComplete` ray uçuşu bittikten `90 ms` sonra çalar (tik ile üst üste binmez). Sonraki bulmaca `DailyChallengeScreen` / HUD / gökyüzü / ray / banner’ı unmount etmez: çark `key` yalnız `dateKey+wheelSize`, `boardFade` yok; yalnız çember sayıları ve hedef/bonus değerleri değişir. Düğümler sonraki bulmacaya geçerken yörüngeden merkeze toplanır (`220 ms`, scale `1→0.55`, opacity `~0.6`, neredeyse `r=0`); merkezde `90 ms` overlap ile eski set görünür kalır, yeni set aynı noktadan yörüngeye doğar (`460 ms`, shuffle easing, stagger ≤`40 ms`). `levelComplete` / konfeti yalnız 5/5 hazineye geçerken; global müzik duck’ı daily `celebrating` ile tetiklenmez.
- 8/8: uçuş → kompakt konfeti + `levelComplete` → hazine kartı. Timer ref’te tutulur; unmount, geri, sonraki bulmaca ve faz değişiminde iptal edilir.
- Hedef + bonus peş peşe: `setProgress(prev => …)` ve persist o next ile; ikinci kayıt birincinin id’sini ezmez.
- Bonus: paylaşılan `ResultFlight` önce bonus kartına (bulunan item), inişten sonra ★ puan HUD ve kart kristali header 💎’a. Hedef: sonuç rozeti hedef kartına, sonra ★ hapına puan uçuşu. Sayaç **varışta** artar (mevcut HUD pop); eşleşmede yalnız rezervasyon yapılır.
- Puan formülü ana turla aynıdır: seçilen sayıların toplamı × adım. Daily ★ / 💎 HUD parent `score` / `gemCount` gösterir; `runScore` persist içindir. Ödül `createDailyAwardLedger` kuyruğundadır: `dailyAwardKey(runSeed, slot, puzzleId)` ile rezerve, `onArrive` / sert timeout (uçuş + ~400 ms) / measure başarısızlığı / tahta-replay-faz-geri-unmount flush ile yazılır. Hepsi `claimDailyRunAward` + `paidKeys` üzerinden geçer; çift ödeme olmaz, kuyruk 8+ bekleyen ödemeyi düşürmez. `handleClaim` hazine paketini `runClaimed` ile kilitler; paket kristali sandıktan 💎 hapına uçar, varışta yazılır (`dailyTreasureAwardKey`).
- Play tahtası ana oyun dilindedir: `getGameLayout` (üst işlem şeridi `DAILY_OPERATION_STRIP_HEIGHT` kadar incelince yükseklik çarka yansır), hedef kartında sayı altında `FootprintIcon` + dolan adım daireleri (`game.stepCount` a11y; `onNodeAdded` / `onNodeRemoved` `selectionCount`, bırakınca / lastik / shuffle `0`; puzzle pulse daire+Footprint), sağda `daily.hudOpLabel` / sembol ve `daily.hudStreakLabel` / `daily.hudStreak` chip’leri (hedef kartıyla aynı krem-turkuaz aile, `#233540` değer), bonus satırı solda yönerge (BONUS + mücevher `2/4/7`) sağda bonus sayı + sağ üst işlem rozeti + aynı dolan adım sırası, `NumberWheel`. Puzzle değişince çark intro’sundan sonra hedef adım daireleri iki kısa pulse (scale 1.15). Play header geri düğmesi ana tur HUD `skyControl` + `BackIcon` kopyasıdır (`‹` değil). Bırakınca `target.steps === indices.length`. Altta `58 dp` AdMob banner. Daily interstitial göstermez; kristal `< 10` olunca rewarded hint CTA ana turla aynıdır.
- Claim `points` çalar. Claim yalnız **o koşuyu** kapatır (`runClaimed`); `Tekrar oyna` yeni koşu açar ve hazine yeniden kazanılabilir olur. Ana menü her zaman açıktır.

### D3. Beş puzzle, zorluk ve replay

- Günlük set 8 puzzle’dır: `+ − × ÷` her birinden tam 2, `dateKey` + koşu seed’iyle karışık sıra. Toplama 3–4 adım ve `+2` havuz; çıkarma/çarpma mevcut günlük kural + `+1` bump; bölme 2 adım küçük tam bölme. Işınma/Tempo/Zirve oyuncuya gösterilmez.
- Sayı havuzu ana tur `countryIndex` / `learningScore` / `cityDifficultyModifier` tabanına işlem bump’ı ekler. Bölme istisnası: hep 2 adım, küçük tam-bölünen çarpan ailesi.
- Bonus kartı çözülünce 2/3/4 adım için ana tur `4/8/14` mücevherinin yarısı (`getDailyBonusGemReward`, aşağı yuvarla → `2/4/7`; Country Challenge çarpanı yok). Tutar eşleşmede rezerve edilir; kristal 💎 hapına, puan ★ hapına varınca `onReward` / `onScore` yazılır. `claimed` / replay bunu engellemez. Tek ödeme `claimDailyRunAward` + ledger `paidKeys`; varış + timeout + flush aynı anahtardan geçer. Anahtarlar `dailyAwardKey(runSeed, slot, puzzleId)`: puzzle id’leri konumsal (`<tarih>-<n>`) olduğu için koşu bileşeni olmasa önceki koşu bu koşunun ödemesini eleyebilirdi. Defter yeni koşuda `reset` edilir (`handleReplay`, daily yeniden yüklenmesi). Tüm bonus kartları bulununca hazine paketinde ek `+4`, ipucusuz `+2`, taban `+15` — `claimed` kilitlemez, her koşuda yeniden. Ödülü al: `levelComplete` + kompakt konfeti + 💎 uçuşu (ana tur kadansı); 2. ve sonraki koşular da aynı hazine/kutlama ekranını görür, antrenman/tavan metni yoktur.
- `claimed` artık **hiçbir ödülü** bloke etmez; yalnız iki işi vardır: günlük seri günde bir kez artar (`claimDailyChallengeProgress` içinde `lastCompletedDate === dateKey` ise streak sabit kalır) ve “bugün tamamlandı” durumu (`dailySummary.claimed`).
- Tek ödül kapısı koşu bazlı `runClaimed`’dır: o koşunun bitiş ödülü alındı mı. Amacı yalnızca aynı koşunun hazinesini tekrar oynamadan iki kez toplamayı engellemektir. Koşu sayısına bakan hiçbir kapı yoktur; günlük ödüllü koşu tavanı ve `runIndex` sayacı kaldırıldı. `startDailyChallengeReplay` `completedPuzzleIds` / `completedBonusPuzzleIds` / `usedHint` / `runScore`’u sıfırlar ve `runClaimed`’ı düşürür. `getDailyChallengeReward` yalnız `runClaimed` + tamamlanma ikilisine bakar. `startDailyChallengeReplay` koşuyu **koşulsuz** açar: tutarsız bir kayıtta “tekrar oyna” sessizce ölmesin.
- `runClaimed` persist’i `normalizeDailyChallengeProgress` içindedir ve iki savunması vardır: alan yoksa `claimed`’dan türetilir; **bitmemiş bir koşuda gelen `runClaimed: true` düşürülür**, çünkü toplanmamış bir koşunun hazinesini kilitlerdi. Normalizer kaydı baştan kurduğu için emekli alanlar (eski ödüllü-koşu sayacı `runIndex`, `claimedAllBonuses`, `claimedNoHint`) ilk kayıtta sessizce düşer; defalarca oynanmış eski bir kayıt bu yüzden tam ödeme yapar.
- Koşu başına ödül: 16 kart kristali + 21 bitiş kristali = 37 💎 ve o koşunun setine göre puan. Günlük tavan yok; completed ekranında kalan koşu sayacı gösterilmez, yalnız `daily.replayRewards` “istediğin kadar oyna, her koşuda yeni sorularla kazan” mesajını verir.
- Her koşu **farklı sorular** üretir: üretim tohumu `dateKey:countryIndex:difficultyModifier:run<runSeed>`’dir. `runSeed` `handleReplay` içinde `startDailyChallengeReplay` ile bir artar, gün değişince `createDailyChallengeProgress` ile 0’a döner, `normalizeDailyChallengeProgress` ile persist edilir ve eski kayıtlarda 0 sayılır. Aynı `runSeed` her zaman aynı seti kurar, yani uygulama kapatılıp aynı koşuya dönülünce sorular değişmez. `runSeed` **yalnız üretim girdisidir**: hiçbir ödül yolu okumaz, tek kullanımı ödül anahtarlarının koşu bileşenidir (miktar değiştirmez). Yapı sabittir — 8 puzzle, her işlemden 2, toplama 3–4 adım, bölme 2 adım; değişen şey sayılar ve hedeflerdir.
- İpucu kullanımı koşu bazında işaretlenir (`usedHint`), çünkü ipucusuz `+2` her koşuda yeniden kazanılır.

### D4. Yeni rota mührü

`continueAfterCountryCompletion` / `settleCountryCompletion` içinde `earnedRouteReward` varken:

- `ROUTE_GEM_REWARD = 10` ana bakiyeye eklenir.
- `diamond` sesi çalar.
- `feedback.routeGemToast` ~`2.2 sn` görünür.

## E. Çark lastik ipi

Kilitli segmentler düğüm merkezi kirişidir; sürüklemede uç gerçek parmağı gecikmesiz izler (sticky A–B projeksiyon yok), lastik fiziği yalnız bırakınca çalışır. Geçerli hedef/bonus’ta lastik geri sarılmaz (520/440 ms hold + ResultFlight). Geçersiz / tek düğüm / yarım yolda uç Hooke `F=−kx−cv` (`ζ≈0.86`, k/c mesafeye göre ~384/34 kısa ve ~196/24 uzun) ile 180–420 ms A’ya döner, sonra zincir temizlenir; 0 ms snap yoktur. Daily aynı `NumberWheel`’i kullanır. Path worklet uç için `pointer` SharedValue kullanır (`rubberActive` yoksa false); tek düğüm bırakışta spring A’ya döner, 500 ms timeout yalnız path’i temizleyen ağdır. Lastik dönüşü kilit tutmaz: oynarken başka düğüme dokunmak spring’i anında keser ve yeni zincir beklemeden başlar (geç gelen temizleme callback’i run id ile elenir); yalnız shuffle/intro/outro ve geçerli çözüm hold’u (520/440 ms) dokunmayı kilitler. Düğüm rengi lastik dönüşünden bağımsız boşalır: geçersiz/iptal bırakışta seçili turkuaz ton tek dokunuşta `70 ms`, sürüklenmiş zincirde `150 ms` içinde varsayılana döner (ip A’ya yaylanmayı sürdürür), geçerli çözümde renk hold sonuna kadar kalır.

Canlı işlem önizlemesi sürükleme sırasını gösterir: ilk düğümde `7+`, geçerli 2+ zincirde ara sonuç `3+4=7` / `3+4+5=12` (işlem aynıysa). Geçersiz ara bağda `=` yazılmaz. Ara eşitlik yalnız HUD’dadır; hedef adım sayısı dolmadan tahta kilitlenmez, kullanıcı düğüme devam edebilir. Tap-release / lastik dönüşü / seçim iptalinde ifade lastiği beklemeden temizlenir (`4+` asılı kalmaz); düğüm rengi hâlâ `70/150 ms`. Geri sarınca sondan düşer (ana tur ve daily aynı). Daily bonus ana tur sırasını izler: sonuç (sayı rozeti) önce bonus kartına uçar, inişte emerald pulse, sonra karttaki GemIcon header 💎’a yükselir (ayrı donuk 💎 uçuşu yok; uçuşta soluk yer tutucu, bitince kristal yerinde kalır; 2/4/7 varışta yazılır; her tekrar oynamada yeniden ödenir).

## Home menü kuş uçuşu ve footer

Ana menü sürüsü RN `Animated` + `setInterval` kare döngüsünden Reanimated worklet’e alındı (`src/components/home/flying-birds.tsx`). Düz çizgi ve sürekli çırpma yerine phugoid irtifa–hız, seyirde birkaç çırpma + süzülme, dönüşte hafif bank, düşük frekanslı rüzgâr ve 90–195 ms faz farkı var. Kenarda ~260 ms fade. Kuş sayısı, sprite ve renk aynı; daily ve oyun tahtasına dokunulmadı.

TV-pencere mesafesi: sürü logo kutusundan çıkarıldı, brand gökyüzü bandında tam genişlikte yatar. Katman: arka plan → Number of Wonders logo (`brandBlock` zIndex 1) → FlyingBirds (`skyFlightBand` zIndex 2, `pointerEvents: none`) → play/kartlar/footer. Logo kuşları örtmez. Ana menü ayarlar düğmesi oyun HUD `skyControl` + `SettingsIcon` ile aynı (44 daire, koyu cam, açık dişli SVG); `onOpenSettings` aynı. Ön plan ~40 px, arka ~18–20 px; yakın:orta:uzak hız 1 : 0.72 : 0.5. V formasyonu, komşu merkez 1.3–1.5 kanat açıklığı; irtifa salınımı derinlikle küçülür.

Paylaşılan `AppFooter` SF/Material ev–explore–kutu–clipboard yerine oyun SVG seti kullanır: pusula (anasayfa), yerküre (harita), pasaport + kristal mühür (koleksiyon), kâşif madalyası (görevler). Stroke 2, aktifte krem/altın daire + dolgu (`#FFF9D7` / `#E8C45A`, kenar `#D69B2B`). Etiket, ölçü, i18n ve routing aynı; Daily yalnız daily kartından.

## F. Google Ads ROAS ölçümü (görünmez)

Kullanıcı Google Ads ile indirme alacak; bütçe / indirme / gelir (ROAS) için Analytics + AdMob paid event eklendi. Yeni oyun ekranı / IAP yok.

### Uygulamada ne var

- `@react-native-firebase/app` zaten vardı; `google-services.json` ve `GoogleService-Info.plist` `firebase/android` ve `firebase/ios` altında (paket `platform.tnts.numberofwonders`).
- `@react-native-firebase/analytics` eklendi. `first_open` SDK otomatik; tekrar icat edilmedi (uygulama kodu `first_open` göndermez).
- Olay adları Firebase önerilen/reserved isimleri ezmesin diye `now_` (Number of Wonders) prefix’i taşır. Eski reserved isimlerle çift gönderim yok.
- `now_tutorial_complete`: eğitim bittiğinde veya Atla ile `TUTORIAL_STORAGE_KEY` yazılınca (`handleTutorialDone`). Firebase önerilen `tutorial_complete` kullanılmıyor.
- `now_daily_start`: daily challenge ekranı açılınca (`activeScreen === 'daily'`).
- Banner `onPaid` → Firebase `now_ad_impression` (`ad_platform`, `ad_format`, `value`, `currency`, `ad_unit_name`). Parametre adları GA4 Ads şablonuyla aynı (`value`/`currency`); event adı custom. `react-native-google-mobile-ads` değeri zaten para birimi cinsinden (micros değil). Reserved `ad_impression` gönderilmiyor.
- GDPR: mevcut Ads init içine Google UMP (`AdsConsent.gatherConsent`) eklendi. Özel izin ekranı yok; form yalnız gerekli bölgelerde Google sistem UI’sı. ATT / IDFA prompt’u eklenmedi.

### Konsolda senin yapman gerekenler

1. **Firebase:** Analytics’in Android ve iOS uygulamaları için açık olduğunu doğrula. iOS plist’te `IS_ANALYTICS_ENABLED` şu an `false`; olay gelmezse konsoldan plist’i yeniden indirip `firebase/ios/GoogleService-Info.plist` dosyasını değiştir (sahte config uydurma).
2. **AdMob ↔ Firebase:** AdMob → Project settings → Linked services → aynı `number-of-wonders` Firebase projesine bağla. Impression-level ad revenue açık olsun.
3. **UMP:** AdMob → Privacy & messaging → GDPR mesajını yayınla ve gizlilik politikası URL’si ekle. Yayınlanmazsa EEA’da form boş kalır / reklam kısıtlanır.
4. **Google Ads:** Firebase (ve AdMob) hesabını Google Ads’e bağla. `first_open` SDK olayı olarak içe aktarılabilir. Uygulama olayları custom’dır: `now_tutorial_complete` ve `now_ad_impression`’ı Google Ads’te dönüşüm olarak **elle içe aktar**. Ads ROAS otomatik geliri reserved `ad_impression` bekler; o event artık gönderilmiyor, otomatik Ads ROAS bu custom event’ten dolmayacak. Değer `now_ad_impression` içindeki `value`/`currency` parametrelerindedir — Ads’te bu olayı değerli dönüşüm olarak işaretle.
5. **Native rebuild gerekir.** Yeni Analytics native modülü + UMP ads init sırası Expo Go’da yok. Dev client veya EAS (`eas build` / prebuild) şart; `expo start --go` olay göndermez.

## QA düzeltmeleri (13 Eylül 2026)

Yeni özellik yok; sıfır kurulum QA’sinde bulunan gerçek hatalar:

- **Daily yeniden açılış:** Kart her açılışta `loading`’e çekilip storage’dan yeniden kuruluyordu. Aynı `dateKey` bellekteyse loading flaşı yok; `completedPuzzleIds` üzerinden puzzle index yeniden kurulur (geri çıkınca çözülmüş kartta kilitlenmesin). Gün değişince tam yükleme durur.
- **CardGemLiftFlight:** `markArrived` / `markCompleted` her render’da yeniden oluşuyordu. React Compiler bunları effect bağımlılığı sayınca uçuş sıfırlanıp HUD setState döngüsüne girebiliyordu. Callback’ler `ResultFlightBadge` gibi effect içine alındı; ödeme hâlâ `paidKeys` ile tek sefer.
- **Ayarlar kapat:** Ses/ayarlar modalının (`SettingsModal`) sağ üstüne oyun HUD cam dairesi + X eklendi; Done, Back ve overlay davranışı aynı.

## Çelişen dokümanlar

`DESIGN_RULES.md` ve `ADAPTIVE_DIFFICULTY.md` bu dosyadaki mücevher ekonomisi, şehir içi rahatlama, kutlama süreleri, eğitim Atla / bölme, duck/fade ve günlük menü kurallarına çekildi. `DESIGN_RULES.md` hâlâ Android `journey.mp3` byte-byte kopyasını anlatır; oynatma kaynağı artık `bgm-loop.mp3` (aynı bed’in loop master’ı), duck/fade sayıları aynı.
