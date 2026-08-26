import { z } from "zod";

export const SITES = ["main", "open", "link"] as const;
export type Site = (typeof SITES)[number];

const VarsSchema = z.object({
  MAIN_HOST: z.string().min(1),
  OPEN_HOST: z.string().min(1),
  LINK_HOST: z.string().min(1),
  FORCE_SITE: z.enum(SITES).optional(),
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  TIDAL_CLIENT_ID: z.string().min(1).optional(),
  TIDAL_CLIENT_SECRET: z.string().min(1).optional(),
  STATS_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1),
});

export type Vars = z.infer<typeof VarsSchema>;

export function parseVars(env: Env): Vars {
  return VarsSchema.parse(env);
}

export function resolveSite(hostname: string, vars: Vars): Site {
  if (vars.FORCE_SITE !== undefined) return vars.FORCE_SITE;
  if (hostname === vars.OPEN_HOST) return "open";
  if (hostname === vars.LINK_HOST) return "link";
  return "main";
}
