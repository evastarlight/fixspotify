import colos from "./colos.json";

const TRACE_URL = "https://www.cloudflare.com/cdn-cgi/trace";
const TIMEOUT_MS = 3_000;

// from https://github.com/Netrvin/cloudflare-colo-list
const COLOS: Readonly<Record<string, { readonly cca2: string; readonly city: string }>> = colos;

// isolate doesnt move, ask once
let executionColo: string | undefined;

async function traceColo(): Promise<string | undefined> {
  if (executionColo !== undefined) return executionColo;
  const res = await fetch(TRACE_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  executionColo = /^colo=(\w+)$/m.exec(await res.text())?.[1];
  return executionColo;
}

const slug = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function regionLabel(colo: string): string {
  const loc = COLOS[colo];
  return loc ? `${slug(loc.cca2)}-${slug(loc.city)}` : colo.toLowerCase();
}

export interface Region {
  readonly colo: string;
  readonly label: string;
}

export async function workerRegion(ingressColo: string): Promise<Region> {
  const colo = (await traceColo().catch(() => undefined)) ?? ingressColo;
  return { colo, label: regionLabel(colo) };
}
