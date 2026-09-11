# Play flow değişiklikleri

Bu dosya ses kadansı 1–6 ile eğitim, ekonomi, tempo ve günlük keşif paketinin (A–D) ürün kararlarını kaydeder. Tempo ve ses, pixel-perfect ölçüleri bozmayan bilinçli ürün kararlarıdır. İpucu kredisi / sahte reklam ödülü geri getirilmez.

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
- İşlem yönlendirmesi (`operation guide`) eğitim kapanana kadar bekler, sonra ilk gerçek puzzle’da görünür.

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

### C2. Kart süreleri

- Destinasyon kartı: `1150 ms` (eski `1600 ms`).
- Country Challenge giriş kartı: `2100 ms`.

### C3. Ülke bitişi — Haritayı gör / geri

`CountryCompletionModal` kapanışları artık ayrık:

- Birincil eylem (`onContinue`): sonraki ülke/puzzle (`settleCountryCompletion('game')`).
- “Haritayı gör”: Seyahat ekranını açar; `startLevel` yok, kayıtlı puzzle ezilmez. Modal yalnız oyun ekranında görünür; `countryCompletionLevel` kalabilir, kayıt yeniden açılınca modal geri gelir.
- Geri tuşu ve ✕ (`onClose`): ana menü. Sonraki ülkeyi başlatmaz.

## D. Bağlayıcılık

### D1. Günlük Keşif ana menüde

- `DailyChallengeScreen` ana menü kartı ve alt `GÖREVLER` ile açılır.
- Kart: seri, bugün hazır / ödül al / tamamlandı.
- Daily kendi progress storage’sunu kullanır; ana tur level / tahta / mücevher ilerlemesini ezmez.
- Ödül mücevheri ana `gemCount`’a eklenir.

### D2. Günlük kadans

- Hedef bulundu: `success`, ~`420 ms` sonra kutlama `levelComplete`. Timer ref’te tutulur; unmount, geri, sonraki bulmaca ve faz değişiminde iptal edilir (menüde geç hazine sesi yok).
- Hedef + bonus peş peşe: `setProgress(prev => …)` ve persist o next ile; ikinci kayıt birincinin id’sini ezmez.
- Hazine / ödül alma ekranına geçiş ikinci `levelComplete` çalmaz.
- Ödül alma `points` çalar (çift sting yok).

### D3. Yeni rota mührü

`continueAfterCountryCompletion` / `settleCountryCompletion` içinde `earnedRouteReward` varken:

- `ROUTE_GEM_REWARD = 10` ana bakiyeye eklenir.
- `diamond` sesi çalar.
- `feedback.routeGemToast` ~`2.2 sn` görünür.

## Çelişen dokümanlar

`DESIGN_RULES.md` ve `ADAPTIVE_DIFFICULTY.md` bu dosyadaki mücevher ekonomisi, şehir içi rahatlama, kutlama süreleri, eğitim Atla / bölme, duck/fade ve günlük menü kurallarına çekildi.
