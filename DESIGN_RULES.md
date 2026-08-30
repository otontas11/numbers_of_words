# Number of Wonders — Oyun, Tasarım, Ekran ve Ses Kuralları

Bu dosya React Native uygulamasının bağlayıcı kabul ölçütüdür. Oyun mantığında ürün dokümanı, görsel ölçülerde kaynak HTML esas alınır.

## Referans ve öncelik

- Görsel referans: `/Users/oktaytontas/Downloads/number_of_wonders_interactive_game_analysis (1).html`
- Referans SHA-256: `ec3814c4057acf9d4dbaf36aa4d7fd73f77cb7d061e3647ec12802204608abbf`
- Referansın ölçü, renk, metin ve zamanlamaları korunur.
- Ürün dokümanındaki mekanik kurallar HTML prototipiyle çelişirse ürün dokümanı üstündür. Örneğin 31. seviyeden itibaren 7 düğüm ve en az `60×60 dp` düğüm kuralı uygulanır.

## Ana oyun döngüsü

1. Oyuncu 3 veya 4 hedefi ve ortak sayı çemberini görür.
2. Sayıları parmağıyla sırayla birleştirerek zihinsel yatırım yapar.
3. Tek hedef bulunduğunda kart yalnızca emerald durumuna geçer; ekran düzeni değişmez ve konfeti gösterilmez.
4. Hedef olmayan geçerli bir işlem ilk kez keşfedilirse Bonus Keşif sayacı artar.
5. Tüm hedefler bitince makro ödül olarak konfeti, bölüm tamamlama sesi ve seviye geçişi çalışır.
6. Tamamlanan her 10 seviye yeni şehre, her 50 seviye yeni ülkeye ilerletir ve bir vize pulu kazandırır.

## Seviye ve matematik motoru

| Seviye | Düğüm | Hedef | Temel işlem yapısı |
| --- | ---: | ---: | --- |
| 1–10 | 5 | 3 | İkili toplama |
| 11–30 | 6 | 4 | İkili toplama |
| 31–70 | 7 | 4 | Toplama/çıkarma; uygun toplama seviyelerinde üçlü işlem |
| 71+ | 7 | 4 | Toplama, çıkarma, çarpma ve bölme dönüşümü |

- Önce benzersiz çember sayıları seçilir; hedefler yalnızca bu sayıların gerçek kombinasyonlarından türetilir.
- İkili hedefler `A op B`, üçlü hedefler `A + B + C` biçimindedir. Bir seviyedeki hedeflerin adım sayısı üstteki `Gereken` göstergesiyle aynı olmalıdır.
- Çıkarma pozitif fark olarak değerlendirilir. Bölme sıraya duyarlıdır, tam bölünür ve sonuç `1`den büyük hedeflerden üretilir.
- Her hedef benzersiz, çözülebilir ve dahili çözümleyiciyle doğrulanmış olmalıdır. Eksik hedefle seviye başlatılamaz.
- Hedef seçici, düğüm kullanım sayılarının farkını ve kareler toplamını minimize ederek bütün çemberi olabildiğince dengeli kullanır.
- Mevcut seviyenin hedef değerleri sonraki seviye üretilirken dışlanır. Aynı hedef değeri art arda iki seviyede gösterilemez; bir seviye ara verildikten sonra yeniden kullanılabilir.
- Uygulama kapanıp açılsa da mevcut sayı matrisi, hedefler, çözülmüş kartlar, seviye, Bonus Keşif geçmişi ve efekt tercihi korunur.

## Dünya rotası ve pasaport

