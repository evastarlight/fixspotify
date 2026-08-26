import { describe, expect, it } from "vitest";
import { imageId, summarizeTrack } from "./catalog";
import type { Track } from "./client";

const track: Track = {
  id: "4uLU6hMCjMI75M1A2tKUQC",
  name: "Never Gonna Give You Up",
  artists: [{ name: "Rick Astley" }, { name: "Someone Else" }],
  duration_ms: 213_573,
  track_number: 1,
  album: {
    name: "Whenever You Need Somebody",
    images: [
      { url: "https://i.scdn.co/image/ab67616d0000b273large" },
      { url: "https://i.scdn.co/image/ab67616d0000b273small" },
    ],
    release_date: "1987-11-12",
    release_date_precision: "day",
    total_tracks: 10,
  },
  external_urls: { spotify: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" },
};

describe("summarizeTrack", () => {
  it("formats artists, duration, date, and picks the largest cover", () => {
    const s = summarizeTrack(track);
    expect(s.artists).toBe("Rick Astley, Someone Else");
    expect(s.primaryArtist).toBe("Rick Astley");
    expect(s.duration).toBe("3:34");
    expect(s.releaseDate).toBe("November 12, 1987");
    expect(s.albumArtId).toBe("ab67616d0000b273large");
    expect(s.images).toEqual(["ab67616d0000b273large", "ab67616d0000b273small"]);
  });

  it("tolerates an album with no art", () => {
    const s = summarizeTrack({ ...track, album: { ...track.album, images: [] } });
    expect(s.albumArtId).toBe("");
    expect(s.images).toEqual([]);
  });
});

describe("imageId", () => {
  it("returns the last path segment", () => {
    expect(imageId("https://i.scdn.co/image/abc123")).toBe("abc123");
  });
});
