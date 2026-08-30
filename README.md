# Number of Wonders

Sayıları çember üzerinde birleştirerek hedefleri çözdüğün, şehir ve ülke rotaları açtığın Expo SDK 57 tabanlı React Native oyunudur.

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
- İlk çalıştırmada native derleme yapılıp `com.oktaytontas.numbersofwonders` development build'i cihaza kurulur; sonraki yalnızca JavaScript/TypeScript değişikliklerinde `npm run start:dev-client` yeterlidir.
- Metro varsayılan olarak LAN modunda `8081` portunu kullanır. Gerekirse `DEVICE_METRO_MODE=tunnel` veya `DEVICE_METRO_PORT=8082` ile değiştirilebilir.

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

Mevcut sayı matrisi, çözülmüş hedefler, seviye, Bonus Keşif geçmişi ve ses/haptics tercihi cihazda kalıcı tutulur.

Beş oyun efekti `assets/sounds` altında yerel WAV dosyaları olarak paketlenir. Dosyaları üretim tanımından yeniden oluşturmak için:

```bash
npm run sounds:generate
```
