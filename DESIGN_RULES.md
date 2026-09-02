# Number of Wonders — Oyun, Tasarım, Ekran ve Ses Kuralları

Bu dosya React Native uygulamasının bağlayıcı kabul ölçütüdür. Oyun mantığında ürün dokümanı, görsel ölçülerde kaynak HTML esas alınır.

## Referans ve öncelik

- Görsel referans: `/Users/oktaytontas/Downloads/number_of_wonders_interactive_game_analysis (1).html`
- Referans SHA-256: `ec3814c4057acf9d4dbaf36aa4d7fd73f77cb7d061e3647ec12802204608abbf`
- Yolculuk haritası referansı: `/Users/oktaytontas/Documents/android_apps/tecvid_elifba_pro/app/src/main/java/platform/tnts/tecvidogren/oyunlar/WordJourneyActivity.java`
- Yolculuk haritası referans SHA-256: `d4d2328424e0f827070d52214ce8994cf6fc282982d86a366aa5fcae3e69e1f4`
- Oyun ekranı görsel referansı: `/Users/oktaytontas/Documents/android_apps/tecvid_elifba_pro/app/src/main/res/layout/activity_word_path_game.xml`
- Oyun ekranı layout SHA-256: `28db620d46a437f95720a25aa37ac6438c9bcae5cfe48da390f2e3f9a0fd66d7`
- Ayarlar modalı referansı: `/Users/oktaytontas/Documents/android_apps/tecvid_elifba_pro/app/src/main/res/layout/dialog_word_path_settings.xml`
- Ayarlar modalı referans SHA-256: `c4c227b3c56d6996ed667ebc44343400eae3ebe72f6a7a56d6cf0f9b419eb77a`
- Ses ayarı davranış referansı: `/Users/oktaytontas/Documents/android_apps/tecvid_elifba_pro/app/src/main/java/platform/tnts/tecvidogren/oyunlar/WordPathAudioSettings.java`
- Ses ayarı davranış SHA-256: `158640434377be1efdce9d7e9a3d8ff1721cf9124a61365b3e86997c0da80a51`
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
4. Her seviyede ana hedeflerden farklı, garantili çözülebilen bir `💎 Bonus Hedef` kartı bulunur. Bu kart isteğe bağlıdır; ilk beş öğretici ülkede 2 adımlı, 6–8. ülkelerde 2/3 adımlı, sonrasında 2/3/4 adımlı olabilir. Normal ödüller 2/3/4 adım için `4/8/14` mücevherdir; Country Challenge ödülü `×1,5` ile `6/12/21` olur.
5. Bonus kartı dışında hedef olmayan geçerli bir işlem ilk kez keşfedilirse Bonus Keşif sayacı artar ve `+1 mücevher` verir; aynı kombinasyon tekrar ödül vermez.
6. Tüm **ana hedefler** bitince bonus kartının durumuna bakılmadan konfeti, güçlü başarı titreşimi ve seviye geçişi çalışır. Çözülmemiş bonus sonraki seviyeye geçişi hiçbir zaman engellemez.
7. Her ülkede üç destinasyon da 8&apos;er puzzle içerir; 25. puzzle Country Challenge&apos;dır.
8. Country Challenge tamamlanınca vize pulu ve landmark kazanılır. Oyuncu zorla rota ekranına gönderilmez; ister oyuna devam eder, ister ana ekrandaki Seyahat düğmesiyle yeni bağlantıyı inceler.
9. Normal seviye geri bildirimi `Puzzle x/y tamamlandı • Şehir` biçimindedir. `Şehir tamamlandı` yalnız katalogda bir sonraki puzzle başka destinasyona geçtiğinde; ülke tamamlandı mesajı yalnız Country Challenge çözüldüğünde gösterilir.

## Seviye ve matematik motoru

| İlerleme | Düğüm | Hedef | Temel işlem yapısı |
| --- | ---: | ---: | --- |
| 1. ülke, puzzle 1–10 | 5 | 3 | İki adımlı toplama |
| 1. ülke, puzzle 11–25 | 6 | 4 | İki adımlı toplama; Challenge dahil |
| 2–5. ülkeler | 6 | 4 | Şehir başına sabit işlem, iki adımlı öğretim |
| 6–8. ülkeler | 7 | 4 | Şehir başına sabit işlem; toplama/çarpma 3, diğerleri 2 adım |
| 9–16. ülkeler | 7 | 4 | Şehir başına sabit işlem; bölme 2, diğerleri 3 adım |
| 17+ ülkeler | 7 | 4 | Şehir başına sabit işlem; ana hedefler 3 adım |

