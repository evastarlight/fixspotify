import { seenBefore } from "../shared/cache";
import type { StatType } from "./index";

// one counted hit per ip per item per hour
const DEDUPE_TTL_SECONDS = 3_600;
const DAY_MS = 86_400_000;

// the salt rotates daily so the marker keys cant be joined across days
export const dailySalt = (now: number): string => String(Math.floor(now / DAY_MS));

export async function hashIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest).slice(0, 16)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface CountDeps {
  readonly ip: string;
  readonly type: StatType;
  readonly id: string;
  readonly ctx: ExecutionContext;
  readonly limiter: RateLimit;
  readonly now?: (() => number) | undefined;
  readonly cache?: Cache | undefined;
}

// over the burst limit or seen this hour -> serve the embed but dont count it
export async function shouldCount(deps: CountDeps): Promise<boolean> {
  if (deps.ip === "") return true;
  const { success } = await deps.limiter.limit({ key: deps.ip });
  if (!success) return false;
  const now = (deps.now ?? Date.now)();
  const who = await hashIp(deps.ip, dailySalt(now));
  return !(await seenBefore({
    key: `hit/${who}/${deps.type}/${deps.id}`,
    ttlSeconds: DEDUPE_TTL_SECONDS,
    ctx: deps.ctx,
    cache: deps.cache,
  }));
}
