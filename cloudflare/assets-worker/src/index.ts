const CONTENT_PREFIX = 'word-journey/v2/';
const MANIFEST_KEY = `${CONTENT_PREFIX}manifest.json`;
const BY_KEY_PREFIX = `${CONTENT_PREFIX}by-key/`;

type ContentManifest = {
  images: { key: string; path: string }[];
};

function objectHeaders(object: R2Object, cacheControl?: string) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('content-length', String(object.size));
  headers.set(
    'cache-control',
    cacheControl || headers.get('cache-control') || 'public, max-age=31536000, immutable',
  );
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');
  return headers;
}

async function resolveContentKey(env: Env, requestedKey: string) {
  if (!requestedKey.startsWith(BY_KEY_PREFIX)) return requestedKey;

  const contentKey = requestedKey.slice(BY_KEY_PREFIX.length);
  if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(contentKey)) return null;

  const manifestObject = await env.ASSETS.get(MANIFEST_KEY);
  if (!manifestObject) return null;
  const manifest = await manifestObject.json<ContentManifest>();
  const image = manifest.images.find((candidate) => candidate.key === contentKey);
  return image ? `${CONTENT_PREFIX}${image.path}` : null;
}

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: { 'cache-control': 'public, max-age=60' },
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-methods': 'GET, HEAD, OPTIONS',
          'access-control-allow-origin': '*',
          'access-control-max-age': '86400',
        },
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { allow: 'GET, HEAD, OPTIONS' },
      });
    }

    const requestedKey = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ''));
    if (!requestedKey.startsWith(CONTENT_PREFIX)) return notFound();

    const key = await resolveContentKey(env, requestedKey);
    if (!key) return notFound();
    const isManifest = key === MANIFEST_KEY;
    const isAlias = requestedKey !== key;
    const cacheControl = isManifest
      ? 'no-store, max-age=0, must-revalidate'
      : isAlias
        ? 'no-store, max-age=0'
        : undefined;

    if (request.method === 'HEAD') {
      const object = await env.ASSETS.head(key);
      if (!object) return notFound();
      const headers = objectHeaders(object, cacheControl);
      if (isManifest && request.headers.get('if-none-match') === object.httpEtag) {
        headers.delete('content-length');
        return new Response(null, { status: 304, headers });
      }
      return new Response(null, { headers });
    }

    const object = await env.ASSETS.get(key);
    if (!object) return notFound();
    const headers = objectHeaders(object, cacheControl);
    if (isManifest && request.headers.get('if-none-match') === object.httpEtag) {
      headers.delete('content-length');
      return new Response(null, { status: 304, headers });
    }
    return new Response(object.body, { headers });
  },
} satisfies ExportedHandler<Env>;
