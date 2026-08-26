import { describe, expect, it } from "vitest";
import { escapeHtml, renderTemplate } from "./render";

describe("renderTemplate", () => {
  it("inserts partials raw and then fills their placeholders with escaped data", () => {
    const out = renderTemplate("<head>{{head}}<title>{{title}}</title></head>", {
      partials: { head: '<meta content="{{title}}">' },
      data: { title: 'Say "Hi" & <bye>' },
    });
    expect(out).toBe(
      '<head><meta content="Say &quot;Hi&quot; &amp; &lt;bye&gt;"><title>Say &quot;Hi&quot; &amp; &lt;bye&gt;</title></head>',
    );
  });

  it("leaves unknown placeholders alone", () => {
    expect(renderTemplate("{{missing}}", { data: {} })).toBe("{{missing}}");
  });
});

describe("escapeHtml", () => {
  it("escapes the five significant characters", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
    );
  });
});
