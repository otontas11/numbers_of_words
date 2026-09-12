# Play flow değişiklikleri

Bu dosya ses kadansı 1–6 ile eğitim, ekonomi, tempo ve günlük meydan okuma paketinin (A–D) ürün kararlarını kaydeder. Tempo ve ses, pixel-perfect ölçüleri bozmayan bilinçli ürün kararlarıdır. İpucu kredisi / sahte reklam ödülü geri getirilmez.

## Ses ve kapanış kadansı (1–6)

### 1. Son hedef ve konfeti ayrı olaylardır

- Ana hedef eşleşmesi doğrulanır doğrulanmaz `success` çalar.
- Bölüm konfetisi başladığında `levelComplete` çalar (`game-treasure.wav`, ses `%35`).
- Eğitim kapanışında da aynı ayrım vardır: son pratik hedef `success`, kutlama `levelComplete`.

### 2. Puan tiki hazine değildir

- Puan uçuşu `points.wav` kullanır (`0.24 sn` kısa tik, ses `0.38`).
- `game-treasure.wav` yalnız `levelComplete` içindir.
- Android SoundPool eşlemesi: `points.wav` → `points`, `game-treasure.wav` → `levelComplete`. İkisi aynı oyuncuyu paylaşmaz.

### 3. Tam tören zamanlaması

Sıra: son `success` → sonuç uçuşu bitsin (`LEVEL_CELEBRATION_DELAY` = uçuş + `100 ms`) → konfeti + `levelComplete` → `SCORE_FLIGHT_START_DELAY` (`320 ms`) → puan uçuşları (`points`).

Hazine ~`0.73 sn` stereo; puan tiki ondan sonra başlar, üst üste binmez.

Bu tam tören yalnız destinasyon bitişi, Country Challenge girişi ve ülke bitişinde çalışır.

### 4. Müzik duck

Arka plan müziği kutlama, ülke tamamlama modalı ve destinasyon kartı açıkken `0.4` çarpanıyla kısılır.

```text
ducked = celebrating || countryCompletionLevel !== null || destinationTransition !== null
```

### 5. Müzik fade

Fade `320 ms`, `32 ms` tik. Açılış / ön plana dönüşte `0`’dan hedef sese; kapanış / arka planda `0`’a inip pause. `shouldPlayInBackground: false`. İlk play sesi `1` ile patlatılmaz (`audibleRef`).

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
| İpucu | `10` mücevher |
| Yeni rota mührü | `+10` mücevher (rota başına bir kez) |

`feedback.noHints` mücevher dilindedir (TR mücevher / EN gems / RU алмазов).

### B2. Reklam

Sahte ödüllü reklam **yok**. AdMob native build’de banner’dır; rewarded callback hazır değildir. İleride gerçek rewarded bağlanırsa ipucu kredisi değil `+30` mücevher (3 ipucu değeri) verilebilir. Taklit ödül yok.

### B3. Şehir içi zorluk rahatlaması

- İlk 5 öğretici ülkede adaptif kapalıdır (`countryIndex < 5`).
- Yeni şehirde (Challenge değil) öğrenme skorundan `−1/0/+1` uygulanır; işlem türü ve temel adım kuralı değişmez.
- Aynı şehirde, Challenge değilken, art arda 2 “zorlandı” sonrası **sonraki puzzle** zorluğu en fazla 1 kademe düşer; sayaç sıfırlanır.
- Challenge puzzle’ı bu düşüşü almaz.

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

- `DailyChallengeScreen` ana menü kartı ve alt `GÖREVLER` ile açılır.
- Kart: seri, bugün hazır / ödül al / tamamlandı · tekrar oyna.
- Daily kendi progress storage’sunu kullanır; ana tur level / tahta / mücevher ilerlemesini ezmez.
- Ödül mücevheri yalnız ilk claim’de ana `gemCount`’a eklenir. Replay streak’i bozmaz ve tekrar ödül basmaz.

### D2. Günlük kadans