- Türkiye 🇹🇷: Kapadokya 🎈 → Efes 🏛️ → Ayasofya 🕌 → Göbeklitepe 🗿 → Pamukkale ♨️
- İtalya 🇮🇹: Kolezyum 🏛️ → Venedik 🚣 → Pisa 🗼 → Floransa 🎨 → Pompei 🌋
- Japonya 🇯🇵: Fuji Dağı 🗻 → Kyoto 🏯 → Tokyo 🗼 → Nara 🦌 → Osaka 🏯
- Mısır 🇪🇬: Gize Piramitleri 📐 → Luksor 🏛️ → Abu Simbel 🗿 → İskenderiye 📚 → Karnak ⛩️
- Fransa 🇫🇷: Eyfel Kulesi 🗼 → Louvre 🖼️ → Nizza 🏖️ → Mont Saint-Michel 🏰 → Şampanya 🍾
- Yunanistan 🇬🇷: Akropolis 🏛️ → Santorini 🏛️ → Meteora 🏔️ → Delos ☀️ → Rodos 🏰
- Pasaport sayacı ziyaret edilen ülkeyi değil, tamamlanan 50 seviyelik ülke paketlerini gösterir. Başlangıç değeri `0/6`, ilk pul Seviye 50 tamamlanıp Seviye 51 açıldığında `1/6` olur.
- 300. seviye tamamlandığında altı pulun tamamı açık kalır. Sonsuz devam akışında ülke rotası başa dönse bile pullar yeniden kilitlenmez.

## Görsel dil ve pixel-perfect ölçüler

- Yazı ailesi tüm ekranlarda `Plus Jakarta Sans` 400, 500, 600, 700 ve 800 ağırlıklarıyla yerel olarak yüklenir.
- Ana zemin `#020617`; ana vurgu amber, sürükleme/seçim mavi, başarı emerald tonlarındadır.
- Arka plan fotoğrafı `cover`, `%25` opaklık ve `1.05` ölçek kullanır; şehir değişimi `1000 ms` geçişlidir. Üst koyu degrade sırasıyla `%95`, `%80`, `%98` opaklıktadır.
- Header ve ana içerik en fazla `512 dp`, modal en fazla `448 dp` genişliğindedir. Modal yüksekliği ekranın en fazla `%85`idir.
- Ana yatay boşluk `16 dp`; yalnızca kullanılabilir genişliği `288 dp` altına düşen çok dar ekranlarda taşmayı önlemek için küçültülebilir.
- Hedefler `<640 dp` genişlikte 2 sütun, `≥640 dp` genişlikte 4 sütundur. Sütun ve satır aralığı `8 dp`, hedef alanı en az `90 dp`, kart yüksekliği sabit `72 dp`dir.
- Geri bildirim yuvası `36 dp` yüksekliğinde ve dikeyde `4 dp` marjinlidir. Mesajın görünmesi çemberi veya hedefleri yerinden oynatamaz.
- Çember `<640 dp` için `288 dp`, `≥640 dp` için `320 dp`dir; yalnızca daha dar kullanılabilir genişliğe sığmak için küçülür. Kapsayıcı yüksekliği en az `290 dp`, dikey marjı `8 dp`dir.
- Düğüm çapı telefonda `60 dp`, geniş düzende `62 dp`dir. Düğüm merkezi çember merkezinden `çember × 0.35` yarıçaplı yörüngeye yerleşir.
- Çember `5 dp` yarı saydam amber kenarlık ve merkezden dışa slate radyal degrade kullanır. Düğüm radyal degradenin ışık merkezi `%35/%35` konumundadır.
- Hedef başarı durumunda kart büyümez. Arka plan hafif emerald olur, kenarlık `2 dp #10B981`, metin `#6EE7B7` ve yeşil parlama kullanılır.
- Kısa ekranlarda ana içerik dikey kaydırılabilir; yatay taşma veya kırpılma kabul edilmez. Sürükleme sırasında kaydırma kilitlenir.

## Etkileşim ve animasyon

