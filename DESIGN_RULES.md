# Number of Wonders — Oyun, Tasarım, Ekran ve Ses Kuralları

Bu dosya React Native uygulamasının bağlayıcı kabul ölçütüdür. Oyun mantığında ürün dokümanı, görsel ölçülerde kaynak HTML esas alınır.

## Referans ve öncelik

- Görsel referans: `/Users/oktaytontas/Downloads/number_of_wonders_interactive_game_analysis (1).html`
- Referans SHA-256: `ec3814c4057acf9d4dbaf36aa4d7fd73f77cb7d061e3647ec12802204608abbf`
- Yolculuk haritası referansı: `/Users/oktaytontas/Documents/android_apps/tecvid_elifba_pro/app/src/main/java/platform/tnts/tecvidogren/oyunlar/WordJourneyActivity.java`
- Yolculuk haritası referans SHA-256: `d4d2328424e0f827070d52214ce8994cf6fc282982d86a366aa5fcae3e69e1f4`
- Referans oyun mantığı: `/Users/oktaytontas/Documents/android_apps/tecvid_elifba_pro/docs/harf-tecvid-yolculugu-oyun-mantigi.md`
- Referans oyun mantığı SHA-256: `5a977715ea99caed82d7231335af66922088b3ff91f3db6304fd973b210bf857`
- Referansın ölçü, renk, metin ve zamanlamaları korunur.
- Ürün dokümanındaki mekanik kurallar HTML prototipiyle çelişirse ürün dokümanı üstündür. Örneğin 31. seviyeden itibaren 7 düğüm ve en az `60×60 dp` düğüm kuralı uygulanır.
- `WordJourneyActivity` yalnız yolculuk haritasının kart, hero, zikzak rota ve geçiş görsel diline referanstır. NOW seyahat verisinin tek doğrusu `src/game/travel.ts` içindeki 14 rota/100 ülke kataloğudur.
- Kullanıcının sağladığı “100 Ülkeli Dünya Turu” sırası önceki 6 ülke × 50 level prototipinin yerini tamamen alır.

## Ana oyun döngüsü

1. Oyuncu 3 veya 4 hedefi ve ortak sayı çemberini görür.
2. Sayıları parmağıyla sırayla birleştirerek zihinsel yatırım yapar.
3. Tek hedef bulunduğunda kart yalnızca emerald durumuna geçer; ekran düzeni değişmez ve konfeti gösterilmez.
4. Hedef olmayan geçerli bir işlem ilk kez keşfedilirse Bonus Keşif sayacı artar.
5. Tüm hedefler bitince makro ödül olarak konfeti, bölüm tamamlama sesi ve seviye geçişi çalışır.
6. Her ülkede ilk iki destinasyon 7&apos;şer, üçüncü destinasyon 5 puzzle içerir; 20. puzzle Country Challenge&apos;dır.
7. Country Challenge tamamlanınca vize pulu ve landmark kazanılır, seyahat haritası açılır ve sıradaki ülkeye ulaşım bağlantısı gösterilir.

## Seviye ve matematik motoru

| Dahili puzzle sırası | Düğüm | Hedef | Temel işlem yapısı |
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
- Dahili global puzzle numarası üretim ve kayıt için kullanılabilir; hiçbir oyuncu arayüzünde “Level 847” gibi gösterilemez. Oyuncu yalnız rota, ülke, destinasyon ve destinasyon içi `x/y` puzzle ilerlemesini görür.

## Dünya rotası, ülkeler ve pasaport

Katalog tam olarak 14 ardışık rota, 100 benzersiz ülke, 300 gerçek destinasyon ve 2.000 ana puzzle içerir:

1. Akdeniz&apos;in Kapısı — Türkiye → Yunanistan → Arnavutluk → Karadağ → Hırvatistan → Slovenya → İtalya → Malta
2. Batı Akdeniz & Atlantik — Tunus → Cezayir → Fas → İspanya → Portekiz → Fransa → Birleşik Krallık
3. Avrupa&apos;nın Kalbi — İrlanda → Belçika → Hollanda → Almanya → İsviçre → Avusturya → Çekya
4. Kuzey Işıkları — Polonya → Litvanya → Letonya → Estonya → Finlandiya → İsveç → Norveç → Danimarka
5. Tuna&apos;dan Kafkaslara — Macaristan → Bosna-Hersek → Romanya → Bulgaristan → Gürcistan → Ermenistan → Azerbaycan
6. Çölün Harikaları — Ürdün → Suudi Arabistan → BAE → Umman → Katar → Bahreyn → Kuveyt
7. İpek Yolu — İran → Türkmenistan → Özbekistan → Tacikistan → Kırgızistan → Kazakistan → Moğolistan
8. Himalayalar & Hint Okyanusu — Pakistan → Hindistan → Nepal → Bhutan → Bangladeş → Sri Lanka → Maldivler
9. Güneydoğu Asya — Myanmar → Tayland → Laos → Kamboçya → Vietnam → Malezya → Singapur
10. Uzak Doğu & Pasifik — Endonezya → Brunei → Filipinler → Tayvan → Çin → Güney Kore → Japonya
11. Nil&apos;den Afrika&apos;nın Güneyine — Mısır → Etiyopya → Kenya → Tanzanya → Zambiya → Zimbabve → Güney Afrika
12. Afrika Macerası — Namibya → Botsvana → Mozambik → Madagaskar → Mauritius → Gana → Senegal
13. Amerika Yolculuğu — Kanada → ABD → Meksika → Guatemala → Kosta Rika → Kolombiya → Peru
14. Andlar&apos;dan Büyük Okyanus&apos;a — Ekvador → Bolivya → Şili → Arjantin → Brezilya → Avustralya → Yeni Zelanda

