# Cloudflare görsel yönetimi

Ülke ve rota görsellerinin tek kaynağı Cloudflare R2'dir. Mobil uygulama içinde
`assets/images/countries` klasörü tutulmaz ve bu görseller APK/IPA paketine eklenmez.

## Yapı

- R2 bucket: `numbers-of-wonders-assets`
- İçerik kökü: `word-journey/v2`
- Worker: `https://numbers-of-wonders-assets.storycolor-cdn.workers.dev`
- Manifest: `word-journey/v2/manifest.json`
- Worker kodu: `cloudflare/assets-worker`

R2 nesne yolları içerik hash'i taşır:

```text
word-journey/v2/countries/<route-id>/<country-id>-<10-karakter-hash>.webp
word-journey/v2/countries/<route-id>/main-<10-karakter-hash>.webp
```

Manifestte ülke anahtarı `<route-id>/<country-id>`, rota kapağı anahtarı ise
`<route-id>/main` biçimindedir.

## Wrangler girişi

```bash
npx wrangler login
npx wrangler whoami
```

## Görsel ekleme veya değiştirme

1. Görseli en fazla 1024 × 1024 boyutunda WebP olarak hazırla.
2. Dosyanın SHA-256 hash'inin ilk 10 karakterini nesne adına ekle.
3. Önce görseli R2'ye yükle.
4. R2'deki manifesti indir, ilgili `key` kaydının `path` değerini değiştir ve
   manifest `version` değerini yenile.
5. Manifesti en son yükle. Böylece uygulama hiçbir zaman eksik bir görsele yönelmez.

Örnek ülke görseli yükleme:

```bash
export NOW_ROUTE_ID="mediterranean-gateway"
export NOW_COUNTRY_ID="turkey"
export NOW_IMAGE_FILE="/tam/yol/turkey.webp"
export NOW_IMAGE_HASH="$(shasum -a 256 "$NOW_IMAGE_FILE" | cut -c1-10)"

npx wrangler r2 object put \
  "numbers-of-wonders-assets/word-journey/v2/countries/$NOW_ROUTE_ID/$NOW_COUNTRY_ID-$NOW_IMAGE_HASH.webp" \
  --file "$NOW_IMAGE_FILE" \
  --content-type image/webp \
  --cache-control "public, max-age=31536000, immutable" \
  --remote
```

Rota kapağı için ülke kimliği yerine `main` kullanılır.

Manifesti indirip yeniden yükleme:

```bash
npx wrangler r2 object get \
  numbers-of-wonders-assets/word-journey/v2/manifest.json \
  --file /tmp/numbers-of-wonders-manifest.json \
  --remote

# /tmp/numbers-of-wonders-manifest.json içindeki path ve version alanlarını düzenle.

npx wrangler r2 object put \
  numbers-of-wonders-assets/word-journey/v2/manifest.json \
  --file /tmp/numbers-of-wonders-manifest.json \
  --content-type "application/json; charset=utf-8" \
  --cache-control "no-store, max-age=0, must-revalidate" \
  --remote
```

Manifest örneği:

```json
{
  "version": "catalog-20260902-120000",
  "prefix": "word-journey/v2",
  "images": [
    {
      "key": "mediterranean-gateway/main",
      "path": "countries/mediterranean-gateway/main-a1b2c3d4e5.webp"
    },
    {
      "key": "mediterranean-gateway/turkey",
      "path": "countries/mediterranean-gateway/turkey-f6e7d8c9b0.webp"
    }
  ]
}
```

`source` alanı kullanılmaz. Aynı hash'li nesnenin üzerine yeni içerik yazma; yeni
görsel için yeni hash'li yol oluştur. Eski nesneyi ancak yeni manifest doğrulandıktan
sonra sil.

## Worker dağıtımı

```bash
npm run cloudflare:types-assets
npm run cloudflare:deploy-assets
```

Worker şu adresleri sunar:

```text
/word-journey/v2/manifest.json
/word-journey/v2/countries/<route-id>/<hashli-dosya>.webp
/word-journey/v2/by-key/<route-id>/<country-id>
/word-journey/v2/by-key/<route-id>/main
```

`by-key` adresleri uygulamanın ilk manifest isteği tamamlanana kadar güvenli geri
dönüş sağlar. Normal kullanımda uygulama manifestteki hash'li URL'lere geçer.

## Uygulamaya yansıma

Uygulama manifesti:

- ilk açılışta,
- arka plandan tekrar öne geldiğinde,
- uygulama açıkken her 30 saniyede

kontrol eder. Manifest `version` ve hash'li `path` değiştiğinde yeni görsel URL'si
hemen kullanılır ve görsel kalıcı disk cache'e indirilir. Ağ yoksa son başarılı
manifest ve daha önce indirilmiş görseller kullanılmaya devam eder.

## Doğrulama

```bash
curl -I \
  https://numbers-of-wonders-assets.storycolor-cdn.workers.dev/word-journey/v2/manifest.json

curl -I \
  https://numbers-of-wonders-assets.storycolor-cdn.workers.dev/word-journey/v2/by-key/mediterranean-gateway/turkey
```

Manifest yanıtı `200`, `cache-control: no-store` ve bir `etag` içermelidir.
`by-key` yanıtı `200` ve `content-type: image/webp` döndürmelidir.

## Geri alma

Önceki hash'li nesneleri hemen silmezsen yalnızca eski manifesti yeniden yükleyerek
geri dönebilirsin. R2'den silinen nesneler otomatik geri alınamaz.
