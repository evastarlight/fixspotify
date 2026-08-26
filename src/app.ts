import { z } from "zod";
import pkg from "../package.json";
import { EMBED_KINDS, type EmbedKind, loadEmbed, renderEmbed } from "./embed";
import { parseVars, resolveSite, type Site, type Vars } from "./env";
import { unwrapSpotifyLink } from "./link";
import {
  createProviders,
  createTidalClient,
  describeProviders,
  isProviderType,
  PROVIDER_TYPES,
  type Provider,
  resolveProviderUrl,
} from "./providers";
import { workerRegion } from "./region";
import { cached } from "./shared/cache";
import { BadRequestError, NotFoundError, UpstreamError } from "./shared/errors";
import {
  dispatch,
  html,
  json,
  type Route,
  redirect,
  route,
  withSecurityHeaders,
} from "./shared/http";
import {
  type CatalogDeps,
  createSpotifyClient,
  getAlbumSummary,
  getArtist,
  getPlaylist,
  getPlaylistTracks,
  getTrackSummary,
  imageId,
  parseSpotifyId,
  type SpotifyClient,
} from "./spotify";
import { recordStat, statsSnapshot, statsTop } from "./stats";
import { shouldCount } from "./stats/dedupe";
import { parseTopQuery, sinceDay } from "./stats/top";

interface RequestContext {
  readonly site: Site;
  readonly url: URL;
  readonly env: Env;
  readonly vars: Vars;
  readonly ctx: ExecutionContext;
  readonly spotify: SpotifyClient;
  readonly providers: Readonly<Record<string, Provider>>;
  readonly mainOrigin: string;
  readonly openOrigin: string;
  readonly colo: string;
  readonly ip: string;
}

type Page = "index" | "config" | "view" | "error" | "about" | "stats";
const TOP_CACHE_SECONDS = 60;
// every open tab polls this, keep it off the durable object
const STATS_CACHE_SECONDS = 5;
const SPOTIFY_IMAGE_ID = /^[a-f0-9]{40}$/i;
const LINK_TOKEN = /^[A-Za-z0-9]{1,32}$/;
const CONVERT_PLAYLIST_LIMIT = 50;
const IMAGE_CACHE_SECONDS = 86_400;

async function page(rc: RequestContext, name: Page, status = 200): Promise<Response> {
  const asset = await rc.env.ASSETS.fetch(new URL(`/pages/${name}.html`, rc.url.origin));
  return new Response(asset.body, { status, headers: asset.headers });
}

const catalogDeps = (rc: RequestContext): CatalogDeps => ({ spotify: rc.spotify, ctx: rc.ctx });

const embedRoute = (kind: EmbedKind): Route<RequestContext> =>
  route(`/${kind}/:id`, async (rc, { id = "" }) => {
    const spotifyId = parseSpotifyId(id);
    const [data, count] = await Promise.all([
      loadEmbed(kind, spotifyId, catalogDeps(rc)),
      shouldCount({
        ip: rc.ip,
        type: kind,
        id: spotifyId,
        ctx: rc.ctx,
        limiter: rc.env.EMBED_LIMITER,
      }),
    ]);
    if (count) {
      recordStat(rc.env, rc.ctx, rc.vars.STATS_SAMPLE_RATE, {
        addedAt: Date.now(),
        type: kind,
        id: spotifyId,
        artistId: data.artistId,
        name: data.title,
        description: data.subtitle,
        image: data.image,
        url: kind === "playlist" ? data.url : `${rc.openOrigin}/view?type=${kind}&id=${spotifyId}`,
      });
    }
    return html(renderEmbed(kind, data, rc.openOrigin));
  });

const statsRoute: Route<RequestContext> = route("/api/stats", async (rc) => {
  const since = Number(rc.url.searchParams.get("since")) || 0;
  if (since > 0) return json(await statsSnapshot(rc.env, since));
  const snapshot = await cached({
    key: "stats/snapshot",
    ttlSeconds: STATS_CACHE_SECONDS,
    ctx: rc.ctx,
    load: () => statsSnapshot(rc.env, 0),
  });
  return json(snapshot);
});

const statsPageRoute: Route<RequestContext> = route("/stats", (rc) => page(rc, "stats"));

const topRoute: Route<RequestContext> = route("/api/stats/top", async (rc) => {
  const q = parseTopQuery(rc.url.searchParams);
  if (!q) throw new BadRequestError("Invalid type or range");
  const entries = await cached({
    key: `top/${q.type}/${q.range}/${q.limit}`,
    ttlSeconds: TOP_CACHE_SECONDS,
    ctx: rc.ctx,
    // dont cache an empty chart, it fills in as hits land
    load: async () => {
      const entries = await statsTop(rc.env, q.type, sinceDay(q.range, Date.now()), q.limit);
      return entries.length > 0 ? entries : undefined;
    },
  });
  return json(entries ?? []);
});

const regionRoute: Route<RequestContext> = route("/api/region", async (rc) =>
  json(await workerRegion(rc.colo)),
);