- Önce benzersiz çember sayıları seçilir; hedefler yalnızca bu sayıların gerçek kombinasyonlarından türetilir.
- İlk beş ülkenin şehir işlem planı sırasıyla `+++/+-+/-+-/*+*/÷*÷` biçimindedir. Altıncı ülkeden itibaren işlem her yeni şehirde `+ → − → × → ÷` döngüsünde değişir ve sekiz puzzle boyunca sabit kalır.
- Country Challenge daima üçüncü şehrin işlemini sürdürür. İlk beş ülkede 2 adımlıdır; 6–8. ülkelerde şehir kuralını korur; 9–16. ülkelerde 3 adımlıdır; 17. ülkeden sonra toplama/çarpma Challenge 4, çıkarma/bölme Challenge 3 adımlıdır.
- Sayı havuzları 1–2, 3–5, 6–20 ve 21+ ülke katmanlarında büyür. Bölme havuzları yalnız tam sonuç veren, gittikçe daha büyük çarpan ailelerinden seçilir.
- Adaptif zorluk, aktif oyun süresi, hata ve ipucu geçmişiyle yalnız yeni şehir başında `−1/0/+1` sayı zorluğu uygular. İlk beş öğretici ülkede kapalıdır; 15 saniyelik hareketsizlik aktif süreden çıkarılır. Ayrıntılı sözleşme `ADAPTIVE_DIFFICULTY.md` içindedir.
- İkili hedefler `A op B`, üçlü/dörtlü hedefler seçilen işlemle `A op B op C (op D)` biçimindedir. Bir seviyedeki hedeflerin adım sayısı üstteki `Gereken` göstergesiyle aynı olmalıdır.
- Çıkarma ve bölme sürükleme sırasına duyarlıdır: ilk seçilen sayı başlangıç değeridir ve kalan sayılar seçilme sırasıyla uygulanır. Çıkarma sonucu pozitif, bölmenin her ara sonucu tam sayı olmalıdır. Toplama ve çarpma değişmelidir; ters sıra aynı işlem ve keşif sayılır.
- Her hedef benzersiz, çözülebilir ve dahili çözümleyiciyle doğrulanmış olmalıdır. Eksik hedefle seviye başlatılamaz.
- Bonus hedef, ana hedeflerle aynı çember ve işlemden türetilir; ana hedef değerlerinden farklı, benzersiz ve çözümleyiciyle doğrulanmış olmalıdır. Bonus kartı ana hedef sayısına ve seviye tamamlama koşuluna dahil edilmez.
- Hedef seçici, düğüm kullanım sayılarının farkını ve kareler toplamını minimize ederek bütün çemberi olabildiğince dengeli kullanır.
- Mevcut seviyenin hedef değerleri sonraki seviye üretilirken dışlanır. Aynı hedef değeri art arda iki seviyede gösterilemez; bir seviye ara verildikten sonra yeniden kullanılabilir.
- Uygulama kapanıp açılsa da mevcut sayı matrisi, hedefler, bonus hedefi, çözülmüş kartlar, bonus çözüm durumu, toplam puan, mücevher bakiyesi, seviye, Bonus Keşif geçmişi, efekt tercihi, müzik tercihi ve müzik seviyesi korunur.
- Dahili global puzzle numarası üretim ve kayıt için kullanılabilir; hiçbir oyuncu arayüzünde “Level 847” gibi gösterilemez. Oyuncu yalnız rota, ülke, destinasyon ve destinasyon içi `x/y` puzzle ilerlemesini görür.

## Dünya rotası, ülkeler ve pasaport

Katalog tam olarak 21 ardışık rota, 145 benzersiz ülke/149 ülke etabı, 447 gerçek destinasyon ve 3.725 ana puzzle içerir:

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

- Her ülke tam `25` ana puzzle içerir: destinasyonlar `1–8`, `9–16`, `17–24`; Country Challenge `25`.
- Ülke ve rota state&apos;leri `LOCKED`, `AVAILABLE`, `CURRENT`, `COMPLETED` semantiğini taşır. Bir sonraki ülke/rota ancak önceki tamamlanınca açılır.
- Ulaşım yalnız ilerleme ödülüdür. Mesafeye göre araba, tren, gemi veya uçak gösterilir; coin/gem ödeme duvarı oluşturulmaz.
- Pasaport yalnız tamamlanan ülkeleri sayar. Başlangıç `0/100`, her Country Challenge sonrası bir pul, Yeni Zelanda finali sonrası `100/100` gösterilir.
- Yeni Zelanda Challenge arayüzde `WORLD TOUR FINAL` adını alır. Tamamlandığında bütün rotalar tamamlanmış kalır, `WORLD TOUR COMPLETED`, `Golden Compass` ve `World Explorer` ödül metası tetiklenir; sonraki döngü Master World Tour&apos;dur.

