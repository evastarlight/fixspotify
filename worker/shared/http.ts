import { BadRequestError } from "./errors";

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", "*");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function html(body: string): Response {
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

export function withSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "SAMEORIGIN");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export type RouteParams = Readonly<Record<string, string>>;
export type RouteHandler<TContext> = (
  rc: TContext,
  params: RouteParams,
) => Promise<Response> | Response;

export interface Route<TContext> {
  readonly pattern: URLPattern;
  readonly handler: RouteHandler<TContext>;
}

export function route<TContext>(
  pathname: string,
  handler: RouteHandler<TContext>,
): Route<TContext> {
  return { pattern: new URLPattern({ pathname }), handler };
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new BadRequestError("malformed url");
  }
}

export async function dispatch<TContext>(
  routes: readonly Route<TContext>[],
  url: URL,
  rc: TContext,
): Promise<Response | undefined> {
  for (const r of routes) {
    const match = r.pattern.exec(url.href);
    if (!match) continue;
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(match.pathname.groups)) {
      if (value !== undefined) params[key] = decodeParam(value);
    }
    return r.handler(rc, params);
  }
  return undefined;
}