- Her ülke tam `20` ana puzzle içerir: destinasyonlar `1–7`, `8–14`, `15–19`; Country Challenge `20`.
- Ülke ve rota state&apos;leri `LOCKED`, `AVAILABLE`, `CURRENT`, `COMPLETED` semantiğini taşır. Bir sonraki ülke/rota ancak önceki tamamlanınca açılır.
- Ulaşım yalnız ilerleme ödülüdür. Mesafeye göre araba, tren, gemi veya uçak gösterilir; coin/gem ödeme duvarı oluşturulmaz.
- Pasaport yalnız tamamlanan ülkeleri sayar. Başlangıç `0/100`, her Country Challenge sonrası bir pul, Yeni Zelanda finali sonrası `100/100` gösterilir.
- Yeni Zelanda Challenge arayüzde `WORLD TOUR FINAL` adını alır. Tamamlandığında bütün rotalar tamamlanmış kalır, `WORLD TOUR COMPLETED`, `Golden Compass` ve `World Explorer` ödül metası tetiklenir; sonraki döngü Master World Tour&apos;dur.

## Yolculuk haritası ve giriş akışı

- Uygulama açıldığında ilk ekran doğrudan sayı çarkı değil, `WordJourneyActivity` görsel diline uyarlanmış Dünya haritasıdır.
- Zoom 1/Dünya aynı anda yalnız 14 tematik rotayı gösterir; 100 ülke pini gösterilmez. Mevcut rota parlak, tamamlanan rota altın, kilitli rota soluktur.
- Dünya hero&apos;sunda `assets/images/world-tour-map.png` kullanılır: yaklaşık doğru kıta yerleşimi, politik sınır ve metin içermeyen 3D/illustrated arazi, altın seyahat izi ve koyu okunabilir UI alanı korunur.
- Zoom 2/Rota yalnız seçili rotanın coğrafi seyahat sırasındaki 7–8 ülkesini ve aralarındaki ulaşım bağlantılarını gösterir.
- Zoom 3/Ülke üç destinasyon ile Country Challenge düğümünü gösterir. Zoom 4 puzzle ekranıdır; yalnız aktif destinasyon mevcut kayıtlı puzzle&apos;ı açar.
- Dünya → rota → ülke → puzzle geçişi kademelidir. Geri kontrolü bir üst zoom katmanına, oyun içindeki harita düğmesi Dünya katmanına götürür.
- Üst hero alanı aktif şehrin görselini kullanır; hero yüksekliği güvenli alan hariç `268 dp`dir. Alttaki koyu scrim başlık ve rota bilgisini her görselde okunur tutar.
- Devam kartı hero üzerine `16 dp` biner, yatayda `16 dp` boşluk bırakır, `18 dp` köşe yarıçapı kullanır ve aktif katmanın ilerlemesini gösterir.
- Rota ve ülke kartları `24/54 dp` ile `54/24 dp` dönüşümlü yatay marjinlerle zikzak yerleşir. Kartlar en fazla `50 ms` aralıkla, `360 ms` sürede ve alttan `22 dp` kayarak açılır.
- Ülkeler arasındaki bağlantı alanı `56 dp` yüksekliğindedir; ortadaki ulaşım/mesafe çipi rota verisinden okunur.
- Her ülke kartı sıra/durum, ülke adı, üç destinasyon rotası, `5 dp` ilerleme çubuğu ve üç destinasyon + Challenge düğümünü gösterir.
- Kilitli karta basmak kaydı veya aktif puzzle&apos;ı değiştirmez. Tamamlanan rota/ülke incelenebilir ancak yalnız `CURRENT` ülke/destinasyon oyunu açabilir.
- Oyun ekranındaki harita düğmesi rotaya geri döner; Android sistem geri tuşu da oyun ekranındayken aynı davranışı kullanır.
- Harita yüzeyi sıcak parşömen gradyanıdır: `#FBF7EE → #F3E7D3 → #E7D3B4`. Devam kartı `#FFF9E9`, ana koyu kontrol `#2D394B`, altın vurgu `#F4D37B`, ana metin `#49382E`dir.
- Harita içeriği en fazla `512 dp` genişliktedir ve büyük ekranlarda ortalanır. Dar ekranlarda yatay taşma kabul edilmez; tüm rota dikey kaydırılır ve aktif ülke ilk açılışta görünür bölgeye alınır.

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

Seviye motoru tüm `1–2000` ana turu ve Master Tour başlangıcını tekrarlı rastgele koşularla doğrular: 14 rota, 100 benzersiz ülke, 300 destinasyon, `7+7+5+Challenge`, doğru düğüm/hedef adedi, benzersiz hedefler, çözülebilirlik, adım tutarlılığı ve ardışık hedef tekrarsızlığı.

Görsel kontrol matrisi: `320×568`, `360×640`, `375×667`, `390×844`, `430×932`, `448×998` ve `768×1024 dp`. Beklenen çember çapı ilk altı telefon ölçüsünde `288 dp`, `768 dp` genişlikte `320 dp`dir.

Bağlı fiziksel Android veya iOS cihazlarda açılış, kalıcı ilerleme, sürükleme, çeper çizgisi, ipucu, yaylı karıştırma, ses aç/kapat, mikro başarı, bölüm sonu konfeti ve iki modal kontrol edilir. Yol haritasındaki Günlük Bulmaca, Time Attack, PvP ve 3D pasaport mevcut sürümün kabul kapsamına dahil değildir.