## Yolculuk haritası ve giriş akışı

- Uygulama açıldığında ilk ekran Words of Wonders tarzı ana menüdür; sayı çarkı veya rota listesi doğrudan açılmaz.
- Ana menü arka planı `assets/images/img/bg.png` görselini `cover` olarak kullanır; ülke veya seviye değişiminde başka bir arka planla değiştirilmez.
- Ana menünün ve oyun HUD&apos;unun sol üst grubunda oyuncu puanı, sağ üst grubunda mücevher bakiyesi bulunur. Bölüm tamamlandığında, yapılan ana hedef işlemlerindeki sayıların toplamı × adım sayısı kadar puan toplu olarak eklenir. Bonus hedef ödülü sonuçtan bağımsız olarak 2/3/4 adım için `4/8/14`, Challenge&apos;da `6/12/21` mücevherdir. İlk kez bulunan serbest Bonus Keşif `+1 mücevher` verir. Toplam puan ve mücevher bakiyesi kalıcı progress&apos;te saklanır.
- Ekranın merkezindeki büyük altın çerçeveli `BÖLÜM` düğmesi aktif ülke/destinasyon içindeki puzzle numarasını gösterir ve kayıtlı sayı matrisi ile çözülmüş hedeflerden **tek dokunuşla** devam eder.
- Alt soldaki `PROFİL` düğmesi puan, tamamlanan puzzle, ülke, Bonus Keşif ve pasaport ilerlemesini açar. Alt sağdaki `SEYAHAT` düğmesi 14 rota, ülke kartları, şehir/lokasyon çipleri ve Challenge rayını içeren yolculuk sayfasını açar.
- Rota → ülke → şehir gezinmesi günlük oyuna giriş koşulu değildir. Şehirler ülke kartlarında ilerleme bilgisi olarak görünür; ayrıca şehir seçtirilmez.
- Hero altındaki `OYUNA DEVAM ET` kartı, oyuncunun bulunduğu harita katmanından bağımsız olarak kayıtlı aktif puzzle&apos;ı **tek dokunuşla** açar. Günlük oyun akışında rota veya ülke seçimi zorunlu değildir.
- Rota ve ülke listeleri progression engeli değil, keşif/navigasyon yüzeyidir. Oyuncu isterse dünya rotalarını inceler; hızlı oturumda doğrudan `OYUNA DEVAM ET` kullanır.
- Zoom 1/Dünya aynı anda yalnız 14 tematik rotayı gösterir; 100 ülke pini gösterilmez. Mevcut rota parlak, tamamlanan rota altın, kilitli rota soluktur.
- Dünya hero&apos;sunda `assets/images/world-tour-map.png` kullanılır: yaklaşık doğru kıta yerleşimi, politik sınır ve metin içermeyen 3D/illustrated arazi, altın seyahat izi ve koyu okunabilir UI alanı korunur.
- Zoom 2/Rota yalnız seçili rotanın coğrafi seyahat sırasındaki 7–8 ülkesini ve aralarındaki ulaşım bağlantılarını gösterir.
- Ayrı bir şehir/destinasyon seçim katmanı bulunmaz. Destinasyonlar progression verisi ve görsel keşif bilgisi olarak korunur; oyuncuya ek seçim adımı çıkarmaz.
- Aktif ülke kartına dokunmak da doğrudan kayıtlı puzzle&apos;ı açar. Tamamlanmış veya kilitli ülke kartları kayıtlı seviyeyi değiştirmez.
- Dünya → rota geçişi keşif içindir; puzzle&apos;a erişim `OYUNA DEVAM ET` veya aktif ülke kartı üzerinden gerçekleşir. Geri kontrolü rota katmanından Dünya&apos;ya, oyun içindeki harita düğmesi de Dünya katmanına götürür.
- Üst hero alanı Dünya katmanında dünya haritasını, Rota katmanında seçili rota görselini kullanır; hero yüksekliği güvenli alan hariç `268 dp`dir. Alttaki koyu scrim başlık ve rota bilgisini her görselde okunur tutar.
- Devam kartı hero üzerine `16 dp` biner, yatayda `16 dp` boşluk bırakır ve `18 dp` köşe yarıçapı kullanır. Başlık `OYUNA DEVAM ET`; alt satır aktif ülke, destinasyon ve destinasyon içi puzzle ilerlemesidir. Kartın ilerleme çizgisi aktif ülkenin `x/25` durumunu gösterir.
- Rota ve ülke kartları `24/54 dp` ile `54/24 dp` dönüşümlü yatay marjinlerle zikzak yerleşir. Kartlar en fazla `50 ms` aralıkla, `360 ms` sürede ve alttan `22 dp` kayarak açılır.
- Ülkeler arasındaki bağlantı alanı `56 dp` yüksekliğindedir; ortadaki ulaşım/mesafe çipi rota verisinden okunur.
- Her ülke kartı sıra/durum, ülke adı, üç şehir/lokasyonu ayrı ve okunabilir bilgi çipleriyle, `5 dp` ilerleme çubuğunu ve üç destinasyon + Challenge ilerleme rayını gösterir. Bu şehir çipleri seçim kontrolü değildir.
- Kilitli karta basmak kaydı veya aktif puzzle&apos;ı değiştirmez. Tamamlanan rota/ülke incelenebilir ancak yalnız `CURRENT` ülke kartı oyunu açabilir.
- Oyun ekranındaki geri düğmesi ana menüye döner; Android sistem geri tuşu da oyun, profil veya Seyahat sayfasındayken ana menüye döner. Seyahat sayfasının kendi geri düğmesi rota katmanındayken Dünya katmanına, Dünya katmanındayken ana menüye gider.
- Harita yüzeyi sıcak parşömen gradyanıdır: `#FBF7EE → #F3E7D3 → #E7D3B4`. Devam kartı `#FFF9E9`, ana koyu kontrol `#2D394B`, altın vurgu `#F4D37B`, ana metin `#49382E`dir.
- Harita içeriği en fazla `512 dp` genişliktedir ve büyük ekranlarda ortalanır. Dar ekranlarda yatay taşma kabul edilmez; bütün rota tek bir dikey kaydırma yüzeyinde kalır.

