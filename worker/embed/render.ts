const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

export interface RenderOptions {
  readonly partials?: Readonly<Record<string, string>> | undefined;
  readonly data: Readonly<Record<string, string>>;
}

export function renderTemplate(template: string, opts: RenderOptions): string {
  let out = template;
  for (const [key, value] of Object.entries(opts.partials ?? {})) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) => {
    const value = opts.data[key];
    return value === undefined ? placeholder : escapeHtml(value);
  });
}
