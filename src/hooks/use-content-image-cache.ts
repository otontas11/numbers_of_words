import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import {
  applyContentImageManifest,
  CONTENT_IMAGE_MANIFEST_URL,
  getContentImageUrls,
  getContentImageVersion,
  subscribeContentImages,
} from '@/constants/content-images';

const DOWNLOAD_CONCURRENCY = 3;
const MANIFEST_STORAGE_KEY = 'numbers-of-wonders:content-manifest:v2';
const MANIFEST_REFRESH_INTERVAL_MS = 30_000;

let manifestEtag: string | null = null;
let refreshPromise: Promise<void> | null = null;

async function cacheMissingImages(urls: readonly string[]) {
  if (Platform.OS === 'web') return;

  const cacheChecks = await Promise.all(
    urls.map(async (url) => ({
      url,
      cachePath: await Image.getCachePathAsync(url).catch(() => null),
    }))
  );
  const missingUrls = cacheChecks.filter(({ cachePath }) => !cachePath).map(({ url }) => url);

  for (let index = 0; index < missingUrls.length; index += DOWNLOAD_CONCURRENCY) {
    const batch = missingUrls.slice(index, index + DOWNLOAD_CONCURRENCY);
    await Promise.allSettled(
      batch.map((url) => Image.prefetch(url, { cachePolicy: 'disk' }))
    );
  }
}

async function applyAndCacheManifest(value: unknown, persist: boolean) {
  const manifest = applyContentImageManifest(value);
  if (!manifest) throw new Error('Cloudflare içerik manifesti geçersiz.');

  if (persist) {
    await AsyncStorage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(manifest));
  }
  void cacheMissingImages(getContentImageUrls());
}

async function hydrateStoredManifest() {
  const stored = await AsyncStorage.getItem(MANIFEST_STORAGE_KEY);
  if (!stored) return;
  await applyAndCacheManifest(JSON.parse(stored), false);
}

async function refreshRemoteManifest() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const response = await fetch(CONTENT_IMAGE_MANIFEST_URL, {
      cache: 'no-store',
      headers: manifestEtag ? { 'if-none-match': manifestEtag } : undefined,
    });
    if (response.status === 304) return;
    if (!response.ok) throw new Error(`Cloudflare manifest HTTP ${response.status}`);

    manifestEtag = response.headers.get('etag');
    await applyAndCacheManifest(await response.json(), true);
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Uygulama açılır açılmaz içerik görsellerini arka planda kalıcı disk önbelleğine alır.
 * Arayüzü bekletmez; başarısız veya silinmiş dosyalar sonraki açılışta yeniden denenir.
 */
export function useContentImageCache() {
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!active) return;
      void refreshRemoteManifest().catch(() => {
        // Çevrimdışı kullanımda son başarılı manifest ve disk cache kullanılmaya devam eder.
      });
    };

    void hydrateStoredManifest()
      .catch(() => AsyncStorage.removeItem(MANIFEST_STORAGE_KEY))
      .finally(refresh);

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const interval = setInterval(refresh, MANIFEST_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, []);
}

/** Cloudflare manifesti değiştiğinde içerik kullanan ekranları yeniden render eder. */
export function useContentImageVersion() {
  return useSyncExternalStore(
    subscribeContentImages,
    getContentImageVersion,
    getContentImageVersion,
  );
}
