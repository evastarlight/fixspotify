const OG_URL = /<meta\s+property="og:url"\s+content="([^"]+)"/;
const TIMEOUT_MS = 8_000;

export function extractOgUrl(html: string): string | undefined {
  return OG_URL.exec(html)?.[1];
}

export async function unwrapSpotifyLink(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<URL | undefined> {
  const res = await fetchImpl(`https://spotify.app.link/${encodeURIComponent(token)}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return undefined;

  const landed = new URL(res.url);
  if (landed.hostname === "open.spotify.com") return landed;

  const og = extractOgUrl(await res.text());
  if (og === undefined) return undefined;
  const target = new URL(og);
  return target.hostname === "open.spotify.com" ? target : undefined;
}
