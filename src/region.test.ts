import { describe, expect, it } from "vitest";
import { regionLabel } from "./region";

describe("regionLabel", () => {
  it("maps known colos to country-city slugs", () => {
    expect(regionLabel("DFW")).toBe("us-dallas");
    expect(regionLabel("GRU")).toBe("br-sao-paulo");
    expect(regionLabel("LHR")).toBe("gb-london");
  });

  it("falls back to the colo code", () => {
    expect(regionLabel("XXX")).toBe("xxx");
  });
});