const convertRoute: Route<RequestContext> = route("/api/convert", async (rc) => {
  const q = rc.url.searchParams;
  const provider = rc.providers[q.get("provider") ?? ""];
  if (!provider) {
    return json(
      {
        success: false,
        error: `Please provide a valid provider id. One of "${Object.keys(rc.providers).join(" | ")}"`,
      },
      { status: 400 },
    );
  }
  const type = q.get("type") ?? "";
  const rawId = q.get("id") ?? "";
  if (!isProviderType(type) || rawId === "") {
    return json(
      {
        success: false,
        error: `Please provide a valid resource type and resource id. Valid resource type is one of "${PROVIDER_TYPES.join(" | ")}"`,
      },
      { status: 400 },
    );
  }
  const id = parseSpotifyId(rawId);
  const deps = catalogDeps(rc);

  switch (type) {
    case "track":
    case "artist":
    case "playlist": {
      if (type === "playlist" && provider.supports.includes("playlist")) {
        const url = await resolveProviderUrl(provider, type, id, deps);
        return json({ success: true, url });
      }
      if (type === "playlist") {
        const tracks = await getPlaylistTracks(id, CONVERT_PLAYLIST_LIMIT, deps);
        const urls = await Promise.all(
          tracks.map((t) =>
            provider.resolve({
              type: "track",
              id: t.id,
              name: t.name,
              artist: t.artists[0]?.name ?? "",
            }),
          ),
        );
        return json({ success: true, urls });
      }
      const url = await resolveProviderUrl(provider, type, id, deps);
      return url
        ? json({ success: true, url })
        : json({ success: false, error: `Failed to find info for this ${type}.` });
    }
    case "album": {
      const album = await getAlbumSummary(id, deps);
      if (!album) return json({ success: false, error: "Failed to find info for this album." });
      const urls = await Promise.all(
        album.tracks.map((t) =>
          provider.resolve({ type: "track", id: t.id, name: t.name, artist: t.primaryArtist }),
        ),
      );
      return json({ success: true, urls });
    }
    default: {
      const exhaustive: never = type;
      throw new Error(`unhandled type: ${String(exhaustive)}`);
    }
  }
});

const mainRoutes: readonly Route<RequestContext>[] = [
  route("/", (rc) => page(rc, "index")),
  route("/about", (rc) => page(rc, "about")),
  statsRoute,
  statsPageRoute,
  topRoute,
  regionRoute,
  convertRoute,
];

const openRoutes: readonly Route<RequestContext>[] = [
  route("/", (rc) => page(rc, "config")),
  route("/view", (rc) => page(rc, "view")),
  ...EMBED_KINDS.map(embedRoute),
  route("/redirect/:provider/:type/:id", async (rc, { provider = "", type = "", id = "" }) => {
    // unknown provider -> fixspotify
    const target = rc.providers[provider] ?? rc.providers["fixSpotify"];
    if (!target) throw new Error("fixSpotify provider missing from registry");
    if (!isProviderType(type)) throw new BadRequestError("Invalid type");
    const url = await resolveProviderUrl(target, type, parseSpotifyId(id), catalogDeps(rc));
    return url ? redirect(url) : page(rc, "error", 404);
  }),
  route("/api", (rc) => json({ version: pkg.version, providers: describeProviders(rc.providers) })),
  route("/api/providers", (rc) => json(describeProviders(rc.providers))),
  route("/api/info/:type/:id", async (rc, { type = "", id = "" }) => {
    if (!isProviderType(type)) throw new BadRequestError("Invalid type");
    const spotifyId = parseSpotifyId(id);
    const deps = catalogDeps(rc);
    switch (type) {
      case "track": {
        const t = await getTrackSummary(spotifyId, deps);
        if (!t) throw new NotFoundError(type, spotifyId);
        return json({
          name: t.name,
          artists: t.artists,
          album: t.album,
          albumArt: `/api/image/${t.albumArtId}`,
        });
      }
      case "album": {
        const a = await getAlbumSummary(spotifyId, deps);
        if (!a) throw new NotFoundError(type, spotifyId);
        return json({
          name: a.name,
          artists: a.artists,
          images: a.images.map((i) => `/api/image/${i}`),
          tracks: a.tracks.map(({ id, name, artists, duration }) => ({
            id,
            name,
            artists,
            duration,
          })),
        });
      }
      case "artist": {
        const a = await getArtist(spotifyId, deps);
        if (!a) throw new NotFoundError(type, spotifyId);
        return json({
          name: a.name,
          genres: a.genres.join(", "),
          images: a.images.map((i) => `/api/image/${imageId(i.url)}`),
        });
      }
      case "playlist": {
        const p = await getPlaylist(spotifyId, deps);
        if (!p) throw new NotFoundError(type, spotifyId);
        return json({
          name: p.name,
          description: p.description ?? "",
          images: (p.images ?? []).map((i) => `/api/image/${imageId(i.url)}`),
        });
      }
      default: {
        const exhaustive: never = type;
        throw new Error(`unhandled type: ${String(exhaustive)}`);
      }
    }
  }),
  route("/api/image/:id", async (_rc, { id = "" }) => {
    // colorthief needs same origin
    if (!SPOTIFY_IMAGE_ID.test(id)) throw new NotFoundError("image", id);
    const upstream = await fetch(`https://i.scdn.co/image/${id}`, {
      cf: { cacheEverything: true, cacheTtl: IMAGE_CACHE_SECONDS },
    });
    const contentType = upstream.headers.get("content-type") ?? "";
    // never relay anything but an image on our own origin
    if (!upstream.ok || !contentType.startsWith("image/")) throw new NotFoundError("image", id);
    return new Response(upstream.body, {
      headers: {
        "content-type": contentType,
        "cache-control": `public, max-age=${IMAGE_CACHE_SECONDS}`,
      },
    });
  }),
  statsRoute,
  statsPageRoute,
  topRoute,
  regionRoute,
  convertRoute,
];

