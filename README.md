# Number of Wonders

Sayıları çember üzerinde birleştirerek 24 tematik rotada 170 ülke etabı ve 510 destinasyon açtığın Expo SDK 57 tabanlı React Native oyunudur. Her ülke 7+7+7+1 Challenge olmak üzere 22 puzzle içerir.

Ana ekrandaki **Oyuna Devam Et** kartı kayıtlı puzzle'ı tek dokunuşla açar. Rota ve ülke ekranları keşif için kalır; şehirler ayrı bir seçim ekranı yerine ülke kartlarında gösterilir.

## Kurulum

```bash
npm install
```

Development build kurmadan Expo Go ile hızlı geliştirme sunucusu:

```bash
npm start
```

Bu komut özellikle `--go` modunu kullanır; cihazda development build aramaz.

Tek bir platformda ilk native development build'i derleyip seçilen cihaza kurmak için:

```bash
npm run android
npm run ios
```

Native build cihazda kurulduktan sonra yalnızca development-client Metro sunucusunu açmak için:

```bash
npm run start:dev-client
```

## Fiziksel cihazda çalıştırma

Tek komut bağlı fiziksel Android ve iOS cihazlarının tamamını algılar. İki platform da bağlıysa ikisini de, aynı platformda birden fazla cihaz varsa her birini derleyip açar; emülatör ve simülatörleri bilinçli olarak dışarıda bırakır.

```bash
npm run devices
```

Yalnızca bir platformu çalıştırmak için:

```bash
npm run devices:android
npm run devices:ios
```

- Android'de USB hata ayıklamayı açıp bilgisayara bağlantı izni ver.
- iOS'ta Mac'e güven ver, Geliştirici Modu'nu aç ve Xcode imzalama hesabını hazırla.
- İlk çalıştırmada native derleme yapılıp `platform.tnts.numberofwonders` development build'i cihaza kurulur; sonraki yalnızca JavaScript/TypeScript değişikliklerinde `npm run start:dev-client` yeterlidir.
- Metro varsayılan olarak LAN modunda `8081` portunu kullanır. Gerekirse `DEVICE_METRO_MODE=tunnel` veya `DEVICE_METRO_PORT=8082` ile değiştirilebilir.
- Native Gradle/Xcode derlemesinden önce script en az `5 GB` boş disk alanını doğrular. Alan yetersizken yalnız fiziksel Android cihazlar otomatik olarak Expo Go ile açılır; yeterli alan oluştuğunda aynı komut yeniden native development build üretir. Bu akış `No space left on device` ile yarıda kalan ve bozuk cache bırakan derlemeleri önler.

## Kontroller

```bash
npm run lint
npx tsc --noEmit
npm run validate:levels
npx expo-doctor@latest
npx expo export --platform all
```

Sürüm ayrıntıları için [Expo SDK 57 belgelerine](https://docs.expo.dev/versions/v57.0.0/) bakın.

## Tasarım ve sesler

Ürün döngüsü, seviye üretim invariantları, dünya rotası, pasaport, responsive ekran ölçüleri, piksel hassasiyetindeki yerleşim, erişilebilirlik ve ses kuralları [DESIGN_RULES.md](./DESIGN_RULES.md) dosyasındadır.

Mevcut sayı matrisi, çözülmüş hedefler, toplam puan, mücevher bakiyesi, seviye, Bonus Keşif geçmişi ve ses/haptics tercihi cihazda kalıcı tutulur.

## Oyun eğitimi ve işlem yönlendirmesi

`FreshGameTutorialModal` ilk oyunda açılan öğretici akıştır. Modal, `OYUN EĞİTİMİ` rozetiyle gösterilir; karıştırma ve ipucu adımlarını sesleriyle birlikte öğretir, ipucunda doğru A→B bağlantısını iki kez çizer, ardından `Sıra Sende!` durumuna geçer. Eğitim tamamlandığında konfeti ve `game-treasure.wav` ile gerçek oyuna bırakır.

Oyun tahtası da eğitim modalındaki RN responder çizim akışını kullanır: dokunma düğüm üzerinde başlar, her hareket segmenti düğümler boyunca taranır, geri yönde geçiş son düğümü çıkarır ve release anındaki son segment de doğrulanır. Android’de bu akışın önüne RNGH manual handler geçirilmez; böylece çizgi ve düğüm sesi aynı dokunma olayında kararlı kalır.

Gerçek oyun tahtasının merkezindeki işlem düğmesi (`+`, `−`, `×`, `÷`) yalnızca yönlendirme amacı taşır. İlk ülkede ilk üç şehir girişinde birer kez gösterilir ve oyuncu ilk sayı düğmesine dokunduğunda kapanır. Sonraki ülkelerde her işlem türü için en fazla iki gösterim yapılır. Gösterim sayaçları `@numbers-of-wonders/operation-guide-v1` anahtarıyla cihazda saklanır; reklam, ekran geçişi veya yeniden açılış bu sayaçları sıfırlamaz.

## Android ses ve dokunma çözümü

Android’de kısa oyun efektleri `expo-audio`/ExoPlayer yerine özel native `AndroidGameSoundPool` modülünden oynatılır. Modül açılışta sesleri preload eder, sessiz warm-up yapar ve hızlı art arda dokunuşları ayrı SoundPool stream’leriyle kuyruğa almadan oynatır. Müzik için ExoPlayer kullanılmaya devam eder; temiz açılış logunda tek ExoPlayer görülmesi beklenir.

Expo Go bu native modülü içermez ve kısa efektlerde gecikme görülmesi beklenir. Ses/dokunma doğrulaması `platform.tnts.numberofwonders` native development build ile yapılmalıdır. Gerekirse cihazdaki eski uygulama kaldırılıp `android/app/build/outputs/apk/debug/app-debug.apk` yeniden kurulmalıdır. AdMob da aynı nedenle native build’de config plugin ile, Expo Go’da ise güvenli biçimde devre dışı kalır.

Oyun efektleri `assets/sounds` altında yerel WAV dosyaları olarak paketlenir. Dosyaları üretim tanımından yeniden oluşturmak için:

```bash
npm run sounds:generate
```
