import { seenBefore } from "../shared/cache";
import type { StatType } from "./index";

// one counted hit per ip per item per hour
const DEDUPE_TTL_SECONDS = 3_600;
const DAY_MS = 86_400_000;

async function hashIp(ip: string): Promise<string> {
  // the salt rotates daily so the marker keys cant be joined across days
  const salt = Math.floor(Date.now() / DAY_MS);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
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
}

// over the burst limit or seen this hour -> serve the embed but dont count it
export async function shouldCount(deps: CountDeps): Promise<boolean> {
  if (deps.ip === "") return true;
  const { success } = await deps.limiter.limit({ key: deps.ip });
  if (!success) return false;
  const key = `hit/${await hashIp(deps.ip)}/${deps.type}/${deps.id}`;
  return !(await seenBefore({ key, ttlSeconds: DEDUPE_TTL_SECONDS, ctx: deps.ctx }));
}