## Görsel dil ve pixel-perfect ölçüler

- Yazı ailesi tüm ekranlarda `Plus Jakarta Sans` 400, 500, 600, 700 ve 800 ağırlıklarıyla yerel olarak yüklenir.
- Puzzle ekranı `assets/images/game-sky-background.png` görselini `cover` olarak kullanır. Bu dosya Android referansındaki sky background ile byte-byte aynıdır; üzerine yalnız yaklaşık `%3–10` koyu okunabilirlik katmanı gelir.
- Puzzle ekranı üst HUD&apos;u güvenli alanın altında `46 dp` yüksekliğindedir; yatay marjin `12 dp`, üst marjin `8–10 dp`dir. Sıra yalnızca `geri → puan … mücevher → ayarlar` biçimindedir; oyun HUD&apos;unda pasaport veya başka kontrol bulunmaz.
- Ülke/şehir şeridi HUD&apos;un `4 dp` altındadır; `106 dp` yüksekliğinde, ekranın `%94` genişliğinde ve en fazla `488 dp`dir. `28 dp` köşe, `1.5 dp` açık turkuaz kenarlık ve `#3E6472 → #263F4D` yarı saydam degrade kullanır.
- Şeridin ilk satırı ülke/flag, aktif işlem çipi ve ülke içi `x/25` ilerlemesini gösterir. Challenge aktifken yalnız ülke adının sağında, layout değiştirmeyen hafif pulse animasyonlu `CHALLENGE` etiketi görünür; oyun alanının başka bir yerinde tekrar edilmez.
- İkinci satır üç destinasyonu `✓ tamamlandı / ● aktif / ○ bekliyor` semantiğiyle sıralar. İlerleme rayı puzzle ağırlıklarıyla `8 + 8 + 8 + 1` oranında dört parçadır; son `%4` genişlikteki kupa parçası Country Challenge ilerlemesidir.
- Oyun açıkken 24. puzzle tamamlanıp Country Challenge seviyesine otomatik geçildiğinde ödül veya ek açıklama içermeyen, yalnız `COUNTRY CHALLENGE` bilgisini belirginleştiren kısa başlangıç modalı bir kez gösterilir. Ana sayfadaki `Devam Et` düğmesiyle kayıtlı Challenge&apos;a dönmek bu modalı yeniden açmaz. Challenge üçüncü şehrin işlemini kesintisiz sürdürür; adım sayısı ülkenin öğretim katmanına göre yükselir.
- Bir destinasyonun son puzzle&apos;ı tamamlandığında otomatik seviye değişmeden önce ortada `DESTİNASYON TAMAMLANDI` kartı görünür; biten destinasyon ve açılan sıradaki destinasyon/Challenge açıkça yazılır. Bu kart bilgi amaçlıdır ve yaklaşık `1.6 sn` sonra akış devam eder.
- Country Challenge tamamlandığında sonraki ülkeye otomatik ve sessiz geçilmez. Üç destinasyonun onay işaretlerini, `25/25`, pasaport damgasını, landmark ödülünü ve açılan sonraki ülkeyi gösteren zorunlu ülke tamamlama modalı açılır. Yeni ülkenin ilk puzzle&apos;ı yalnız `Sıradaki ülkeye geç` eylemiyle başlatılır; tamamlanmış kayıt uygulama yeniden açıldığında da bu modal atlanmaz.
- Header ve ana içerik en fazla `512 dp`, modal en fazla `448 dp` genişliğindedir. Modal yüksekliği ekranın en fazla `%85`idir.
- Ana yatay boşluk `16 dp`; yalnızca kullanılabilir genişliği `288 dp` altına düşen çok dar ekranlarda taşmayı önlemek için küçültülebilir.
- Hedef alanı Android&apos;deki açık word-card yüzeyine uyarlanır: `#F8FCFB → #DCECEC`, `28 dp` dış köşe, `2 dp #D5EEF2` kenarlık. Üst bilgi satırı `İŞLEM TÜRÜ` altında yalnız işlem sembolünü ve `ADIM SAYISI` altında sayısal adım değerini gösterir. Üç hedef `%31.6`, dört hedef `%23.5` genişlikle tek satırda kalır; aralık `8 dp`, kart yüksekliği en az `62 dp`dir.
- Hedef kartı varsayılan olarak krem degrade, koyu `#233540` sayı ve turkuaz metadır. Başarı durumu emerald kalır; hedef kartı ölçeklenmez ve yerleşim sıçramaz.
- Bonus satırı solda `SAYILARI BİRLEŞTİR` yönergesini, sağda bonus sayısını gösterir. Bonus çözülünce sayı onay işaretiyle değiştirilmez; satırın emerald durumu ve mücevher metni sonucu bildirir.
- Geri bildirim yuvası `52 dp` yüksekliğinde ve dikeyde `4 dp` marjinlidir. Boş durumda görünür bir `SAYILARI BİRLEŞTİR` placeholder&apos;ı bulunmaz; seçimde aynı yuvada koyu geri bildirim kartı görünür ve çark yerinden oynamaz.
- Çember geniş telefonlarda `304 dp`, tabletlerde `336 dp`dir. Dikey alan kısa olduğunda Android constraint davranışına denk olarak `224 / 240 / 268 / 288 dp` kademelerine küçülür; içerik yine dikey kaydırılabilir.
- Düğüm çapı telefonda `64 dp`, geniş düzende `66 dp`dir. Düğüm merkezleri dış çeperden `düğüm yarıçapı + 10 dp` içerideki eşit açılı yörüngeye yerleşir; en kısa düzende yörünge yarıçapı en az `72 dp`dir.
- Çarkın koyu dolu diski yoktur. Düğüm merkezlerinden geçen `7 dp rgba(55,83,92,0.42)` rota halkası ve `10 dp` hafif alt gölge kullanılır. Düğüm yüzeyi `#F8FCFB → #DAEBEB`, kenarı yarı saydam turkuaz ve sayısı `#233540`dır; seçili düğüm turkuaz, sayı beyazdır.
- İpucu ve Karıştır çarkın merkezinde bulunamaz. Çarkın hemen altındaki `62 dp` aksiyon satırında İpucu solda, Karıştır sağda yer alır. Her kontrol `52×52 dp`, yuvarlak, yarı saydam koyu degrade, beyaz `22 dp` ikon ve `9 dp` etikettir.
- Hedef başarı durumunda kart büyümez. Arka plan açık emerald olur, kenarlık `2 dp #10B981`, metin `#23785B` ve yeşil parlama kullanılır.
- Kısa ekranlarda ana içerik dikey kaydırılabilir; yatay taşma veya kırpılma kabul edilmez. Sürükleme sırasında kaydırma kilitlenir.

