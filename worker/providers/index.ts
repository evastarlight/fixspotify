import { cached } from "../shared/cache";
import { type CatalogDeps, getAlbumSummary, getArtist, getTrackSummary } from "../spotify/catalog";
import type { TidalClient, TidalKind } from "./tidal";
import { searchYoutube, youtubeUrl } from "./youtube";

export { createTidalClient, type TidalClient } from "./tidal";

export const PROVIDER_TYPES = ["track", "album", "artist", "playlist"] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export function isProviderType(value: string): value is ProviderType {
  return (PROVIDER_TYPES as readonly string[]).includes(value);
}

export type ResolveInput =
  | {
      readonly type: "track" | "album";
      readonly id: string;
      readonly name: string;
      readonly artist: string;
    }
  | { readonly type: "artist"; readonly id: string; readonly name: string }
  | { readonly type: "playlist"; readonly id: string };

export interface ProviderInfo {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
  readonly disabled: boolean;
  readonly supports: readonly ProviderType[];
}

export interface Provider extends ProviderInfo {
  resolve(input: ResolveInput): Promise<string | undefined>;
}

export interface ProviderDeps {
  readonly openOrigin: string;
  readonly tidal: TidalClient | undefined;
  readonly ctx: ExecutionContext;
}

type Resolver = (input: ResolveInput) => Promise<string | undefined>;

function defineProvider(info: ProviderInfo, resolve: Resolver): Provider {
  return {
    ...info,
    resolve: (input) =>
      info.disabled || !info.supports.includes(input.type)
        ? Promise.resolve(undefined)
        : resolve(input),
  };
}

// a search per click would hammer youtube and tidal, results dont change
const SEARCH_TTL_SECONDS = 86_400;
const SEARCHABLE = ["track", "album"] as const;

const TIDAL_KIND: Readonly<Record<"track" | "album" | "artist", TidalKind>> = {
  track: "tracks",
  album: "albums",
  artist: "artists",
};

export function createProviders(deps: ProviderDeps): Readonly<Record<string, Provider>> {
  const youtube =
    (host: string): Resolver =>
    async (input) => {
      if (input.type !== "track" && input.type !== "album") return undefined;
      const kind = input.type === "track" ? "video" : "playlist";
      const query = `${input.name} ${input.artist} ${input.type === "track" ? "audio" : "album"}`;
      const id = await cached({
        key: `yt/${kind}/${query}`,
        ttlSeconds: SEARCH_TTL_SECONDS,
        ctx: deps.ctx,
        load: () => searchYoutube(query, kind),
      });
      return id && youtubeUrl(kind, id, host);
    };

  const providers = [
    defineProvider(
      {
        id: "fixSpotify",
        name: "fixSpotify",
        color: "#1DB954",
        icon: "spotify",
        disabled: false,
        supports: PROVIDER_TYPES,
      },
      async ({ type, id }) => `${deps.openOrigin}/view?type=${type}&id=${id}`,
    ),
    defineProvider(
      {
        id: "spotify",
        name: "Spotify",
        color: "#1DB954",
        icon: "spotify",
        disabled: false,
        supports: PROVIDER_TYPES,
      },
      async ({ type, id }) => `https://open.spotify.com/${type}/${id}`,
    ),
    defineProvider(
      {
        id: "spotifyapp",
        name: "Spotify",
        color: "#1DB954",
        icon: "spotify",
        disabled: false,
        supports: PROVIDER_TYPES,
      },
      async ({ type, id }) => `spotify:${type}:${id}`,
    ),
    defineProvider(
      {
        id: "youtube",
        name: "YouTube",
        color: "#FF0000",
        icon: "youtube",
        disabled: false,
        supports: SEARCHABLE,
      },
      youtube("www.youtube.com"),
    ),
    defineProvider(
      {
        id: "youtubeMusic",
        name: "YouTube Music",
        color: "#FF0000",
        icon: "youtubemusic",
        disabled: false,
        supports: SEARCHABLE,
      },
      youtube("music.youtube.com"),
    ),
    defineProvider(
      {
        id: "tidal",
        name: "Tidal",
        color: "#ffffff",
        icon: "tidal",
        disabled: deps.tidal === undefined,
        supports: ["track", "album", "artist"],
      },
      async (input) => {
        const tidal = deps.tidal;
        if (input.type === "playlist" || tidal === undefined) return undefined;
        const query = input.type === "artist" ? input.name : `${input.name} ${input.artist}`;
        const kind = TIDAL_KIND[input.type];
        return cached({
          key: `tidal/${kind}/${query}`,
          ttlSeconds: SEARCH_TTL_SECONDS,
          ctx: deps.ctx,
          load: () => tidal.search(query, kind),
        });
      },
    ),
  ];

  return Object.fromEntries(providers.map((p) => [p.id, p]));
}

export function describeProviders(
  providers: Readonly<Record<string, Provider>>,
): Readonly<Record<string, ProviderInfo>> {
  return Object.fromEntries(
    Object.entries(providers).map(([id, { resolve: _resolve, ...info }]) => [id, info]),
  );
}

export async function resolveProviderUrl(
  provider: Provider,
  type: ProviderType,
  id: string,
  deps: CatalogDeps,
): Promise<string | undefined> {
  switch (type) {
    case "track": {
      const t = await getTrackSummary(id, deps);
      return t && provider.resolve({ type, id, name: t.name, artist: t.primaryArtist });
    }
    case "album": {
      const a = await getAlbumSummary(id, deps);
      return a && provider.resolve({ type, id, name: a.name, artist: a.primaryArtist });
    }
    case "artist": {
      const a = await getArtist(id, deps);
      return a && provider.resolve({ type, id, name: a.name });
    }
    case "playlist":
      return provider.resolve({ type, id });
  }
}
