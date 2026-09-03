const DEFAULT_CONTENT_ORIGIN = 'https://numbers-of-wonders-assets.storycolor-cdn.workers.dev';

export type ContentImageManifest = {
  version: string;
  prefix: string;
  images: { key: string; path: string }[];
};

type ContentImageCatalog = {
  version: string;
  pathsByKey: ReadonlyMap<string, string>;
  urls: readonly string[];
};

const CONTENT_IMAGE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;
const CONTENT_IMAGE_PATH_PATTERN = /^countries\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*-[a-f0-9]{10}\.webp$/;
const listeners = new Set<() => void>();

let catalog: ContentImageCatalog = {
  version: 'cloudflare-bootstrap',
  pathsByKey: new Map(),
  urls: [],
};

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, '');
}

function encodeKey(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

export const CONTENT_IMAGE_PREFIX = 'word-journey/v2';
export const CONTENT_IMAGE_ORIGIN = (
  process.env.EXPO_PUBLIC_CONTENT_ORIGIN || DEFAULT_CONTENT_ORIGIN
).replace(/\/+$/, '');

export const CONTENT_IMAGE_MANIFEST_URL =
  `${CONTENT_IMAGE_ORIGIN}/${CONTENT_IMAGE_PREFIX}/manifest.json`;

export function contentImageUrl(path: string) {
  return `${CONTENT_IMAGE_ORIGIN}/${CONTENT_IMAGE_PREFIX}/${trimSlashes(path)}`;
}

function contentImageKeyUrl(key: string) {
  return `${CONTENT_IMAGE_ORIGIN}/${CONTENT_IMAGE_PREFIX}/by-key/${encodeKey(key)}`;
}

function contentImageUrlForKey(key: string) {
  const path = catalog.pathsByKey.get(key);
  return path ? contentImageUrl(path) : contentImageKeyUrl(key);
}

export function routeContentImageUrl(routeId: string) {
  return contentImageUrlForKey(`${routeId}/main`);
}

export function countryContentImageUrl(routeId: string, countryId: string) {
  return contentImageUrlForKey(`${routeId}/${countryId}`);
}

export function getContentImageVersion() {
  return catalog.version;
}

export function getContentImageUrls() {
  return catalog.urls;
}

export function subscribeContentImages(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyContentImageManifest(value: unknown): ContentImageManifest | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<ContentImageManifest>;
  if (
    typeof candidate.version !== 'string' ||
    candidate.version.length === 0 ||
    candidate.prefix !== CONTENT_IMAGE_PREFIX ||
    !Array.isArray(candidate.images)
  ) {
    return null;
  }

  const images: ContentImageManifest['images'] = [];
  const pathsByKey = new Map<string, string>();

  for (const image of candidate.images) {
    if (!image || typeof image !== 'object') return null;
    const { key, path } = image as { key?: unknown; path?: unknown };
    if (
      typeof key !== 'string' ||
      typeof path !== 'string' ||
      !CONTENT_IMAGE_KEY_PATTERN.test(key) ||
      !CONTENT_IMAGE_PATH_PATTERN.test(path) ||
      pathsByKey.has(key)
    ) {
      return null;
    }
    pathsByKey.set(key, path);
    images.push({ key, path });
  }

  if (images.length === 0) return null;

  const manifest = {
    version: candidate.version,
    prefix: CONTENT_IMAGE_PREFIX,
    images,
  };
  const changed = catalog.version !== manifest.version;
  catalog = {
    version: manifest.version,
    pathsByKey,
    urls: images.map((image) => contentImageUrl(image.path)),
  };

  if (changed) listeners.forEach((listener) => listener());
  return manifest;
}
