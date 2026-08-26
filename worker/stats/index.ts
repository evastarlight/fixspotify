import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import { dayOf, type TopEntry, type TopType } from "./top";

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
  id: z.string().default(""),
  artist: z.string().default(""),
  artistId: z.string().default(""),
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

interface PendingHit {
  readonly day: number;
  readonly entry: RecentRequest;
  weight: number;
}

interface TopRow extends Record<string, SqlStorageValue> {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  count: number;
}

const FLUSH_MS = 10_000;
const RECENT_LIMIT = 3;
const STORAGE_KEY = "state";
const GLOBAL_NAME = "global";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS hits (
    day INTEGER NOT NULL,
    type TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    artist TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    image TEXT NOT NULL,
    count REAL NOT NULL,
    PRIMARY KEY (day, type, id)
  );
  CREATE INDEX IF NOT EXISTS hits_type_day ON hits (type, day);
  CREATE INDEX IF NOT EXISTS hits_artist_day ON hits (artist_id, day);
`;

const UPSERT = `
  INSERT INTO hits (day, type, id, name, subtitle, artist, artist_id, image, count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (day, type, id) DO UPDATE SET
    count = count + excluded.count,
    name = excluded.name,
    subtitle = excluded.subtitle,
    artist = excluded.artist,
    artist_id = excluded.artist_id,
    image = excluded.image
`;

const TOP_BY_ID = `
  SELECT id, name, subtitle, image, SUM(count) AS count
  FROM hits WHERE type = ? AND day >= ?
  GROUP BY id ORDER BY count DESC LIMIT ?
`;

// artists come from who's on the tracks and albums, artist embeds are rare
const TOP_ARTISTS = `
  SELECT artist_id AS id, artist AS name, '' AS subtitle, image, SUM(count) AS count
  FROM hits WHERE artist_id != '' AND day >= ?
  GROUP BY artist_id ORDER BY count DESC LIMIT ?
`;

const emptyStored = (): Stored => ({
  counts: { total: 0, track: 0, album: 0, artist: 0, playlist: 0 },
  recent: [],
});

export class Stats extends DurableObject<Env> {
  private stored: Stored = emptyStored();
  private dirty = false;
  private pending = new Map<string, PendingHit>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // blocks rpc until loaded
    void ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(SCHEMA);
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

    if (entry.id !== "") {
      const day = dayOf(entry.addedAt);
      const key = `${day}|${entry.type}|${entry.id}`;
      const hit = this.pending.get(key);
      if (hit) hit.weight += weight;
      else this.pending.set(key, { day, entry, weight });
    }

    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + FLUSH_MS);
    }
  }

  async snapshot(): Promise<StatsSnapshot> {
    const c = this.stored.counts;
    return {
      counts: {
        total: Math.round(c.total),
        track: Math.round(c.track),
        album: Math.round(c.album),
        artist: Math.round(c.artist),
        playlist: Math.round(c.playlist),
      },
      lastRequests: this.stored.recent,
    };
  }

  async top(type: TopType, since: number, limit: number): Promise<TopEntry[]> {
    const rows =
      type === "artist"
        ? this.ctx.storage.sql.exec<TopRow>(TOP_ARTISTS, since, limit).toArray()
        : this.ctx.storage.sql.exec<TopRow>(TOP_BY_ID, type, since, limit).toArray();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      subtitle: r.subtitle,
      image: r.image,
      count: Math.round(r.count),
    }));
  }

  override async alarm(): Promise<void> {
    if (this.dirty) {
      this.dirty = false;
      try {
        await this.ctx.storage.put(STORAGE_KEY, this.stored);
      } catch (err) {
        this.dirty = true;
        throw err;
      }
    }
    if (this.pending.size === 0) return;
    const hits = [...this.pending.values()];
    this.ctx.storage.transactionSync(() => {
      for (const { day, entry, weight } of hits) {
        this.ctx.storage.sql.exec(
          UPSERT,
          day,
          entry.type,
          entry.id,
          entry.name,
          entry.description,
          entry.artist,
          entry.artistId,
          entry.image,
          weight,
        );
      }
    });
    this.pending.clear();
    // anything that landed mid flush gets the next one
    if (this.dirty && (await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + FLUSH_MS);
    }
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

export function statsSnapshot(env: Env): Promise<StatsSnapshot> {
  return globalStats(env).snapshot();
}

export function statsTop(
  env: Env,
  type: TopType,
  since: number,
  limit: number,
): Promise<TopEntry[]> {
  return globalStats(env).top(type, since, limit);
}