- Çeper çizgisi `5 dp` mavidir; düğüm merkezlerini kapatmaz. Başlangıç ve bitiş noktası, yön vektörü üzerinde düğümün o anki görsel yarıçapı kadar ötelenir. Native/SVG çizimi cihaz piksel yoğunluğunda otomatik netleştirilir.
- Seçili düğüm `1.25×` ölçeğe çıkar; çizgi bu büyümüş çeperde sonlanır.
- Karıştırma mevcut düğümleri yeniden oluşturmaz. Sayı ve mantıksal indeks korunur, yalnızca sayı→yuva eşlemesi değişir.
- Bütün düğümler eski konumlarından yeni konumlarına aynı anda `450 ms` boyunca `cubic-bezier(0.34, 1.3, 0.64, 1)` eğrisiyle kayar. Karıştır simgesi aynı sürede `360°` döner.
- Karıştırma sürerken yeni sürükleme başlatılamaz. Animasyon tamamlandığında hit-test koordinatları görsel konumlarla aynı olmalıdır.
- İpucu, çözülmemiş ilk hedefi ve çözüm düğümlerini `750 ms × 2` altın pulse ile vurgular; düğüm tepe ölçeği `1.3×`, hedef ölçeği `1.05×`, toplam görünür süre `1800 ms`dir.
- Dokunma hedefleri en az `44×44 dp` etkin alana sahip olmalı; her butonda Türkçe erişilebilirlik etiketi ve doğru rol bulunmalıdır.

## Ses ve dokunsal geri bildirim

- Efektler ağdan alınmaz; `assets/sounds` altındaki mono, `44.1 kHz`, `16-bit PCM WAV` dosyaları kullanılır.
- `select.wav`: düğüm seçimi ve ipucu.
- `success.wav`: tek hedef çözümü; hafif başarı titreşimiyle çalışır, konfeti üretmez.
- `bonus.wav`: yeni Bonus Keşif.
- `shuffle.wav`: karıştırma.
- `level-complete.wav`: bütün hedefler tamamlandıktan sonra makro ödül.
- Sesler Expo SDK 57 `expo-audio` oyuncularıyla önceden yüklenir, tekrar öncesi başa sarılır, diğer uygulama sesini kesmez ve arka planda çalmaz.
- Mikrofon, Android kayıt izni, arka plan kayıt ve arka plan oynatma kapalıdır.
- Ses anahtarı sesi ve haptics efektlerini birlikte yönetir; tercih kalıcıdır.
- Kaynaklar `npm run sounds:generate` ile yeniden üretilebilir.

## Kullanılan native kütüphaneler

- `expo-audio`: düşük gecikmeli yerel oyun efektleri.
- `expo-haptics`: mikro/makro dokunsal geri bildirim ayrımı.
- `expo-image`: arka plan önbelleği ve `1000 ms` şehir geçişi.
- `expo-blur`: gerçek modal arka plan bulanıklığı; Android SDK 31+ için hedef görünüm referansı kullanır.
- `react-native-svg`: radyal çember/düğüm/pul yüzeyleri ve yoğunluktan bağımsız netlik.
- `@expo-google-fonts/plus-jakarta-sans`: referans tipografinin paketlenmiş font dosyaları.
- `@react-native-async-storage/async-storage`: seviye, hedef matrisi, geçmiş ve tercihlerin kalıcı saklanması.

## Kabul ve doğrulama

Her değişiklikte aşağıdakiler geçmelidir:

```bash
npx tsc --noEmit
npm run lint
npm run validate:levels
npx expo-doctor@latest
npx expo export --platform all
```

Seviye motoru ayrıca en az `1–300` aralığında tekrarlı rastgele koşularla şu invariantlar için sınanır: doğru düğüm/hedef adedi, benzersiz hedefler, çözülebilirlik, adım tutarlılığı ve ardışık hedef tekrarsızlığı.

Görsel kontrol matrisi: `320×568`, `360×640`, `375×667`, `390×844`, `430×932`, `448×998` ve `768×1024 dp`. Beklenen çember çapı ilk altı telefon ölçüsünde `288 dp`, `768 dp` genişlikte `320 dp`dir.

Bağlı fiziksel Android veya iOS cihazlarda açılış, kalıcı ilerleme, sürükleme, çeper çizgisi, ipucu, yaylı karıştırma, ses aç/kapat, mikro başarı, bölüm sonu konfeti ve iki modal kontrol edilir. Yol haritasındaki Günlük Bulmaca, Time Attack, PvP ve 3D pasaport mevcut sürümün kabul kapsamına dahil değildir.