## Etkileşim ve animasyon

- Bağlantı çizgisi Android `WordWheelView` referansındaki gibi merkezden merkeze tek ve kesintisiz path olarak, `14 dp` yumuşak gölge/parlama ve `6 dp` renkli akış katmanıyla çizilir; düğümler path’in üstüne çizildiği için hat düğüm yüzeylerinin altında kaybolur. Parmak ucu son düğüme doğrudan eklenir; yapay gecikme veya geriden gelen ikinci segment oluşturulmaz. Native/SVG çizimi cihaz piksel yoğunluğunda otomatik netleştirilir.
- Bir sürüklemede aktif hedefin 2/3/4 adım sayısından bağımsız olarak çarktaki tüm benzersiz düğümler sırayla seçilebilir; komşuluk zorunluluğu yoktur. Sonuç yalnız parmak bırakıldığında değerlendirilir. Bırakılan zincir ana hedefte zümrüt tonla `520 ms`, bonus/keşifte altın tonla `440 ms`, geçersiz seçimde mercan tonla `180 ms` ekranda tutulur; bu sürede yeni zincir başlatılamaz. Böylece oyuncu bağladığı sayıları ve sonucun karşılığını okuyabilir.
- WOW geri sarma kuralı uygulanır: parmak son seçilen düğümden yolun bir önceki düğümüne döndüğünde son düğüm seçimden çıkar. Parmak aynı yol üzerinde geriye ilerlemeyi sürdürürse tek hareket event&apos;inde dahi birden fazla düğüm sırayla sökülebilir. Yol içinde daha eski fakat bir önceki olmayan seçili düğüme atlamak döngü oluşturmaz ve yok sayılır.
- Hızlı parmak hareketinde yalnız son event noktası değil, önceki ve yeni nokta arasındaki doğru parçası da düğüm çeperlerine karşı hit-test edilir. Böylece hızlı geçilen hedef düğüm atlanmaz; aynı segment sırası hem ileri seçim hem geriye sarma için kullanılır.
- Aktif sürükleme koordinatı her pointer event&apos;inde React state&apos;e yazılamaz. Pointer çizgisi, segment hit-test&apos;i ve WOW geri sarma hesabı RNGH/Reanimated ile UI thread&apos;de yürür; JS/React yalnız zincir gerçekten değiştiğinde (düğüm ekleme veya sökme) güncellenir. Böylece ağır JS render&apos;ı parmak takibini bloke etmez.
- Oyun açıkken sürekli çalışan dekoratif animasyonlar yalnız native driver/UI thread uyumlu `opacity` ve `transform` özelliklerini kullanır. `shadowRadius`, `shadowOpacity` veya layout özelliklerini JS thread&apos;de sonsuz döngüyle animasyonlamak yasaktır.
- Seçili düğümün çapı değişmez; bağlantı çizgisi sabit düğüm çeperinde sonlanır. Sonuç tonu tutulma süresince hem çizgiye hem seçili düğüm yüzeylerine uygulanır.
- Karıştırma mevcut düğümleri yeniden oluşturmaz. Sayı ve mantıksal indeks korunur, yalnızca sayı→yuva eşlemesi değişir.
- Bütün düğümler eski konumlarından yeni konumlarına aynı anda `450 ms` boyunca `cubic-bezier(0.34, 1.3, 0.64, 1)` eğrisiyle kayar. Karıştır simgesi aynı sürede `360°` döner.
- Karıştırma sürerken yeni sürükleme başlatılamaz. Animasyon tamamlandığında hit-test koordinatları görsel konumlarla aynı olmalıdır.
- İpucu, çözülmemiş ilk hedefi ve çözüm düğümlerini `750 ms × 2` altın pulse ile vurgular; düğüm tepe ölçeği `1.3×`, hedef ölçeği `1.05×`, toplam görünür süre `1800 ms`dir.
- Dokunma hedefleri en az `44×44 dp` etkin alana sahip olmalı; her butonda Türkçe erişilebilirlik etiketi ve doğru rol bulunmalıdır.

