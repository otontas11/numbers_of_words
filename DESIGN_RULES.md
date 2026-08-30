# Number of Wonders — Oyun, Tasarım, Ekran ve Ses Kuralları

Bu dosya React Native uygulamasının bağlayıcı kabul ölçütüdür. Oyun mantığında ürün dokümanı, görsel ölçülerde kaynak HTML esas alınır.

## Referans ve öncelik

- Görsel referans: `/Users/oktaytontas/Downloads/number_of_wonders_interactive_game_analysis (1).html`
- Referans SHA-256: `ec3814c4057acf9d4dbaf36aa4d7fd73f77cb7d061e3647ec12802204608abbf`
- Yolculuk haritası referansı: `/Users/oktaytontas/Documents/android_apps/tecvid_elifba_pro/app/src/main/java/platform/tnts/tecvidogren/oyunlar/WordJourneyActivity.java`
- Yolculuk haritası referans SHA-256: `d4d2328424e0f827070d52214ce8994cf6fc282982d86a366aa5fcae3e69e1f4`
- Oyun ekranı görsel referansı: `/Users/oktaytontas/Documents/android_apps/tecvid_elifba_pro/app/src/main/res/layout/activity_word_path_game.xml`
- Oyun ekranı layout SHA-256: `28db620d46a437f95720a25aa37ac6438c9bcae5cfe48da390f2e3f9a0fd66d7`
- Çark görsel referansı: `/Users/oktaytontas/Documents/android_apps/tecvid_elifba_pro/app/src/main/java/platform/tnts/tecvidogren/oyunlar/WordWheelView.java`
- Çark referans SHA-256: `6710a5ca16a71d1028f04f039eecc2fec622ce6f87bec73779936320bde209d7`
- Referans oyun mantığı: `/Users/oktaytontas/Documents/android_apps/tecvid_elifba_pro/docs/harf-tecvid-yolculugu-oyun-mantigi.md`
- Referans oyun mantığı SHA-256: `5a977715ea99caed82d7231335af66922088b3ff91f3db6304fd973b210bf857`
- Referansın ölçü, renk, metin ve zamanlamaları korunur.
- Ürün dokümanındaki mekanik kurallar HTML prototipiyle çelişirse ürün dokümanı üstündür. Örneğin 31. seviyeden itibaren 7 düğüm ve en az `60×60 dp` düğüm kuralı uygulanır.
- `WordJourneyActivity` yalnız yolculuk haritasının kart, hero, zikzak rota ve geçiş görsel diline referanstır. NOW seyahat verisinin tek doğrusu `src/game/travel.ts` içindeki 14 rota/100 ülke kataloğudur.
- `activity_word_path_game.xml` ve `WordWheelView` yalnız oyun ekranının yerleşim ve görsel diline referanstır. Android projesindeki kelime üretimi, skor, ipucu kredisi, reklam, tur ve oyun kuralları alınmaz; NOW matematik motoru ve callback akışı değiştirilemez.
- Kullanıcının sağladığı “100 Ülkeli Dünya Turu” sırası önceki 6 ülke × 50 level prototipinin yerini tamamen alır.

## Ana oyun döngüsü

