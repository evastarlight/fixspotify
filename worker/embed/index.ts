import { NotFoundError } from "../shared/errors";
import {
  type AlbumSummary,
  type CatalogDeps,
  getAlbumSummary,
  getArtist,
  getPlaylist,
  getPlaylistTracks,
  getTrackSummary,
  type TrackSummary,
} from "../spotify/catalog";
import type { Artist, Playlist, PlaylistTrack } from "../spotify/client";
import { formatArtists, formatCount, formatDuration } from "../spotify/format";
import { renderDiscordComponentEmbed } from "./discord";
import { renderTemplate } from "./render";
import albumTemplate from "./templates/album.html";
import artistTemplate from "./templates/artist.html";
import playlistTemplate from "./templates/playlist.html";
import playlistHead from "./templates/playlist-head.html";
import sharedHead from "./templates/shared-head.html";
import trackTemplate from "./templates/track.html";

export const EMBED_KINDS = ["track", "album", "artist", "playlist"] as const;
export type EmbedKind = (typeof EMBED_KINDS)[number];

interface EmbedBaseData {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly artist: string;
  readonly artistId: string;
  readonly image: string;
  readonly url: string;
  readonly description: string;
}

interface TrackEmbedData extends EmbedBaseData {
  readonly kind: "track";
  readonly album: string;
  readonly albumId: string;
  readonly albumType: string;
  readonly duration: string;
  readonly trackNumber: number;
  readonly totalTracks: number;
  readonly releaseDate: string;
}

interface AlbumEmbedData extends EmbedBaseData {
  readonly kind: "album";
  readonly releaseDate: string;
  readonly totalTracks: number;
}

interface ArtistEmbedData extends EmbedBaseData {
  readonly kind: "artist";
  readonly followers: string;
}

interface PlaylistEmbedData extends EmbedBaseData {
  readonly kind: "playlist";
  readonly summary: string;
  readonly totalTracks: number;
}

export type EmbedData = TrackEmbedData | AlbumEmbedData | ArtistEmbedData | PlaylistEmbedData;

const ALBUM_TRACK_PREVIEW = 10;
const PLAYLIST_TRACK_PREVIEW = 5;

const scdnImage = (id: string): string => (id ? `https://i.scdn.co/image/${id}` : "");

export function trackEmbed(t: TrackSummary): TrackEmbedData {
  return {
    kind: "track",
    id: t.id,
    title: t.name,
    subtitle: t.artists,
    artist: t.primaryArtist,
    artistId: t.primaryArtistId,
    image: scdnImage(t.albumArtId),
    url: t.url,
    album: t.album,
    albumId: t.albumId,
    albumType: t.albumType,
    duration: t.duration,
    trackNumber: t.trackNumber,
    totalTracks: t.totalTracks,
    releaseDate: t.releaseDate,
    description: [
      `By ${t.artists} • ${t.duration}`,
      t.albumType === "single" ? "" : `Track ${t.trackNumber} of ${t.totalTracks} on ${t.album}`,
      `Released ${t.releaseDate}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function albumEmbed(a: AlbumSummary): AlbumEmbedData {
  const hidden = Math.max(0, a.totalTracks - ALBUM_TRACK_PREVIEW);
  return {
    kind: "album",
    id: a.id,
    title: a.name,
    subtitle: a.artists,
    artist: a.primaryArtist,
    artistId: a.primaryArtistId,
    image: a.imageUrl,
    url: a.url,
    releaseDate: a.releaseDate,
    totalTracks: a.totalTracks,
    description: [
      `By ${a.artists}`,
      `Released ${a.releaseDate}`,
      `${a.totalTracks} tracks`,
      a.genres,
      ...a.tracks
        .slice(0, ALBUM_TRACK_PREVIEW)
        .map((t, i) => `${i + 1}. ${t.name} • ${t.duration}`),
      "",
      hidden > 0 ? `${hidden} more...` : "",
    ].join("\n"),
  };
}

export function playlistEmbed(p: Playlist, tracks: readonly PlaylistTrack[]): PlaylistEmbedData {
  const owner = p.owner.display_name ?? "";
  const hidden = Math.max(0, p.tracks.total - PLAYLIST_TRACK_PREVIEW);
  return {
    kind: "playlist",
    id: p.id,
    title: p.name,
    subtitle: owner,
    artist: "",
    artistId: "",
    image: p.images?.[0]?.url ?? "",
    url: p.external_urls.spotify,
    summary: p.description ?? "",
    totalTracks: p.tracks.total,
    description: [
      p.description ?? "",
      `By ${owner}`,
      `${p.tracks.total} tracks`,
      "",
      ...tracks.map(
        (t, i) =>
          `${i + 1}. ${t.name} • ${formatArtists(t.artists)} • ${formatDuration(t.duration_ms)}`,
      ),
      "",
      hidden > 0 ? `${hidden} more...` : "",
    ].join("\n"),
  };
}

export function artistEmbed(a: Artist): ArtistEmbedData {
  const genres = a.genres.join(", ");
  return {
    kind: "artist",
    id: a.id,
    title: a.name,
    subtitle: genres,
    artist: a.name,
    artistId: a.id,
    image: a.images[0]?.url ?? "",
    url: a.external_urls.spotify,
    followers: formatCount(a.followers.total),
    description: [
      genres,
      `${formatCount(a.followers.total)} followers`,
      `${a.popularity}% popularity`,
    ].join("\n"),
  };
}

export async function loadEmbed(
  kind: EmbedKind,
  id: string,
  deps: CatalogDeps,
): Promise<EmbedData> {
  switch (kind) {
    case "track": {
      const t = await getTrackSummary(id, deps);
      if (!t) throw new NotFoundError(kind, id);
      return trackEmbed(t);
    }
    case "album": {
      const a = await getAlbumSummary(id, deps);
      if (!a) throw new NotFoundError(kind, id);
      return albumEmbed(a);
    }
    case "artist": {
      const a = await getArtist(id, deps);
      if (!a) throw new NotFoundError(kind, id);
      return artistEmbed(a);
    }
    case "playlist": {
      const [p, tracks] = await Promise.all([
        getPlaylist(id, deps),
        getPlaylistTracks(id, PLAYLIST_TRACK_PREVIEW, deps),
      ]);
      if (!p) throw new NotFoundError(kind, id);
      return playlistEmbed(p, tracks);
    }
  }
}

const TEMPLATES: Readonly<Record<EmbedKind, string>> = {
  track: trackTemplate,
  album: albumTemplate,
  artist: artistTemplate,
  playlist: playlistTemplate,
};

export function renderEmbed(data: EmbedData, openOrigin: string): string {
  return renderTemplate(TEMPLATES[data.kind], {
    partials: { sharedHead, playlistHead },
    rawData: { discordEmbed: renderDiscordComponentEmbed(data, openOrigin) },
    data: {
      name: data.kind,
      id: data.id,
      title: data.title,
      artist: data.subtitle,
      image: data.image,
      url: data.url,
      description: data.description,
      openOrigin,
    },
  });
}
