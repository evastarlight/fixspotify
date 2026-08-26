import { describe, expect, it } from "vitest";
import { dayOf, parseTopQuery, sinceDay } from "./top";

const NOW = 1_787_700_000_000;

describe("parseTopQuery", () => {
  it("defaults to tracks, this week, 25", () => {
    expect(parseTopQuery(new URLSearchParams())).toEqual({ type: "track", range: "7d", limit: 25 });
  });

  it("clamps the limit", () => {
    expect(parseTopQuery(new URLSearchParams("limit=999"))?.limit).toBe(50);
    expect(parseTopQuery(new URLSearchParams("limit=0"))?.limit).toBe(25);
    expect(parseTopQuery(new URLSearchParams("limit=-3"))?.limit).toBe(1);
  });

  it("rejects unknown type or range", () => {
    expect(parseTopQuery(new URLSearchParams("type=playlist"))).toBeUndefined();
    expect(parseTopQuery(new URLSearchParams("range=1y"))).toBeUndefined();
  });
});

describe("sinceDay", () => {
  it("covers the last 7 and 30 days inclusive of today", () => {
    expect(sinceDay("7d", NOW)).toBe(dayOf(NOW) - 6);
    expect(sinceDay("30d", NOW)).toBe(dayOf(NOW) - 29);
    expect(sinceDay("all", NOW)).toBe(0);
  });
});