## Ses ve dokunsal geri bildirim

- Kaynak HTML&apos;de indirilen bir ses asset&apos;i yoktur; `SoundEngine`, Web Audio osilatörlerini çalışma anında üretir. Native WAV&apos;lar bu dalga biçimlerinin çevrimdışı ve deterministik karşılığı olmalıdır.
- Efektler ağdan alınmaz; `assets/sounds` altındaki mono, `44.1 kHz`, `16-bit PCM WAV` dosyaları kullanılır. WAV&apos;lara gürültü, reverb, limiter rengi veya referansta bulunmayan ek nota katılamaz.
- `pop_select.wav`: ilk düğüm, `420 → 588 Hz`, `80 ms` sine chirp. Sonraki düğümler `select-2.wav` … `select-7.wav` ile `600 / 690 / 780 / 870 / 960 / 1050 Hz` başlangıç frekanslarına çıkar; böylece parmak ilerledikçe referanstaki yükselen kısa melodi sürer. Tümünde frekans `1.4×`, gain `0.15 → 0.01` exponential zarfıdır.
- `pop_hint.wav`: İpucu düğümü, `620 → 868 Hz`, aynı `80 ms` pop zarfı.
- `pop_shuffle.wav`: Karıştır düğümü, `360 → 504 Hz`, aynı `80 ms` pop zarfı; pembe gürültü kullanılmaz.
- `success.wav`: her hedef çözümünde sırasıyla `523.25 / 659.25 / 783.99 / 1046.50 Hz` triangle notaları; başlangıç aralığı `70 ms`, her nota `20 ms` attack ve `250 ms` toplam zarfa sahiptir. Ana hedef puanı bölüm sonunda seçilen sayıların toplamı × adım sayısı olarak toplu eklenir.
- `point.mp3`: bölüm sonunda puan sayacı artarken, puan artış animasyonuyla eşzamanlı çalınır.
- `bonus.wav`: ilk kez bulunan serbest Bonus Keşif için `880 → 1320 Hz`, `150 ms` sine chirp; bonus hedef kartı çözümünde ise `assets/sounds/dimaond.mp3` çalınır.
- Bırakılan sonuç önce yalnız çözülmemiş ana hedeflerle, sonra çözülmemiş isteğe bağlı bonus kartıyla eşleştirilir. Ana hedef ilk kez eşleşirse `seçilen sayıların toplamı × adım sayısı` puan hem bölüm toplamına eklenir hem geri bildirimde aynen gösterilir. Bonus kartı eşleşirse 2/3/4 adım için `4/8/14`, Challenge&apos;da `6/12/21` mücevher yalnız bir kez verilir. İkisiyle de eşleşmezse kombinasyon daha önce görülmemişse `⭐ Bonus Keşif` ve `+1 mücevher` kazanılır. Toplama/çarpma keşif anahtarı sıralanmış operandları, çıkarma/bölme anahtarı sürükleme sırasını kullanır; aynı geçerli yolun tekrarı ikinci bonus kazandırmaz.
- Kaynak HTML son hedefte `success` dışında ikinci bir ses çalmaz; `400 ms` sonra bölüm konfettisi başlar. Native sürümde konfetiyle aynı anda `level-complete.wav` kısa ve hafif (`%35` ses seviyesi) kutlama sesi olarak çalınır; `levelComplete` olayı makro titreşimi de korur.
- Sesler Expo SDK 57 `expo-audio` oyuncularıyla önceden yüklenir, tekrar öncesi başa sarılır, diğer uygulama sesini kesmez ve arka planda çalmaz.
- Mikrofon, Android kayıt izni, arka plan kayıt ve arka plan oynatma kapalıdır.
- Ses anahtarı sesi ve haptics efektlerini birlikte yönetir; tercih kalıcıdır.
- Sağ üstteki ayarlar düğmesi Android `dialog_word_path_settings.xml` akışını açar: `Ses` ve `Müzik` satırlarının tamamı anahtar gibi tıklanabilir, müzik seviyesi `%0–100` arasında canlı uygulanır ve `TAMAM` modalı kapatır. Dışarıdan yeni bir oyun mantığı alınmaz.
- Arka plan müziği Android referansındaki `journey.mp3` dosyasının byte-byte kopyasıdır (`SHA-256 b3a965f31ddbeb3de619a7b4bb151117e632df9c49059ff17f2f33ef3aca2901`), döngüde çalar, varsayılan olarak kapalı ve `%50` seviyededir. Arka plan oynatma kapalıdır; uygulama arka plana geçtiğinde müzik durur.
- Ses efektleri ve arka plan müziği ayrı tercihlerdir. Ses anahtarını kapatmak müziği, müzik anahtarını kapatmak kısa oyun efektlerini değiştirmez.
- Birleştirme sırasında (`select1…select7`) titreşim üretilmez; düğüm seçim sesi korunur. Haptic yalnızca ipucu, karıştır, bonus, başarı ve bölüm sonu gibi sonuç/aksiyon geri bildirimlerinde kullanılır.
- Kaynaklar `npm run sounds:generate` ile, ffmpeg&apos;e ihtiyaç duymayan `scripts/generate-sounds.mjs` deterministik PCM üreticisi üzerinden yeniden üretilebilir.

