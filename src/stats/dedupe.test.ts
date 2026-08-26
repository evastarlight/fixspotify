import { describe, expect, it } from "vitest";
import { dailySalt, hashIp } from "./dedupe";

describe("hashIp", () => {
  it("is stable for the same ip and salt, 32 hex chars", async () => {
    const a = await hashIp("203.0.113.7", "20000");
    expect(a).toBe(await hashIp("203.0.113.7", "20000"));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it("changes with the salt and never contains the ip", async () => {
    const a = await hashIp("203.0.113.7", "20000");
    const b = await hashIp("203.0.113.7", "20001");
    expect(a).not.toBe(b);
    expect(a).not.toContain("203");
  });
});

describe("dailySalt", () => {
  it("is the utc day number", () => {
    expect(dailySalt(0)).toBe("0");
    expect(dailySalt(86_400_000 * 3 + 5)).toBe("3");
  });
});