1. Oyuncu 3 veya 4 hedefi ve ortak sayı çemberini görür.
2. Sayıları parmağıyla sırayla birleştirerek zihinsel yatırım yapar.
3. Tek hedef bulunduğunda kart yalnızca emerald durumuna geçer; ekran düzeni değişmez ve konfeti gösterilmez.
4. Hedef olmayan geçerli bir işlem ilk kez keşfedilirse Bonus Keşif sayacı artar.
5. Tüm hedefler bitince makro ödül olarak konfeti, güçlü başarı titreşimi ve seviye geçişi çalışır; son hedefin normal başarı akorunun üstüne ikinci bir ses bindirilmez.
6. Her ülkede ilk iki destinasyon 7&apos;şer, üçüncü destinasyon 5 puzzle içerir; 20. puzzle Country Challenge&apos;dır.
7. Country Challenge tamamlanınca vize pulu ve landmark kazanılır, seyahat haritası açılır ve sıradaki ülkeye ulaşım bağlantısı gösterilir.
8. Normal seviye geri bildirimi `Puzzle x/y tamamlandı • Şehir` biçimindedir. `Şehir tamamlandı` yalnız katalogda bir sonraki puzzle başka destinasyona geçtiğinde; ülke tamamlandı mesajı yalnız Country Challenge çözüldüğünde gösterilir.

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
- Hero altındaki `OYUNA DEVAM ET` kartı, oyuncunun bulunduğu harita katmanından bağımsız olarak kayıtlı aktif puzzle&apos;ı **tek dokunuşla** açar. Günlük oyun akışında rota veya ülke seçimi zorunlu değildir.
- Rota ve ülke listeleri progression engeli değil, keşif/navigasyon yüzeyidir. Oyuncu isterse dünya rotalarını inceler; hızlı oturumda doğrudan `OYUNA DEVAM ET` kullanır.
- Zoom 1/Dünya aynı anda yalnız 14 tematik rotayı gösterir; 100 ülke pini gösterilmez. Mevcut rota parlak, tamamlanan rota altın, kilitli rota soluktur.
- Dünya hero&apos;sunda `assets/images/world-tour-map.png` kullanılır: yaklaşık doğru kıta yerleşimi, politik sınır ve metin içermeyen 3D/illustrated arazi, altın seyahat izi ve koyu okunabilir UI alanı korunur.
- Zoom 2/Rota yalnız seçili rotanın coğrafi seyahat sırasındaki 7–8 ülkesini ve aralarındaki ulaşım bağlantılarını gösterir.
- Ayrı bir şehir/destinasyon seçim katmanı bulunmaz. Destinasyonlar progression verisi ve görsel keşif bilgisi olarak korunur; oyuncuya ek seçim adımı çıkarmaz.
- Aktif ülke kartına dokunmak da doğrudan kayıtlı puzzle&apos;ı açar. Tamamlanmış veya kilitli ülke kartları kayıtlı seviyeyi değiştirmez.
- Dünya → rota geçişi keşif içindir; puzzle&apos;a erişim `OYUNA DEVAM ET` veya aktif ülke kartı üzerinden gerçekleşir. Geri kontrolü rota katmanından Dünya&apos;ya, oyun içindeki harita düğmesi de Dünya katmanına götürür.
- Üst hero alanı Dünya katmanında dünya haritasını, Rota katmanında seçili rota görselini kullanır; hero yüksekliği güvenli alan hariç `268 dp`dir. Alttaki koyu scrim başlık ve rota bilgisini her görselde okunur tutar.
- Devam kartı hero üzerine `16 dp` biner, yatayda `16 dp` boşluk bırakır ve `18 dp` köşe yarıçapı kullanır. Başlık `OYUNA DEVAM ET`; alt satır aktif ülke, destinasyon ve destinasyon içi puzzle ilerlemesidir. Kartın ilerleme çizgisi aktif ülkenin `x/20` durumunu gösterir.
- Rota ve ülke kartları `24/54 dp` ile `54/24 dp` dönüşümlü yatay marjinlerle zikzak yerleşir. Kartlar en fazla `50 ms` aralıkla, `360 ms` sürede ve alttan `22 dp` kayarak açılır.
- Ülkeler arasındaki bağlantı alanı `56 dp` yüksekliğindedir; ortadaki ulaşım/mesafe çipi rota verisinden okunur.
- Her ülke kartı sıra/durum, ülke adı, üç şehir/lokasyonu ayrı ve okunabilir bilgi çipleriyle, `5 dp` ilerleme çubuğunu ve üç destinasyon + Challenge ilerleme rayını gösterir. Bu şehir çipleri seçim kontrolü değildir.
- Kilitli karta basmak kaydı veya aktif puzzle&apos;ı değiştirmez. Tamamlanan rota/ülke incelenebilir ancak yalnız `CURRENT` ülke kartı oyunu açabilir.
- Oyun ekranındaki harita düğmesi Dünya haritasına geri döner; Android sistem geri tuşu da oyun ekranındayken aynı davranışı kullanır.
- Harita yüzeyi sıcak parşömen gradyanıdır: `#FBF7EE → #F3E7D3 → #E7D3B4`. Devam kartı `#FFF9E9`, ana koyu kontrol `#2D394B`, altın vurgu `#F4D37B`, ana metin `#49382E`dir.
- Harita içeriği en fazla `512 dp` genişliktedir ve büyük ekranlarda ortalanır. Dar ekranlarda yatay taşma kabul edilmez; bütün rota tek bir dikey kaydırma yüzeyinde kalır.

