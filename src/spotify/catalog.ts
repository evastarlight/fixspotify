import { cached } from "../shared/cache";
import type { Album, Artist, Playlist, PlaylistTrack, SpotifyClient, Track } from "./client";
import { formatArtists, formatDuration, formatReleaseDate } from "./format";

export interface TrackSummary {
  readonly id: string;
  readonly name: string;
  readonly artists: string;
  readonly primaryArtist: string;
  readonly duration: string;
  readonly album: string;
  readonly albumArtId: string;
  readonly images: readonly string[];
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
  const images = t.album.images.map((i) => imageId(i.url));
  return {
    id: t.id,
    name: t.name,
    artists: formatArtists(t.artists),
    primaryArtist: t.artists[0]?.name ?? "",
    duration: formatDuration(t.duration_ms),
    album: t.album.name,
    albumArtId: images[0] ?? "",
    images,
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

export function getTrackSummary(id: string, deps: CatalogDeps): Promise<TrackSummary | undefined> {
  return cached({
    key: `track/${id}`,
    ttlSeconds: CATALOG_TTL_SECONDS,
    ctx: deps.ctx,
    load: async () => {
      const track = await deps.spotify.track(id);
      return track && summarizeTrack(track);
    },
  });
}

export function getAlbumSummary(id: string, deps: CatalogDeps): Promise<AlbumSummary | undefined> {
  return cached({
    key: `album/${id}`,
    ttlSeconds: CATALOG_TTL_SECONDS,
    ctx: deps.ctx,
    load: async () => {
      const album = await deps.spotify.album(id);
      return album && summarizeAlbum(album);
    },
  });
}

export function getArtist(id: string, deps: CatalogDeps): Promise<Artist | undefined> {
  return cached({
    key: `artist/${id}`,
    ttlSeconds: CATALOG_TTL_SECONDS,
    ctx: deps.ctx,
    load: () => deps.spotify.artist(id),
  });
}

export function getPlaylist(id: string, deps: CatalogDeps): Promise<Playlist | undefined> {
  return cached({
    key: `playlist/${id}`,
    ttlSeconds: PLAYLIST_TTL_SECONDS,
    ctx: deps.ctx,
    load: () => deps.spotify.playlist(id),
  });
}

export function getPlaylistTracks(
  id: string,
  limit: number,
  deps: CatalogDeps,
): Promise<readonly PlaylistTrack[]> {
  return cached({
    key: `playlist/${id}/tracks/${limit}`,
    ttlSeconds: PLAYLIST_TTL_SECONDS,
    ctx: deps.ctx,
    load: () => deps.spotify.playlistTracks(id, limit),
  }).then((tracks) => tracks ?? []);
}
