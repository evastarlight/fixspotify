import { BadRequestError } from "../shared/errors";

export {
  type AlbumSummary,
  type AlbumTrackSummary,
  type CatalogDeps,
  getAlbumSummary,
  getArtist,
  getPlaylist,
  getPlaylistTracks,
  getTrackSummary,
  imageId,
  type TrackSummary,
} from "./catalog";
export {
  type Album,
  type Artist,
  createSpotifyClient,
  type Playlist,
  type PlaylistTrack,
  type SpotifyClient,
  type Track,
} from "./client";
export { formatArtists, formatCount, formatDuration } from "./format";

export type SpotifyId = string & { readonly __brand: "SpotifyId" };

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

export function parseSpotifyId(raw: string): SpotifyId {
  if (!SPOTIFY_ID.test(raw)) throw new BadRequestError(`invalid spotify id: ${raw}`);
  return raw as SpotifyId;
}
