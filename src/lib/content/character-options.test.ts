import { describe, expect, it } from "vitest";
import {
  characterOptionKinds,
  characterOptionSummary,
} from "./character-options";

/**
 * The kind reaches this from two directions, and that is the whole reason the
 * helper takes `unknown`: a table row gets `jsonb ->> 'optionType'`, which is
 * the array's own JSON text, and the aside gets the parsed blob. A change that
 * handled only one of them would leave either every table cell or every
 * subtitle blank, with nothing else failing.
 */

describe("characterOptionKinds", () => {
  it("reads the JSON text a list row gets", () => {
    expect(characterOptionKinds('["SG"]')).toEqual(["SG"]);
  });

  it("reads the array the aside gets", () => {
    expect(characterOptionKinds(["DG"])).toEqual(["DG"]);
  });

  it("is empty for anything else, rather than throwing", () => {
    expect(characterOptionKinds(null)).toEqual([]);
    expect(characterOptionKinds("not json")).toEqual([]);
    expect(characterOptionKinds(42)).toEqual([]);
    expect(characterOptionKinds([1, "SG"])).toEqual(["SG"]);
  });
});

describe("characterOptionSummary", () => {
  it("names the kind", () => {
    expect(characterOptionSummary('["SG"]')).toBe("Supernatural Gift");
    expect(characterOptionSummary('["RF:B"]')).toBe("Background Feature");
  });

  it("passes an unknown code through rather than hiding the row", () => {
    expect(characterOptionSummary('["ZZ"]')).toBe("ZZ");
  });

  it("prints an em dash where there is no kind", () => {
    expect(characterOptionSummary(null)).toBe("—");
  });
});
