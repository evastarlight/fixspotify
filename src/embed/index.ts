import { NotFoundError } from "../shared/errors";
import {
  type AlbumSummary,
  type Artist,
  type CatalogDeps,
  formatArtists,
  formatCount,
  formatDuration,
  getAlbumSummary,
  getArtist,
  getPlaylist,
  getPlaylistTracks,
  getTrackSummary,
  type Playlist,
  type PlaylistTrack,
  type TrackSummary,
} from "../spotify";
import { renderTemplate } from "./render";
import albumTemplate from "./templates/album.html";
import artistTemplate from "./templates/artist.html";
import playlistTemplate from "./templates/playlist.html";
import playlistHead from "./templates/playlist-head.html";
import sharedHead from "./templates/shared-head.html";
import trackTemplate from "./templates/track.html";

export const EMBED_KINDS = ["track", "album", "artist", "playlist"] as const;
export type EmbedKind = (typeof EMBED_KINDS)[number];

export function isEmbedKind(value: string): value is EmbedKind {
  return (EMBED_KINDS as readonly string[]).includes(value);
}

export interface EmbedData {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly artistId: string;
  readonly image: string;
  readonly url: string;
  readonly description: string;
}

const ALBUM_TRACK_PREVIEW = 10;
const PLAYLIST_TRACK_PREVIEW = 5;

const scdnImage = (id: string): string => `https://i.scdn.co/image/${id}`;

export function trackEmbed(t: TrackSummary): EmbedData {
  return {
    id: t.id,
    title: t.name,
    subtitle: t.artists,
    artistId: t.primaryArtistId,
    image: scdnImage(t.albumArtId),
    url: t.url,
    description: [
      `By ${t.artists} • ${t.duration}`,
      t.totalTracks === 1
        ? `On ${t.album} (Single)`
        : `Track ${t.trackNumber} of ${t.totalTracks} on ${t.album}`,
      `Released ${t.releaseDate}`,
    ].join("\n"),
  };
}

export function albumEmbed(a: AlbumSummary): EmbedData {
  const hidden = a.tracks.length - ALBUM_TRACK_PREVIEW;
  return {
    id: a.id,
    title: a.name,
    subtitle: a.artists,
    artistId: a.primaryArtistId,
    image: a.imageUrl,
    url: a.url,
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

export function playlistEmbed(p: Playlist, tracks: readonly PlaylistTrack[]): EmbedData {
  const owner = p.owner.display_name ?? "";
  const hidden = p.tracks.total - PLAYLIST_TRACK_PREVIEW;
  return {
    id: p.id,
    title: p.name,
    subtitle: owner,
    artistId: "",
    image: p.images?.[0]?.url ?? "",
    url: p.external_urls.spotify,
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

export function artistEmbed(a: Artist): EmbedData {
  const genres = a.genres.join(", ");
  return {
    id: a.id,
    title: a.name,
    subtitle: genres,
    artistId: a.id,
    image: a.images[0]?.url ?? "",
    url: a.external_urls.spotify,
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
    default: {
      const exhaustive: never = kind;
      throw new Error(`unhandled embed kind: ${String(exhaustive)}`);
    }
  }
}

const TEMPLATES: Readonly<Record<EmbedKind, string>> = {
  track: trackTemplate,
  album: albumTemplate,
  artist: artistTemplate,
  playlist: playlistTemplate,
};

export function renderEmbed(kind: EmbedKind, data: EmbedData, openOrigin: string): string {
  return renderTemplate(TEMPLATES[kind], {
    partials: { sharedHead, playlistHead },
    data: {
      name: kind,
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
