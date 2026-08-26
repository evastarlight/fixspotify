import { z } from "zod";
import { UpstreamError } from "../shared/errors";
import { clientCredentialsToken } from "../shared/oauth";

const API_ORIGIN = "https://openapi.tidal.com/v2";
const TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token";
const TIMEOUT_MS = 8_000;
// one country only
const COUNTRY_CODE = "US";

const SearchResults = z.object({
  included: z
    .array(
      z.object({
        attributes: z.object({
          externalLinks: z.array(z.object({ href: z.string() })).default([]),
        }),
      }),
    )
    .default([]),
});

export type TidalKind = "tracks" | "albums" | "artists";

export interface TidalClient {
  search(query: string, kind: TidalKind): Promise<string | undefined>;
}

export interface TidalClientDeps {
  readonly kv: KVNamespace;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetch?: typeof fetch | undefined;
}

export function createTidalClient(deps: TidalClientDeps): TidalClient {
  const fetchImpl = deps.fetch ?? fetch;
  const creds = {
    service: "tidal",
    tokenUrl: TOKEN_URL,
    clientId: deps.clientId,
    clientSecret: deps.clientSecret,
  };

  return {
    async search(query, kind) {
      const token = await clientCredentialsToken(deps.kv, creds, { fetch: fetchImpl });
      const params = new URLSearchParams({
        "filter[query]": query,
        countryCode: COUNTRY_CODE,
        include: kind,
      });
      const res = await fetchImpl(`${API_ORIGIN}/searchResults?${params}`, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.api+json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new UpstreamError("tidal", res.status);

      // results come back ranked, first one is the match
      const results = SearchResults.parse(await res.json());
      return results.included.find((item) => item.attributes.externalLinks.length > 0)?.attributes
        .externalLinks[0]?.href;
    },
  };
}
