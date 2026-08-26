import { cached } from "../shared/cache";
import type { Album, Artist, Playlist, PlaylistTrack, SpotifyClient, Track } from "./client";
import { formatArtists, formatDuration, formatReleaseDate } from "./format";

export interface TrackSummary {
  readonly id: string;
  readonly name: string;
  readonly artists: string;
  readonly primaryArtist: string;
  readonly primaryArtistId: string;
  readonly duration: string;
  readonly album: string;
  readonly albumArtId: string;
  readonly totalTracks: number;
  readonly trackNumber: number;
  readonly releaseDate: string;
  readonly url: string;
}

export interface AlbumTrackSummary {
  readonly id: string;
  readonly name: string;
  readonly artists: string;
  readonly primaryArtist: string;
  readonly duration: string;
}

export interface AlbumSummary {
  readonly id: string;
  readonly name: string;
  readonly artists: string;
  readonly primaryArtist: string;
  readonly primaryArtistId: string;
  readonly releaseDate: string;
  readonly totalTracks: number;
  readonly genres: string;
  readonly tracks: readonly AlbumTrackSummary[];
  readonly url: string;
  readonly imageUrl: string;
  readonly images: readonly string[];
}

export function imageId(url: string): string {
  return url.slice(url.lastIndexOf("/") + 1);
}

export function summarizeTrack(t: Track): TrackSummary {
  const cover = t.album.images[0];
  return {
    id: t.id,
    name: t.name,
    artists: formatArtists(t.artists),
    primaryArtist: t.artists[0]?.name ?? "",
    primaryArtistId: t.artists[0]?.id ?? "",
    duration: formatDuration(t.duration_ms),
    album: t.album.name,
    albumArtId: cover ? imageId(cover.url) : "",
    totalTracks: t.album.total_tracks,
    trackNumber: t.track_number,
    releaseDate: formatReleaseDate(t.album.release_date, t.album.release_date_precision),
    url: t.external_urls.spotify,
  };
}

export function summarizeAlbum(a: Album): AlbumSummary {
  return {
    id: a.id,
    name: a.name,
    artists: formatArtists(a.artists),
    primaryArtist: a.artists[0]?.name ?? "",
    primaryArtistId: a.artists[0]?.id ?? "",
    releaseDate: formatReleaseDate(a.release_date, a.release_date_precision),
    totalTracks: a.total_tracks,
    genres: a.genres.join(", "),
    tracks: a.tracks.items.map((t) => ({
      id: t.id,
      name: t.name,
      artists: formatArtists(t.artists),
      primaryArtist: t.artists[0]?.name ?? "",
      duration: formatDuration(t.duration_ms),
    })),
    url: a.external_urls.spotify,
    imageUrl: a.images[0]?.url ?? "",
    images: a.images.map((i) => imageId(i.url)),
  };
}

export interface CatalogDeps {
  readonly spotify: SpotifyClient;
  readonly ctx: ExecutionContext;
}

const CATALOG_TTL_SECONDS = 3_600;
const PLAYLIST_TTL_SECONDS = 300;

const catalogCached = <T>(
  key: string,
  ttlSeconds: number,
  deps: CatalogDeps,
  load: () => Promise<T | undefined>,
): Promise<T | undefined> => cached({ key, ttlSeconds, ctx: deps.ctx, load });

// v2: summaries grew primaryArtistId
export const getTrackSummary = (id: string, deps: CatalogDeps): Promise<TrackSummary | undefined> =>
  catalogCached(`v2/track/${id}`, CATALOG_TTL_SECONDS, deps, async () => {
    const track = await deps.spotify.track(id);
    return track && summarizeTrack(track);
  });

export const getAlbumSummary = (id: string, deps: CatalogDeps): Promise<AlbumSummary | undefined> =>
  catalogCached(`v2/album/${id}`, CATALOG_TTL_SECONDS, deps, async () => {
    const album = await deps.spotify.album(id);
    return album && summarizeAlbum(album);
  });

export const getArtist = (id: string, deps: CatalogDeps): Promise<Artist | undefined> =>
  catalogCached(`artist/${id}`, CATALOG_TTL_SECONDS, deps, () => deps.spotify.artist(id));

export const getPlaylist = (id: string, deps: CatalogDeps): Promise<Playlist | undefined> =>
  catalogCached(`playlist/${id}`, PLAYLIST_TTL_SECONDS, deps, () => deps.spotify.playlist(id));

export const getPlaylistTracks = async (
  id: string,
  limit: number,
  deps: CatalogDeps,
): Promise<readonly PlaylistTrack[]> =>
  (await catalogCached(`playlist/${id}/tracks/${limit}`, PLAYLIST_TTL_SECONDS, deps, () =>
    deps.spotify.playlistTracks(id, limit),
  )) ?? [];
