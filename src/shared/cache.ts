// fake origin, cache keys on urls
const CACHE_ORIGIN = "https://cache.fixspotify.internal";

export interface CachedOptions<T> {
  readonly key: string;
  readonly ttlSeconds: number;
  readonly ctx: ExecutionContext;
  readonly load: () => Promise<T | undefined>;
  readonly cache?: Cache | undefined;
}

// keys can hold search queries, a ? or # in one would split the url
const keyRequest = (key: string): Request =>
  new Request(`${CACHE_ORIGIN}/${encodeURIComponent(key)}`);

export interface SeenOptions {
  readonly key: string;
  readonly ttlSeconds: number;
  readonly ctx: ExecutionContext;
  readonly cache?: Cache | undefined;
}

// true if the key was marked within the ttl, marks it otherwise
export async function seenBefore(opts: SeenOptions): Promise<boolean> {
  const cache = opts.cache ?? caches.default;
  const request = keyRequest(opts.key);
  if (await cache.match(request)) return true;
  const marker = new Response("1", { headers: { "cache-control": `max-age=${opts.ttlSeconds}` } });
  opts.ctx.waitUntil(
    cache.put(request, marker).catch((err: unknown) => {
      console.error("cache mark failed", { key: opts.key, err });
    }),
  );
  return false;
}

export async function cached<T>(opts: CachedOptions<T>): Promise<T | undefined> {
  const cache = opts.cache ?? caches.default;
  const request = keyRequest(opts.key);

  const hit = await cache.match(request);
  if (hit) return (await hit.json()) as T;

  const value = await opts.load();
  if (value === undefined) return undefined;

  const stored = new Response(JSON.stringify(value), {
    headers: {
      "cache-control": `max-age=${opts.ttlSeconds}`,
      "content-type": "application/json",
    },
  });
  opts.ctx.waitUntil(
    cache.put(request, stored).catch((err: unknown) => {
      console.error("cache put failed", { key: opts.key, err });
    }),
  );
  return value;
}
