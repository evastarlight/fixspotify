import { DurableObject } from "cloudflare:workers";
import { z } from "zod";

export const STAT_TYPES = ["track", "album", "artist", "playlist"] as const;
export type StatType = (typeof STAT_TYPES)[number];

const CountsSchema = z.object({
  total: z.number(),
  track: z.number(),
  album: z.number(),
  artist: z.number(),
  playlist: z.number(),
});
const RecentRequestSchema = z.object({
  addedAt: z.number(),
  type: z.enum(STAT_TYPES),
  name: z.string(),
  description: z.string(),
  image: z.string(),
  url: z.string(),
});
const StoredSchema = z.object({ counts: CountsSchema, recent: z.array(RecentRequestSchema) });

export type Counts = z.infer<typeof CountsSchema>;
export type RecentRequest = z.infer<typeof RecentRequestSchema>;
type Stored = z.infer<typeof StoredSchema>;

export interface StatsSnapshot {
  readonly counts: Counts;
  readonly lastRequests: readonly RecentRequest[];
}

const FLUSH_MS = 10_000;
const RECENT_LIMIT = 3;
const STORAGE_KEY = "state";
const GLOBAL_NAME = "global";

const emptyStored = (): Stored => ({
  counts: { total: 0, track: 0, album: 0, artist: 0, playlist: 0 },
  recent: [],
});

export class Stats extends DurableObject<Env> {
  private stored: Stored = emptyStored();
  private dirty = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // blocks rpc until loaded
    void ctx.blockConcurrencyWhile(async () => {
      const parsed = StoredSchema.safeParse(await ctx.storage.get(STORAGE_KEY));
      if (parsed.success) this.stored = parsed.data;
    });
  }

  async record(entry: RecentRequest, weight: number): Promise<void> {
    this.stored.counts[entry.type] += weight;
    this.stored.counts.total += weight;
    if (!this.stored.recent.some((r) => r.url === entry.url)) {
      this.stored.recent = [entry, ...this.stored.recent].slice(0, RECENT_LIMIT);
    }
    this.dirty = true;
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + FLUSH_MS);
    }
  }

  async snapshot(since = 0): Promise<StatsSnapshot> {
    const c = this.stored.counts;
    return {
      counts: {
        total: Math.round(c.total),
        track: Math.round(c.track),
        album: Math.round(c.album),
        artist: Math.round(c.artist),
        playlist: Math.round(c.playlist),
      },
      lastRequests: this.stored.recent.filter((r) => r.addedAt >= since),
    };
  }

  override async alarm(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    await this.ctx.storage.put(STORAGE_KEY, this.stored);
  }
}

const globalStats = (env: Env): DurableObjectStub<Stats> =>
  env.STATS.get(env.STATS.idFromName(GLOBAL_NAME));

export function recordStat(
  env: Env,
  ctx: ExecutionContext,
  sampleRate: number,
  entry: RecentRequest,
): void {
  if (sampleRate <= 0) return;
  if (sampleRate < 1 && Math.random() >= sampleRate) return;
  ctx.waitUntil(
    globalStats(env)
      .record(entry, 1 / sampleRate)
      .catch((err: unknown) => {
        console.error("stats record failed", err);
      }),
  );
}

export function statsSnapshot(env: Env, since: number): Promise<StatsSnapshot> {
  return globalStats(env).snapshot(since);
}
