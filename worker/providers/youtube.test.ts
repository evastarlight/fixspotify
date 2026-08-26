import { describe, expect, it } from "vitest";
import { firstResultId } from "./youtube";

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