- Ana hedef: paylaşılan `ResultFlight` önce hedef kartına (`720 ms`) kısa iniş/emerald (`300/320 ms`), sonra aynı uçuşla x/5 ray yuvasına (`720 ms`); ara puzzle’da destinasyon kartı yok. Ray yuvasına ✓ oturunca `select1` (`80 ms` sine pop) bir kez tikler; 5/5’te `levelComplete` ray uçuşu bittikten `90 ms` sonra çalar (tik ile üst üste binmez). Sonraki bulmaca `DailyChallengeScreen` / HUD / gökyüzü / ray / banner’ı unmount etmez: çark `key` yalnız `dateKey+wheelSize`, `boardFade` yok; yalnız çember sayıları ve hedef/bonus değerleri değişir. Düğümler sonraki bulmacaya geçerken yörüngeden merkeze toplanır (`220 ms`, scale `1→0.55`, opacity `~0.6`, neredeyse `r=0`); merkezde `90 ms` overlap ile eski set görünür kalır, yeni set aynı noktadan yörüngeye doğar (`460 ms`, shuffle easing, stagger ≤`40 ms`). `levelComplete` / konfeti yalnız 5/5 hazineye geçerken; global müzik duck’ı daily `celebrating` ile tetiklenmez.
- 5/5: uçuş → kompakt konfeti + `levelComplete` → hazine kartı. Timer ref’te tutulur; unmount, geri, sonraki bulmaca ve faz değişiminde iptal edilir.
- Hedef + bonus peş peşe: `setProgress(prev => …)` ve persist o next ile; ikinci kayıt birincinin id’sini ezmez.
- Bonus: paylaşılan `ResultFlight` önce bonus kartına (bulunan item), inişten sonra ★ puan HUD ve ilk koşuda 💎 header mücevhere. Replay’de kart mücevheri tekrar basılmaz.
- Puan formülü ana turla aynıdır: seçilen sayıların toplamı × adım. Daily ★ / 💎 HUD ana tur `score` / `gemCount` bakiyesini gösterir; hedef ve bonus `onScore` ile bu puana ekler, ayrı `runScore` sayacı basılmaz.
- Play tahtası ana oyun dilindedir: `getGameLayout`, büyük kontrastlı `ADIM SAYISI`, hedef kartı `●` noktaları, belirgin bonus (mücevher + `4/8/14` + adım), `NumberWheel`. Bırakınca `target.steps === indices.length`. Altta `58 dp` AdMob banner; sahte rewarded yok.
- Claim `points` çalar. İlk claim kilitler; `Tekrar oyna` ve ana menü açıktır.

### D3. Beş puzzle, zorluk ve replay

- Günlük set 5 yükselen puzzle’dır (Işınma → Tempo → Zirve); aynı gün aynı seed/hedefler.
- Sayı havuzu ana tur `countryIndex` / `learningScore` / `cityDifficultyModifier` tabanına `+1` sayı zorluğu ekler. Bölme istisnası: hep 2 adım, küçük tam-bölünen çarpan ailesi; × ve zirve zor kalır.
- Bonus kartı çözülünce 2/3/4 adım için `4/8/14` mücevher (ilk koşu). Beş bonus da bulununca claim’de ayrı ek paket `+8` (`DAILY_CHALLENGE_ALL_BONUS_REWARD`). Replay ve `claimed` bu ekstra ile kart mücevherlerini tekrar basmaz.
- `claimed` ilk ödülü kilitler. Replay yeni koşu açar (ana `score` sıfırlanmaz, çözülenler puana eklenmeye devam eder); mücevher ve streak kilitleri kalır.

### D4. Yeni rota mührü

`continueAfterCountryCompletion` / `settleCountryCompletion` içinde `earnedRouteReward` varken:

- `ROUTE_GEM_REWARD = 10` ana bakiyeye eklenir.
- `diamond` sesi çalar.
- `feedback.routeGemToast` ~`2.2 sn` görünür.

## E. Çark lastik ipi

Kilitli segmentler düğüm merkezi kirişidir; sürüklemede uç gerçek parmağı gecikmesiz izler (sticky A–B projeksiyon yok), lastik fiziği yalnız bırakınca çalışır. Geçerli hedef/bonus’ta lastik geri sarılmaz (520/440 ms hold + ResultFlight). Geçersiz / tek düğüm / yarım yolda uç Hooke `F=−kx−cv` (`ζ≈0.86`, k/c mesafeye göre ~384/34 kısa ve ~196/24 uzun) ile 180–420 ms A’ya döner, sonra zincir temizlenir; 0 ms snap yoktur. Daily aynı `NumberWheel`’i kullanır. Path worklet uç için `pointer` SharedValue kullanır (`rubberActive` yoksa false); tek düğüm bırakışta spring A’ya döner, 500 ms timeout kilit açar.

## Çelişen dokümanlar

`DESIGN_RULES.md` ve `ADAPTIVE_DIFFICULTY.md` bu dosyadaki mücevher ekonomisi, şehir içi rahatlama, kutlama süreleri, eğitim Atla / bölme, duck/fade ve günlük menü kurallarına çekildi.
