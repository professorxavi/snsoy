import { describe, expect, it } from "vitest";
import { groupLanguages, type LanguageVariant } from "./generic";

const language = (sourceId: string): LanguageVariant =>
  ({
    id: sourceId,
    naturalKey: `language|common|${sourceId.toLowerCase()}`,
    name: "Common",
    slug: "common",
    sourceId,
    sourceName: sourceId,
    page: null,
    data: {},
  }) as LanguageVariant;

describe("groupLanguages", () => {
  it("puts the Player's Handbook variant first", () => {
    const [common] = groupLanguages([
      language("GGR"),
      language("PHB"),
      language("ERLW"),
    ]);

    expect(common?.sourceIds).toEqual(["PHB", "ERLW", "GGR"]);
    expect(common?.sourceId).toBe("PHB");
  });
});
