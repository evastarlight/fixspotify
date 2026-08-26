import { describe, expect, it } from "vitest";
import { extractOgUrl } from "./link";

describe("extractOgUrl", () => {
  it("reads the og:url meta content", () => {
    const html =
      '<html><head><meta property="og:title" content="x"><meta property="og:url" content="https://open.spotify.com/track/abc?si=1"></head></html>';
    expect(extractOgUrl(html)).toBe("https://open.spotify.com/track/abc?si=1");
  });

  it("returns undefined when absent", () => {
    expect(extractOgUrl("<html></html>")).toBeUndefined();
  });
});
