import { describe, expect, it } from "vitest";
import { ASIDE_TYPE_LIST, ASIDE_TYPES, isAsideType } from "./aside";
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
