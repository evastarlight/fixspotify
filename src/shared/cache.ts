// fake origin, cache keys on urls
const CACHE_ORIGIN = "https://cache.fixspotify.internal";

export interface CachedOptions<T> {
  readonly key: string;
  readonly ttlSeconds: number;
  readonly ctx: ExecutionContext;
  readonly load: () => Promise<T | undefined>;
  readonly cache?: Cache | undefined;
}

export async function cached<T>(opts: CachedOptions<T>): Promise<T | undefined> {
  const cache = opts.cache ?? caches.default;
  // keys can hold search queries, a ? or # in one would split the url
  const request = new Request(`${CACHE_ORIGIN}/${encodeURIComponent(opts.key)}`);

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
