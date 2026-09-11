# Adaptif Zorluk, Aktif Süre ve İpucu Mantığı

Bu belge oyun motorunun oyuncu performansına göre nasıl ayarlandığını açıklar. Sistem oyuncuyu bir anda farklı bir işleme veya farklı bir adım sayısına taşımaz; işlem serisi ve şehir akışı korunur.

## 1. İpucu ve mücevher ekonomisi

Ayrı bir ipucu kredisi bakiyesi yoktur. İpucu yalnız ana mücevher bakiyesinden ödenir.

1. Yeni oyuncu `30` mücevherle başlar.
2. İpucu düğmesine basıldığında ve çözüm bulunabildiğinde `10` mücevher harcanır.
3. Bakiye `10` mücevherin altındaysa ipucu kullanılmaz; oyun `feedback.noHints` ile mücevher dilinde uyarı gösterir.
4. Yeni bir rota ilk kez açıldığında `+10` mücevher verilir (`ROUTE_GEM_REWARD`). Aynı rota için bu ödül ikinci kez verilmez; açılan rota kimlikleri kalıcı kayıtta tutulur.
5. Sahte ödüllü reklam yoktur. AdMob native build’de varsa banner içindir; rewarded callback hazır değildir. Gerçek rewarded ileride bağlanırsa ipucu kredisi değil `+30` mücevher (3 ipucu değeri) verilebilir. Reklam yüklenememesi, iptal veya arka plan ödül üretmez.

## 2. Aktif oyun süresi

Performans hesabında telefonun açık kaldığı duvar saati kullanılmaz. Yalnızca oyuncunun aktif etkileşim süresi ölçülür.

1. Oyun görünür ve aktif olduğunda süre başlar veya kaldığı yerden devam eder.
2. Her anlamlı dokunuş süreyi yeniler: sayı seçimi, yeni düğüm ekleme, işlem bırakma, karıştırma ve ipucu.
3. Son anlamlı dokunuştan itibaren en fazla `15.000 ms` aktif süreye eklenir.
4. `15` saniyeden uzun hareketsizlikte süre otomatik olarak duraklatılır.
5. Yeni bir dokunuş geldiğinde sayaç kaldığı yerden devam eder.
6. Uygulama arka plana geçtiğinde, ayarlar/modal açıldığında, başka ekrana geçildiğinde veya bölüm kutlaması gösterildiğinde sayaç durur.
7. Puzzle tamamlandığında son aktif zaman parçası kapatılır ve performans kaydı oluşturulur.

Bu nedenle telefonu açık bırakmak oyuncuyu başarısız göstermez. Örneğin 4 dakikalık duvar saati içinde 3 dakika hiçbir işlem yapılmadıysa, performansa yaklaşık 1 dakikalık aktif süre yansır.

## 3. Puzzle performans sınıfları

Her tamamlanan puzzle için üç veri saklanır:

- `activeMs`: hareketsizlik kesilmiş aktif süre
- `hintsUsed`: kullanılan ipucu sayısı
- `wrongAttempts`: geçersiz işlem veya tekrar deneme sayısı

Sınıflandırma:

| Sınıf | Koşul |
| --- | --- |
| Başarılı | `0` ipucu, en fazla `1` hata ve `45` saniyeden kısa aktif süre |
| Normal | Yukarıdaki iki sınıfa girmeyen sonuç |
| Zorlandı | `2+` ipucu veya `5+` hata veya `120` saniyeden uzun aktif süre |

## 4. Zorluk kararının alınması

1. Son `5` puzzle'ın performansı geçmişte tutulur.
2. İlk `3` kayıt oluşmadan adaptif değişiklik yapılmaz.
3. Son beş kaydın başarılı/zorlandı puanı toplanır:
   - Başarılı: `+1`
   - Normal: `0`
   - Zorlandı: `-1`
4. Toplam en az `+3` ise sonraki şehir için zorluk `+1` olur.
5. Toplam en fazla `-2` ise sonraki şehir için zorluk `-1` olur.
6. Diğer durumda zorluk değişmez.
7. İlk beş öğretici ülkede adaptif değişiklik kapalıdır (`countryIndex < 5`).
8. Öğrenme skorundan gelen `−1/0/+1` sayı zorluğu yeni şehir başında uygulanır. Aynı şehirde işlem türü ve temel adım kuralı değişmez.
9. Aynı şehir içinde (Country Challenge hariç) art arda iki `Zorlandı` sonucu oluşursa **sonraki puzzle** üretiminde zorluk en fazla `1` kademe düşer; sayaç sıfırlanır. Challenge bu rahatlamayı almaz.

## 5. Başarısız zor şehir için güvenli geri dönüş

1. Zorluk yükseltilmiş bir şehirde tek kötü puzzle hemen düşüş oluşturmaz.
2. Arka arkaya iki `Zorlandı` sonucu oluşursa, aynı şehirde (Challenge değilse) bir sonraki puzzle üretiminde zorluk en fazla `1` kademe azaltılır. Yeni şehir başı ayrı olarak öğrenme skorunu kullanır.
3. Zorluk hiçbir zaman tek kararda birden fazla kademe değişmez.
4. İşlem türü, şehir serisi, ülke ilerlemesi ve kazanılmış ödüller geri alınmaz.

## 6. Rota temel zorluğu

Etkin sayı zorluğu iki parçadan oluşur:

```text
etkin zorluk = rota/ülke temel zorluğu + oyuncu düzeltmesi (-1, 0, +1)
```

- İlk iki ülke: öğretici sayı havuzu.
- 3–5. ülkeler: orta sayı havuzu.
- Sonraki rotalar: rota sırasına göre daha geniş ve büyük sayı havuzları.
- Master Tour: ileri havuz.

Oyuncu düzeltmesi yalnız sayı havuzunu ve hedef üretim zorluğunu etkiler. Şehirdeki işlem serisini veya temel adım sayısını değiştirmez.

## 7. Kalıcı kayıt

Şu bilgiler cihazda saklanır:

- mücevher bakiyesi
- ödülü alınmış rota kimlikleri
- son performans kayıtları
- şehir zorluk düzeltmesi ve şehir kimliği
- art arda zorlanma sayısı
- öğrenme skoru

Eski kayıtlar varsayılan olarak `30` mücevher ve nötr zorluk düzeltmesiyle açılır. Yeni kayıt biçimi eski ilerlemeyi koruyacak şekilde sürümlendirilmiştir. Ayrı ipucu kredisi alanı yoktur.

## 8. Reklam entegrasyonu için sınır

AdMob native build’de banner için bağlanabilir; Expo Go’da güvenli biçimde kapalıdır. Ödüllü reklam callback’i hazır değildir ve uygulama kendiliğinden reklam ödülü taklit etmez.

İleride gerçek rewarded bağlanırsa sözleşme mücevher ekonomisine aittir:

```ts
onRewardedAdCompleted(() => {
  setGemCount((count) => count + 30); // 3 ipucu değeri
});
```

Bu callback yalnız reklam sağlayıcısı reklamın başarıyla tamamlandığını bildirdiğinde çağrılmalıdır; reklam yüklenememesi, iptal edilmesi veya arka plana alınması ödül üretmemelidir.