## Görsel dil ve pixel-perfect ölçüler

- Yazı ailesi tüm ekranlarda `Plus Jakarta Sans` 400, 500, 600, 700 ve 800 ağırlıklarıyla yerel olarak yüklenir.
- Puzzle ekranı `assets/images/game-sky-background.png` görselini `cover` olarak kullanır. Bu dosya Android referansındaki sky background ile byte-byte aynıdır; üzerine yalnız yaklaşık `%3–10` koyu okunabilirlik katmanı gelir.
- Puzzle ekranı üst HUD&apos;u güvenli alanın altında `46 dp` yüksekliğindedir; yatay marjin `12 dp`, üst marjin `8–10 dp`dir. Sol tarafta `44 dp` geri/harita kontrolü ve bonus çipi, sağda `44 dp` pasaport ile ses kontrolü bulunur.
- Ülke/şehir şeridi HUD&apos;un `4 dp` altındadır; `106 dp` yüksekliğinde, ekranın `%94` genişliğinde ve en fazla `488 dp`dir. `28 dp` köşe, `1.5 dp` açık turkuaz kenarlık ve `#3E6472 → #263F4D` yarı saydam degrade kullanır.
- Şeridin ilk satırı ülke/flag, aktif işlem çipi ve ülke içi `x/20` ilerlemesini gösterir. İkinci satır üç destinasyonu `✓ tamamlandı / ● aktif / ○ bekliyor` semantiğiyle sıralar. Her destinasyonun altında birbirinden bağımsız `7 dp` ilerleme çizgisi bulunur.
- Ülke finalinde şehirlerin tamamı `✓` olur ve ilerleme çipinde `🏆` gösterilir; bu yalnız sunumdur, Country Challenge progression mantığını değiştirmez.
- Header ve ana içerik en fazla `512 dp`, modal en fazla `448 dp` genişliğindedir. Modal yüksekliği ekranın en fazla `%85`idir.
- Ana yatay boşluk `16 dp`; yalnızca kullanılabilir genişliği `288 dp` altına düşen çok dar ekranlarda taşmayı önlemek için küçültülebilir.
- Hedef alanı Android&apos;deki açık word-card yüzeyine uyarlanır: `#F8FCFB → #DCECEC`, `28 dp` dış köşe, `2 dp #D5EEF2` kenarlık. Üç hedef `%31.6`, dört hedef `%23.5` genişlikle tek satırda kalır; aralık `8 dp`, kart yüksekliği en az `62 dp`dir.
- Hedef kartı varsayılan olarak krem degrade, koyu `#233540` sayı ve turkuaz metadır. Başarı durumu emerald kalır; hedef kartı ölçeklenmez ve yerleşim sıçramaz.
- Geri bildirim yuvası `52 dp` yüksekliğinde ve dikeyde `4 dp` marjinlidir. Boş durumda referanstaki dashed selection placeholder, seçimde aynı boyutta koyu geri bildirim kartı görünür; mesaj değişmesi çarkı yerinden oynatmaz.
- Çember geniş telefonlarda `288 dp`, tabletlerde `320 dp`dir. Dikey alan kısa olduğunda Android constraint davranışına denk olarak `208 / 224 / 252 / 272 dp` kademelerine küçülür; içerik yine dikey kaydırılabilir.
- Düğüm çapı telefonda `60 dp`, geniş düzende `62 dp`dir. Düğüm merkezleri dış çeperden `düğüm yarıçapı + 10 dp` içerideki eşit açılı yörüngeye yerleşir; en kısa düzende yörünge yarıçapı en az `72 dp`dir.
- Çarkın koyu dolu diski yoktur. Düğüm merkezlerinden geçen `7 dp rgba(55,83,92,0.42)` rota halkası ve `10 dp` hafif alt gölge kullanılır. Düğüm yüzeyi `#F8FCFB → #DAEBEB`, kenarı yarı saydam turkuaz ve sayısı `#233540`dır; seçili düğüm turkuaz, sayı beyazdır.
- İpucu ve Karıştır çarkın merkezinde bulunamaz. Çarkın hemen altındaki `62 dp` aksiyon satırında İpucu solda, Karıştır sağda yer alır. Her kontrol `52×52 dp`, yuvarlak, yarı saydam koyu degrade, beyaz `22 dp` ikon ve `9 dp` etikettir.
- Hedef başarı durumunda kart büyümez. Arka plan açık emerald olur, kenarlık `2 dp #10B981`, metin `#23785B` ve yeşil parlama kullanılır.
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

