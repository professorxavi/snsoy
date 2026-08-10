import { describe, expect, it } from "vitest";
import { ASIDE_TYPE_LIST, ASIDE_TYPES, isAsideType } from "./aside";

describe("aside types", () => {
  it("keeps the runtime set in the declared order", () => {
    expect([...ASIDE_TYPES]).toEqual(ASIDE_TYPE_LIST);
  });

  it("distinguishes types the aside can render", () => {
    expect(isAsideType("spell")).toBe(true);
    expect(isAsideType("deity")).toBe(false);
  });
});