const linkRoutes: readonly Route<RequestContext>[] = [
  route("/", (rc) => redirect(rc.mainOrigin)),
  route("/:token", async (rc, { token = "" }) => {
    if (!LINK_TOKEN.test(token)) throw new NotFoundError("link", token);
    const target = await unwrapSpotifyLink(token);
    if (!target) throw new NotFoundError("link", token);
    return redirect(new URL(target.pathname + target.search, rc.openOrigin).href);
  }),
];

const ROUTES: Readonly<Record<Site, readonly Route<RequestContext>[]>> = {
  main: mainRoutes,
  open: openRoutes,
  link: linkRoutes,
};

// drop /intl-xx
const INTL_PREFIX = /^\/intl-[A-Za-z-]+(?=\/|$)/;

function stripIntlPrefix(url: URL): URL {
  const match = INTL_PREFIX.exec(url.pathname);
  if (!match) return url;
  const stripped = new URL(url);
  stripped.pathname = url.pathname.slice(match[0].length) || "/";
  return stripped;
}

function buildContext(
  request: Request<unknown, IncomingRequestCfProperties>,
  env: Env,
  ctx: ExecutionContext,
  vars: Vars,
): RequestContext {
  const requestUrl = new URL(request.url);
  const site = resolveSite(requestUrl.hostname, vars);
  const url = site === "open" ? stripIntlPrefix(requestUrl) : requestUrl;
  // forced site = this origin
  const forced = vars.FORCE_SITE;
  const mainOrigin = forced === "main" ? url.origin : `https://${vars.MAIN_HOST}`;
  const openOrigin = forced === "open" ? url.origin : `https://${vars.OPEN_HOST}`;

  const spotify = createSpotifyClient({
    kv: env.TOKENS,
    clientId: vars.SPOTIFY_CLIENT_ID,
    clientSecret: vars.SPOTIFY_CLIENT_SECRET,
  });
  const tidal =
    vars.TIDAL_CLIENT_ID !== undefined && vars.TIDAL_CLIENT_SECRET !== undefined
      ? createTidalClient({
          kv: env.TOKENS,
          clientId: vars.TIDAL_CLIENT_ID,
          clientSecret: vars.TIDAL_CLIENT_SECRET,
        })
      : undefined;

  return {
    site,
    url,
    env,
    vars,
    ctx,
    spotify,
    providers: createProviders({ openOrigin, tidal, ctx }),
    mainOrigin,
    openOrigin,
    colo: request.cf?.colo ?? "unknown",
    ip: request.headers.get("cf-connecting-ip") ?? "",
  };
}

async function errorResponse(rc: RequestContext, err: unknown): Promise<Response> {
  if (err instanceof NotFoundError) return page(rc, "error", 404);
  if (err instanceof BadRequestError) {
    return json({ success: false, error: err.message }, { status: 400 });
  }
  if (err instanceof UpstreamError && err.status === 429) {
    return new Response("upstream rate limited, try again shortly", {
      status: 503,
      headers: { "retry-after": String(err.retryAfterSeconds ?? 30) },
    });
  }
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return new Response("upstream timed out", { status: 504 });
  }
  if (err instanceof UpstreamError || err instanceof z.ZodError) {
    console.error("upstream failure", { path: rc.url.pathname, err });
    return new Response("upstream error", { status: 502 });
  }
  console.error("unhandled error", { path: rc.url.pathname, err });
  return new Response("internal error", { status: 500 });
}

export async function handleRequest(
  request: Request<unknown, IncomingRequestCfProperties>,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  let vars: Vars;
  try {
    vars = parseVars(env);
  } catch (err) {
    console.error("invalid configuration", err);
    return new Response("misconfigured", { status: 500 });
  }

  const rc = buildContext(request, env, ctx, vars);
  try {
    const res = (await dispatch(ROUTES[rc.site], rc.url, rc)) ?? (await page(rc, "error", 404));
    return withSecurityHeaders(res);
  } catch (err) {
    return withSecurityHeaders(await errorResponse(rc, err));
  }
}