- Kaynak HTML&apos;de indirilen bir ses asset&apos;i yoktur; `SoundEngine`, Web Audio osilatörlerini çalışma anında üretir. Native WAV&apos;lar bu dalga biçimlerinin çevrimdışı ve deterministik karşılığı olmalıdır.
- Efektler ağdan alınmaz; `assets/sounds` altındaki mono, `44.1 kHz`, `16-bit PCM WAV` dosyaları kullanılır. WAV&apos;lara gürültü, reverb, limiter rengi veya referansta bulunmayan ek nota katılamaz.
- `select.wav`: ilk düğüm, `420 → 588 Hz`, `80 ms` sine chirp. `select-2.wav`: ikinci düğüm, `600 → 840 Hz`. `select-3.wav`: üçüncü düğüm, `690 → 966 Hz`. Üçünde gain `0.15 → 0.01` exponential zarfıdır.
- `hint.wav`: İpucu düğümü, `620 → 868 Hz`, aynı `80 ms` pop zarfı.
- `shuffle.wav`: Karıştır düğümü, `360 → 504 Hz`, aynı `80 ms` pop zarfı; pembe gürültü kullanılmaz.
- `success.wav`: her hedef çözümünde sırasıyla `523.25 / 659.25 / 783.99 / 1046.50 Hz` triangle notaları; başlangıç aralığı `70 ms`, her nota `20 ms` attack ve `250 ms` toplam zarfa sahiptir.
- `bonus.wav`: ilk kez bulunan Bonus Keşif için `880 → 1320 Hz`, `150 ms` sine chirp; gain `0.20 → 0.01` exponential zarfıdır.
- Kaynak HTML son hedefte `success` dışında ikinci bir ses çalmaz; `400 ms` sonra yalnız bölüm konfettisi başlar. `levelComplete` olayı makro titreşimi korur ancak ek WAV çalmaz. `level-complete.wav` yalnız eski paket uyumluluğu için geçerli PCM olarak tutulur.
- Sesler Expo SDK 57 `expo-audio` oyuncularıyla önceden yüklenir, tekrar öncesi başa sarılır, diğer uygulama sesini kesmez ve arka planda çalmaz.
- Mikrofon, Android kayıt izni, arka plan kayıt ve arka plan oynatma kapalıdır.
- Ses anahtarı sesi ve haptics efektlerini birlikte yönetir; tercih kalıcıdır.
- Kaynaklar `npm run sounds:generate` ile, ffmpeg&apos;e ihtiyaç duymayan `scripts/generate-sounds.mjs` deterministik PCM üreticisi üzerinden yeniden üretilebilir.

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

Görsel kontrol matrisi: `320×568`, `360×640`, `375×667`, `390×844`, `430×932`, `448×998` ve `768×1024 dp`. Beklenen çember çapları sırasıyla `208`, `224`, `224`, `288`, `288`, `288` ve `320 dp`dir.

Bağlı fiziksel Android veya iOS cihazlarda açılış, kalıcı ilerleme, sürükleme, çeper çizgisi, ipucu, yaylı karıştırma, ses aç/kapat, mikro başarı, bölüm sonu konfeti ve iki modal kontrol edilir. Yol haritasındaki Günlük Bulmaca, Time Attack, PvP ve 3D pasaport mevcut sürümün kabul kapsamına dahil değildir.
