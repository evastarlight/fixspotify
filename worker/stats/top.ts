export const TOP_TYPES = ["track", "album", "artist"] as const;
export type TopType = (typeof TOP_TYPES)[number];

export const RANGES = ["7d", "30d", "all"] as const;
export type Range = (typeof RANGES)[number];

export interface TopQuery {
  readonly type: TopType;
  readonly range: Range;
  readonly limit: number;
}

export interface TopEntry {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly image: string;
  readonly count: number;
}

const DAY_MS = 86_400_000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export const dayOf = (ms: number): number => Math.floor(ms / DAY_MS);

export function sinceDay(range: Range, now: number): number {
  switch (range) {
    case "7d":
      return dayOf(now) - 6;
    case "30d":
      return dayOf(now) - 29;
    case "all":
      return 0;
  }
}

const isTopType = (v: string): v is TopType => (TOP_TYPES as readonly string[]).includes(v);
const isRange = (v: string): v is Range => (RANGES as readonly string[]).includes(v);

export function parseTopQuery(q: URLSearchParams): TopQuery | undefined {
  const type = q.get("type") ?? "track";
  const range = q.get("range") ?? "7d";
  if (!isTopType(type) || !isRange(range)) return undefined;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.trunc(Number(q.get("limit")) || DEFAULT_LIMIT)),
  );
  return { type, range, limit };
}
