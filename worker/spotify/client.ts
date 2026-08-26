import { z } from "zod";
import { BadRequestError, UpstreamError } from "../shared/errors";
import { clientCredentialsToken, invalidateToken } from "../shared/oauth";

const API_ORIGIN = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const TIMEOUT_MS = 8_000;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

export function parseSpotifyId(raw: string): string {
  if (!SPOTIFY_ID.test(raw)) throw new BadRequestError(`invalid spotify id: ${raw}`);
  return raw;
}

const ExternalUrls = z.object({ spotify: z.string() });
const Image = z.object({ url: z.string() });
// local files have artists with no id
const ArtistRef = z.object({ id: z.string().nullable(), name: z.string() });
const ReleaseDatePrecision = z.enum(["year", "month", "day"]);

export const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(ArtistRef),
  duration_ms: z.number(),
  track_number: z.number(),
  album: z.object({
    name: z.string(),
    images: z.array(Image),
    release_date: z.string(),
    release_date_precision: ReleaseDatePrecision,
    total_tracks: z.number(),
  }),
  external_urls: ExternalUrls,
});

export const AlbumSchema = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(ArtistRef),
  images: z.array(Image),
  release_date: z.string(),
  release_date_precision: ReleaseDatePrecision,
  total_tracks: z.number(),
  genres: z.array(z.string()).default([]),
  external_urls: ExternalUrls,
  tracks: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        artists: z.array(ArtistRef),
        duration_ms: z.number(),
      }),
    ),
  }),
});

export const ArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  genres: z.array(z.string()).default([]),
  images: z.array(Image).default([]),
  followers: z.object({ total: z.number() }),
  popularity: z.number(),
  external_urls: ExternalUrls,
});

export const PlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  owner: z.object({ display_name: z.string().nullable().optional() }),
  images: z.array(Image).nullable(),
  tracks: z.object({ total: z.number() }),
  external_urls: ExternalUrls,
});

const PlaylistTrack = z.object({
  type: z.literal("track"),
  // local files have no id
  id: z.string().nullable(),
  name: z.string(),
  artists: z.array(ArtistRef),
  duration_ms: z.number(),
});
const PlaylistItemsSchema = z.object({
  items: z.array(
    z.object({
      track: z
        .discriminatedUnion("type", [PlaylistTrack, z.object({ type: z.literal("episode") })])
        .nullable(),
    }),
  ),
});

export type Track = z.infer<typeof TrackSchema>;
export type Album = z.infer<typeof AlbumSchema>;
export type Artist = z.infer<typeof ArtistSchema>;
export type Playlist = z.infer<typeof PlaylistSchema>;
export type PlaylistTrack = z.infer<typeof PlaylistTrack> & { readonly id: string };

export interface SpotifyClient {
  track(id: string): Promise<Track | undefined>;
  album(id: string): Promise<Album | undefined>;
  artist(id: string): Promise<Artist | undefined>;
  playlist(id: string): Promise<Playlist | undefined>;
  playlistTracks(id: string, limit: number): Promise<readonly PlaylistTrack[]>;
}

export interface SpotifyClientDeps {
  readonly kv: KVNamespace;
  readonly clientId: string;
  readonly clientSecret: string;
}

export function createSpotifyClient(deps: SpotifyClientDeps): SpotifyClient {
  const creds = {
    service: "spotify",
    tokenUrl: TOKEN_URL,
    clientId: deps.clientId,
    clientSecret: deps.clientSecret,
  };

  async function get<T>(path: string, schema: z.ZodType<T>): Promise<T | undefined> {
    for (let attempt = 0; ; attempt++) {
      const token = await clientCredentialsToken(deps.kv, creds);
      const res = await fetch(`${API_ORIGIN}/${path}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 404) return undefined;
      if (res.status === 401 && attempt === 0) {
        await invalidateToken(deps.kv, creds.service);
        continue;
      }
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after"));
        throw new UpstreamError("spotify", 429, retryAfter > 0 ? retryAfter : undefined);
      }
      if (!res.ok) throw new UpstreamError("spotify", res.status);
      return schema.parse(await res.json());
    }
  }

  return {
    track: (id) => get(`tracks/${id}`, TrackSchema),
    album: (id) => get(`albums/${id}`, AlbumSchema),
    artist: (id) => get(`artists/${id}`, ArtistSchema),
    playlist: (id) => get(`playlists/${id}`, PlaylistSchema),
    async playlistTracks(id, limit) {
      const page = await get(`playlists/${id}/tracks?limit=${limit}`, PlaylistItemsSchema);
      if (!page) return [];
      return page.items.flatMap(({ track }) =>
        track?.type === "track" && track.id !== null ? [{ ...track, id: track.id }] : [],
      );
    },
  };
}
