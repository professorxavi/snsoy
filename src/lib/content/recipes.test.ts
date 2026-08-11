import { describe, expect, it } from "vitest";
import {
  dietLabel,
  ingredientText,
  recipeSubtitle,
  servesSummary,
} from "./recipes";

/**
 * A recipe's quantities are placeholders, and this is what fills them in.
 *
 * The modifiers are the cookbooks' own and all four occur in the data. Getting
 * one wrong is not a crash but a wrong number in a recipe someone is cooking
 * from — "0.5 pound" where the book says "½ pound", or "eggs" where it wants
 * "egg".
 */

describe("ingredientText", () => {
  it("sets a fraction as a fraction", () => {
    expect(
      ingredientText({
        entry: "{=amount1/v} teaspoon garlic powder",
        amount1: 0.5,
      }),
    ).toBe("½ teaspoon garlic powder");
  });

  /** 1.5 is a mixed number, not a fraction on its own. */
  it("keeps the whole part of a mixed number", () => {
    expect(ingredientText({ entry: "{=amount1/v} cups flour", amount1: 1.5 })).toBe(
      "1½ cups flour",
    );
  });

  it("leaves an amount no fraction fits as the number it is", () => {
    expect(ingredientText({ entry: "{=amount1/v} cups stock", amount1: 0.3 })).toBe(
      "0.3 cups stock",
    );
  });

  /** The line opens with the amount, so the cookbook spells and capitalises it. */
  it("spells out and capitalises where the modifiers ask", () => {
    expect(
      ingredientText({ entry: "{=amount1/xt} 12-ounce bottle ale", amount1: 1 }),
    ).toBe("One 12-ounce bottle ale");
  });

  it("fills every placeholder in a line, each from its own field", () => {
    expect(
      ingredientText({
        entry: "{=amount1/c} egg plus {=amount2/c} yolks",
        amount1: 1,
        amount2: 2,
      }),
    ).toBe("1 egg plus 2 yolks");
  });

  /**
   * A placeholder with no value behind it leaves its key rather than the raw
   * braces, which the renderer would otherwise report as an unknown tag in the
   * middle of a sentence.
   */
  it("does not leave brace text in the prose", () => {
    expect(ingredientText({ entry: "{=amount9/v} pinches salt" })).toBe(
      "amount9 pinches salt",
    );
  });
});

describe("dietLabel", () => {
  it("names the three diets", () => {
    expect(dietLabel("V")).toBe("Vegan");
    expect(dietLabel("C")).toBe("Vegetarian");
    expect(dietLabel("X")).toBe("Meat");
  });

  it("prints an em dash where a recipe names none", () => {
    expect(dietLabel(null)).toBe("—");
  });
});

describe("servesSummary", () => {
  it("reads an exact count, a range, and a note", () => {
    expect(servesSummary({ exact: 4 })).toBe("4");
    expect(servesSummary({ min: 8, max: 10 })).toBe("8–10");
    expect(servesSummary({ exact: 4, note: "as a snack" })).toBe("4 as a snack");
  });

  it("reads the same value from a list row's JSON text", () => {
    expect(servesSummary('{"exact": 6}')).toBe("6");
  });
});

describe("recipeSubtitle", () => {
  it("states the cuisine, the diet and what it serves", () => {
    expect(
      recipeSubtitle({
        type: "Uncommon Cuisine",
        diet: "X",
        serves: { exact: 4, note: "as a snack" },
      }),
    ).toBe("Uncommon Cuisine · Meat · Serves 4 as a snack");
  });

  it("drops what a recipe does not carry rather than printing a gap", () => {
    expect(recipeSubtitle({ type: "Elven" })).toBe("Elven");
    expect(recipeSubtitle({})).toBe("");
  });
});
