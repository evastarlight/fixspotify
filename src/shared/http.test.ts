import { describe, expect, it } from "vitest";
import { dispatch, route } from "./http";

const routes = [
  route<string>("/", (rc) => new Response(`root:${rc}`)),
  route<string>("/track/:id", (_rc, { id }) => new Response(`track:${id}`)),
];

describe("dispatch", () => {
  it("matches the first route and decodes params", async () => {
    const res = await dispatch(routes, new URL("https://x.test/track/a%20b?x=1"), "ctx");
    expect(await res?.text()).toBe("track:a b");
  });

  it("matches the root exactly", async () => {
    const res = await dispatch(routes, new URL("https://x.test/"), "ctx");
    expect(await res?.text()).toBe("root:ctx");
  });

  it("returns undefined when nothing matches", async () => {
    expect(await dispatch(routes, new URL("https://x.test/nope"), "ctx")).toBeUndefined();
  });

  it("rejects malformed percent encoding as a bad request", async () => {
    await expect(dispatch(routes, new URL("https://x.test/track/%E0%A4%A"), "ctx")).rejects.toThrow(
      "malformed url",
    );
  });
});
