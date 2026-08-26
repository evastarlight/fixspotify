import { describe, expect, it } from "vitest";
import { firstResultId, youtubeUrl } from "./youtube";

const response = {
  responseContext: {},
  contents: {
    twoColumnSearchResultsRenderer: {
      primaryContents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: [
                  { adSlotRenderer: {} },
                  {
                    videoRenderer: {
                      videoId: "FGBhQbmPwH8",
                      navigationEndpoint: { watchEndpoint: { playlistId: "RDFGBhQbmPwH8" } },
                    },
                  },
                  { playlistRenderer: { playlistId: "PLTT7zbo_Fv8olwazusz7kbZyDf5Oj6FNz" } },
                ],
              },
            },
          ],
        },
      },
    },
  },
};

describe("firstResultId", () => {
  it("returns the first video id in document order", () => {
    expect(firstResultId(response, "video")).toBe("FGBhQbmPwH8");
  });

  it("skips auto-generated mixes when looking for playlists", () => {
    expect(firstResultId(response, "playlist")).toBe("PLTT7zbo_Fv8olwazusz7kbZyDf5Oj6FNz");
  });

  it("returns undefined when nothing matches", () => {
    expect(firstResultId({ contents: [] }, "video")).toBeUndefined();
    expect(firstResultId(null, "playlist")).toBeUndefined();
  });
});

describe("youtubeUrl", () => {
  it("builds watch and playlist urls on the requested host", () => {
    expect(youtubeUrl("video", "abc")).toBe("https://www.youtube.com/watch?v=abc");
    expect(youtubeUrl("playlist", "PL1", "music.youtube.com")).toBe(
      "https://music.youtube.com/playlist?list=PL1",
    );
  });
});
