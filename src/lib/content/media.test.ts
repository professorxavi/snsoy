import { describe, expect, it } from "vitest";
import { imageUrl, mediaUrl, tokenPath } from "./media";

/**
 * The base URL is read at module load, so these assert against the default
 * (`/api/media/`). What matters here is the path arithmetic and the token
 * naming rule, neither of which depends on which origin is configured.
 */

describe("mediaUrl", () => {
  it("joins base and path with exactly one separator", () => {
    expect(mediaUrl("covers/PHB.webp")).toBe("/api/media/covers/PHB.webp");
  });

  it("tolerates a leading slash on the path", () => {
    expect(mediaUrl("/covers/PHB.webp")).toBe("/api/media/covers/PHB.webp");
  });
});

describe("tokenPath", () => {
  it("derives the conventional path from name and source", () => {
    expect(tokenPath("monster", "Aarakocra", "MM")).toBe(
      "bestiary/tokens/MM/Aarakocra.webp",
    );
  });

  it("keeps spaces literal", () => {
    expect(tokenPath("monster", "Adult Red Dragon", "MM")).toBe(
      "bestiary/tokens/MM/Adult Red Dragon.webp",
    );
  });

  /*
   * Both rules come from the corpus's own filename function. Getting either
   * wrong yields a 404 rather than an error, which is why they are pinned.
   */
  it("folds accents to ASCII", () => {
    expect(tokenPath("monster", "Deep Gnome (Svirfneblin)", "MM")).toBe(
      "bestiary/tokens/MM/Deep Gnome (Svirfneblin).webp",
    );
    expect(tokenPath("monster", "Duérgar", "MM")).toBe(
      "bestiary/tokens/MM/Duergar.webp",
    );
  });

  /*
   * NFD leaves `æ` alone — it is one codepoint, not a base plus a mark — so the
   * ligature needs its own mapping. This was the single failure in a sweep of
   * all 3,808 derived token paths against the image set.
   */
  it("expands ligatures that NFD does not decompose", () => {
    expect(tokenPath("monster", "Morgæn", "AI")).toBe(
      "bestiary/tokens/AI/Morgaen.webp",
    );
    expect(tokenPath("monster", "Æthelred", "AI")).toBe(
      "bestiary/tokens/AI/AEthelred.webp",
    );
  });

  it("drops double quotes", () => {
    expect(tokenPath("monster", 'Zorbo "the Grasping"', "TOA")).toBe(
      "bestiary/tokens/TOA/Zorbo the Grasping.webp",
    );
  });

  it("files objects and vehicles in their own directories", () => {
    expect(tokenPath("object", "Ballista", "DMG")).toBe(
      "objects/tokens/DMG/Ballista.webp",
    );
    expect(tokenPath("vehicle", "Galley", "GoS")).toBe(
      "vehicles/tokens/GoS/Galley.webp",
    );
  });
});

describe("imageUrl", () => {
  it("resolves an internal path against the media root", () => {
    expect(imageUrl({ type: "internal", path: "bestiary/MM/Aarakocra.webp" })).toBe(
      "/api/media/bestiary/MM/Aarakocra.webp",
    );
  });

  it("returns an external url untouched", () => {
    expect(
      imageUrl({ type: "external", url: "https://example.com/a.png" }),
    ).toBe("https://example.com/a.png");
  });

  it("returns null when there is nothing to resolve", () => {
    expect(imageUrl(undefined)).toBeNull();
    expect(imageUrl({ type: "internal" })).toBeNull();
  });
});
