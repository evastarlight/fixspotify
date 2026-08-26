// fake origin, cache keys on urls
const CACHE_ORIGIN = "https://cache.fixspotify.internal";

// keys can hold search queries, a ? or # in one would split the url
const keyRequest = (key: string): Request =>
  new Request(`${CACHE_ORIGIN}/${encodeURIComponent(key)}`);

export interface SeenOptions {
  readonly key: string;
  readonly ttlSeconds: number;
  readonly ctx: ExecutionContext;
}

// true if the key was marked within the ttl, marks it otherwise
export async function seenBefore(opts: SeenOptions): Promise<boolean> {
  const request = keyRequest(opts.key);
  if (await caches.default.match(request)) return true;
  const marker = new Response("1", { headers: { "cache-control": `max-age=${opts.ttlSeconds}` } });
  opts.ctx.waitUntil(
    caches.default.put(request, marker).catch((err: unknown) => {
      console.error("cache mark failed", { key: opts.key, err });
    }),
  );
  return false;
}

export interface CachedOptions<T> {
  readonly key: string;
  readonly ttlSeconds: number;
  readonly ctx: ExecutionContext;
  readonly load: () => Promise<T | undefined>;
}

export async function cached<T>(opts: CachedOptions<T>): Promise<T | undefined> {
  const request = keyRequest(opts.key);

  const hit = await caches.default.match(request);
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
    caches.default.put(request, stored).catch((err: unknown) => {
      console.error("cache put failed", { key: opts.key, err });
    }),
  );
  return value;
}
