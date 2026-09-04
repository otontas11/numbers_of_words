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
const BOOTSTRAP_NETWORK_TIMEOUT_MS = 6_000;
const BOOTSTRAP_MINIMUM_VISIBLE_MS = 800;
const BOOTSTRAP_COMPLETE_HOLD_MS = 220;

let manifestEtag: string | null = null;
let refreshPromise: Promise<void> | null = null;
let bootstrapPromise: Promise<void> | null = null;

type ContentImageBootstrapState = {
  progress: number;
  ready: boolean;
};

let bootstrapState: ContentImageBootstrapState = { progress: 0.06, ready: false };
const bootstrapListeners = new Set<() => void>();

function updateBootstrapState(next: ContentImageBootstrapState) {
  bootstrapState = next;
  bootstrapListeners.forEach((listener) => listener());
}

function subscribeBootstrap(listener: () => void) {
  bootstrapListeners.add(listener);
  return () => bootstrapListeners.delete(listener);
}

function getBootstrapState() {
  return bootstrapState;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

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

async function bootstrapContentImages() {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const startedAt = Date.now();
    updateBootstrapState({ progress: 0.14, ready: false });

    await hydrateStoredManifest().catch(async () => {
      await AsyncStorage.removeItem(MANIFEST_STORAGE_KEY).catch(() => undefined);
    });
    updateBootstrapState({ progress: 0.38, ready: false });

    await Promise.race([
      refreshRemoteManifest().catch(() => undefined),
      wait(BOOTSTRAP_NETWORK_TIMEOUT_MS),
    ]);
    updateBootstrapState({ progress: 0.88, ready: false });

    const remainingMinimumTime = BOOTSTRAP_MINIMUM_VISIBLE_MS - (Date.now() - startedAt);
    if (remainingMinimumTime > 0) await wait(remainingMinimumTime);

    updateBootstrapState({ progress: 1, ready: false });
    await wait(BOOTSTRAP_COMPLETE_HOLD_MS);
    updateBootstrapState({ progress: 1, ready: true });
  })();

  return bootstrapPromise;
}

/**
 * Açılışta kayıtlı manifesti yükler ve Cloudflare manifestini yeniler.
 * Görsel indirmeleri disk önbelleğine arka planda devam eder.
 */
export function useContentImageCache() {
  const bootstrap = useContentImageBootstrap();

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!active) return;
      void refreshRemoteManifest().catch(() => {
        // Çevrimdışı kullanımda son başarılı manifest ve disk cache kullanılmaya devam eder.
      });
    };

    void bootstrapContentImages();

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

  return bootstrap;
}

/** İlk Cloudflare manifest hazırlığının splash ekranında gösterilen durumu. */
export function useContentImageBootstrap() {
  return useSyncExternalStore(subscribeBootstrap, getBootstrapState, getBootstrapState);
}

/** Cloudflare manifesti değiştiğinde içerik kullanan ekranları yeniden render eder. */
export function useContentImageVersion() {
  return useSyncExternalStore(
    subscribeContentImages,
    getContentImageVersion,
    getContentImageVersion,
  );
}
