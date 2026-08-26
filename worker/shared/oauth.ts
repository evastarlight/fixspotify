import { z } from "zod";
import { UpstreamError } from "./errors";

const TokenResponse = z.object({ access_token: z.string(), expires_in: z.number() });
const StoredToken = z.object({ token: z.string(), expiresAt: z.number() });
type StoredToken = z.infer<typeof StoredToken>;

const STALE_MARGIN_MS = 30_000;
const TIMEOUT_MS = 8_000;

export interface ClientCredentials {
  readonly service: string;
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

// memo first, kv second
const memo = new Map<string, StoredToken>();

const kvKey = (service: string): string => `token:${service}`;

export async function clientCredentialsToken(
  kv: KVNamespace,
  creds: ClientCredentials,
): Promise<string> {
  const now = Date.now();
  const key = kvKey(creds.service);
  const isFresh = (t: StoredToken | undefined): t is StoredToken =>
    t !== undefined && t.expiresAt - now > STALE_MARGIN_MS;

  const remembered = memo.get(key);
  if (isFresh(remembered)) return remembered.token;

  const stored = StoredToken.safeParse(await kv.get(key, "json"));
  if (stored.success && isFresh(stored.data)) {
    memo.set(key, stored.data);
    return stored.data.token;
  }

  const res = await fetch(creds.tokenUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${creds.clientId}:${creds.clientSecret}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new UpstreamError(creds.service, res.status);

  const body = TokenResponse.parse(await res.json());
  const token: StoredToken = { token: body.access_token, expiresAt: now + body.expires_in * 1000 };
  memo.set(key, token);
  // kv min ttl is 60, and a failed write shouldnt fail the request
  await kv
    .put(key, JSON.stringify(token), { expirationTtl: Math.max(60, body.expires_in - 60) })
    .catch((err: unknown) => {
      console.error("token cache write failed", { service: creds.service, err });
    });
  return token.token;
}

export async function invalidateToken(kv: KVNamespace, service: string): Promise<void> {
  memo.delete(kvKey(service));
  await kv.delete(kvKey(service));
}
