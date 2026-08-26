export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", "*");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function html(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(body, { ...init, headers });
}

export function redirect(location: string, status: 301 | 302 | 307 | 308 = 302): Response {
  return new Response(null, { status, headers: { location } });
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
      if (value !== undefined) params[key] = decodeURIComponent(value);
    }
    return r.handler(rc, params);
  }
  return undefined;
}