## Hedefe uçan sonuç animasyonu

- Geçerli bir sürükleme ana hedeflerden veya isteğe bağlı bonus hedeften biriyle ilk kez eşleştiğinde bulunan sonuç, son seçilen sayı düğümünün merkezinden eşleşen kartın merkezine uçmalıdır. Bonus uçuşu altın/mor görünür; serbest Bonus Keşif veya daha önce çözülmüş hedef bu animasyonu başlatmaz.
- Başlangıç ve bitiş koordinatları sabit ekran değerleriyle tahmin edilmez; çark, tam ekran uçuş katmanı ve ilgili hedef kartı `measureInWindow` ile ölçülür. Böylece farklı ekran boyları ve ScrollView konumlarında doğru karta ulaşır.
- Rozet okunabilir `720 ms` boyunca kavisli bir yörüngede ilerler; `1 → 1.25 → 1.02 → 0.3` ölçekle yaylanıp hedefte kaybolur. Rozet hedef alanına girdiği anda (uçuş ilerlemesinin yaklaşık `%90` noktasında) temas merkezinde zümrüt renk belirir ve `300 ms` içinde dairesel olarak kartın tamamına yayılır; renk bir anda bütün yüzeye geçmez. Aynı anda layout&apos;u değiştirmeyen kısa `1 → 1.08 → 0.98 → 1` scale animasyonu oynar ve rozet kalan sönüşünü renk yayılırken tamamlar. Bonus hedefin sağdaki sayı kartında da aynı merkezden yayılma uygulanır. Kartın dış çerçevesi aynı yuvarlak köşeyi kullanır ve üstüne ayrıca dikdörtgen/kare ring katmanı çizilmez.
- Son hedef uçuşunda bölüm konfettisi rozet hedefe varmadan başlamaz; varıştan `100 ms` sonra tetiklenir. Böylece hedefe giden sonuç ve kart eşleşmesi makro animasyon tarafından örtülmez.
- Uçuş katmanı `pointerEvents="none"` kullanır ve oyun dokunuşlarını engellemez. Ölçüm alınamazsa sonuç rozeti atlanır, hedef kartı iniş parlaması yine çalışır.
- Ses animasyon callback&apos;ine bağlı bırakılmaz: ana hedef eşleşmesi doğrulandığı anda `success.wav`, bonus kartı veya yeni serbest Bonus Keşif doğrulandığı anda `bonus.wav` yalnız bir kez çalar. Uçuşun iniş callback&apos;i ikinci ses üretmez.

