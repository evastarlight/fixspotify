import { UpstreamError } from "../shared/errors";

const SEARCH_URL = "https://www.youtube.com/youtubei/v1/search?prettyPrint=false";
// version just needs to look real
const CLIENT = { clientName: "WEB", clientVersion: "2.20240606.06.00" } as const;
const TIMEOUT_MS = 8_000;

const FILTER = { video: "EgIQAQ==", playlist: "EgIQAw==" } as const;
export type YoutubeKind = keyof typeof FILTER;

export async function searchYoutube(query: string, kind: YoutubeKind): Promise<string | undefined> {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    body: JSON.stringify({ context: { client: CLIENT }, query, params: FILTER[kind] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new UpstreamError("youtube", res.status);
  return firstResultId(await res.json(), kind);
}

export function youtubeUrl(kind: YoutubeKind, id: string, host: string): string {
  return kind === "video"
    ? `https://${host}/watch?v=${encodeURIComponent(id)}`
    : `https://${host}/playlist?list=${encodeURIComponent(id)}`;
}

// RD WL LL arent real playlists
const isRealPlaylist = (id: string): boolean => !/^(RD|WL|LL)/.test(id);

export function firstResultId(json: unknown, kind: YoutubeKind): string | undefined {
  const key = kind === "video" ? "videoId" : "playlistId";
  const accept = kind === "video" ? () => true : isRealPlaylist;

  const visit = (node: unknown): string | undefined => {
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found !== undefined) return found;
      }
      return undefined;
    }
    if (node === null || typeof node !== "object") return undefined;
    const record = node as Record<string, unknown>;
    const id = record[key];
    if (typeof id === "string" && accept(id)) return id;
    for (const value of Object.values(record)) {
      const found = visit(value);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  return visit(json);
}
