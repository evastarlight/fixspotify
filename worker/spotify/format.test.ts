import { describe, expect, it } from "vitest";
import { formatArtists, formatCount, formatDuration, formatReleaseDate } from "./format";

describe("formatDuration", () => {
  it("zero-pads seconds", () => {
    expect(formatDuration(65_000)).toBe("1:05");
  });

  it("rounds to whole seconds without producing :60", () => {
    expect(formatDuration(59_600)).toBe("1:00");
  });
});

describe("formatCount", () => {
  it("abbreviates with unit suffixes", () => {
    expect(formatCount(999)).toBe("999.00");
    expect(formatCount(1_234_567)).toBe("1.23M");
    expect(formatCount(2_500_000_000)).toBe("2.50B");
  });
});

describe("formatReleaseDate", () => {
  it("respects the stated precision", () => {
    expect(formatReleaseDate("2013", "year")).toBe("2013");
    expect(formatReleaseDate("2013-05", "month")).toBe("May 2013");
    expect(formatReleaseDate("2013-05-07", "day")).toBe("May 7, 2013");
  });
});

describe("formatArtists", () => {
  it("joins with comma-space", () => {
    expect(formatArtists([{ name: "A" }, { name: "B" }])).toBe("A, B");
    expect(formatArtists([])).toBe("");
  });
});