## Kullanılan native kütüphaneler

- `expo-audio`: düşük gecikmeli yerel oyun efektleri.
- `expo-haptics`: mikro/makro dokunsal geri bildirim ayrımı.
- `expo-image`: arka plan önbelleği ve `1000 ms` şehir geçişi.
- `expo-blur`: gerçek modal arka plan bulanıklığı; Android SDK 31+ için hedef görünüm referansı kullanır.
- `react-native-fast-confetti` + `@shopify/react-native-skia`: her bölüm tamamlanmasında Skia Atlas tabanlı, renkli konfeti patlaması.
- `react-native-svg`: radyal çember/düğüm/pul yüzeyleri ve yoğunluktan bağımsız netlik.
- `react-native-gesture-handler`: çarkın native dokunma akışı, düğümden başlamayan dokunuşun ScrollView&apos;a bırakılması ve kesintisiz pan takibi.
- `react-native-reanimated`: aktif pointer çizgisi, segment hit-test&apos;i ve zincir state&apos;inin UI thread&apos;de güncellenmesi.
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

Seviye motoru tüm `1–3725` ana turu ve Master Tour başlangıcını tekrarlı rastgele koşularla doğrular: 21 rota, 145 benzersiz ülke/149 ülke etabı, 447 destinasyon, `8+8+8+Challenge`, doğru düğüm/hedef adedi, benzersiz hedefler, çözülebilirlik, adım tutarlılığı ve ardışık hedef tekrarsızlığı.

Görsel kontrol matrisi: `320×568`, `360×640`, `375×667`, `390×844`, `430×932`, `448×998` ve `768×1024 dp`. Beklenen çember çapları sırasıyla `224`, `240`, `240`, `304`, `304`, `304` ve `336 dp`dir.

Bağlı fiziksel Android veya iOS cihazlarda açılış, kalıcı ilerleme, sürükleme, çeper çizgisi, ipucu, yaylı karıştırma, ses aç/kapat, mikro başarı, bölüm sonu konfeti ve iki modal kontrol edilir. Yol haritasındaki Günlük Bulmaca, Time Attack, PvP ve 3D pasaport mevcut sürümün kabul kapsamına dahil değildir.
