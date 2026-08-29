import { describe, expect, it } from "vitest";
import { asideKey, ASIDE_TYPE_LIST, ASIDE_TYPES, isAsideType } from "./aside";
import { BROWSABLE_TYPES } from "./routes";

describe("aside types", () => {
  it("keeps the runtime set in the declared order", () => {
    expect([...ASIDE_TYPES]).toEqual(ASIDE_TYPE_LIST);
  });

  it("recognises a type the aside can render", () => {
    expect(isAsideType("spell")).toBe(true);
  });

  /**
   * The list covers every browsable type, so nothing the books link to opens a
   * panel that has nothing to show. There is therefore no example left of a
   * type the aside refuses — which is why `aside-links.test.tsx`,
   * `search.test.ts` and `sources.e2e.ts` each lost the case they used to make
   * with one, and why this assertion stands in their place. Break it by adding
   * a type to `routes.ts` without a renderer and those guards matter again.
   */
  it("covers every browsable type", () => {
    expect([...ASIDE_TYPES].sort()).toEqual([...BROWSABLE_TYPES].sort());
  });
});

describe("asideKey with a fragment", () => {
  /**
   * Two subraces of one race share a page and differ only in the anchor.
   * Keying without it makes them one cache entry, and the second opens
   * whichever was looked at first.
   */
  it("tells two parts of one entity apart", () => {
    expect(asideKey("race", "PHB", "tiefling", "glasya")).not.toBe(
      asideKey("race", "PHB", "tiefling", "zariel"),
    );
  });

  it("leaves a whole entity keyed as it always was", () => {
    expect(asideKey("race", "PHB", "tiefling")).toBe(
      asideKey("race", "phb", "tiefling"),
    );
    expect(asideKey("race", "PHB", "tiefling")).not.toContain("#");
  });
});
