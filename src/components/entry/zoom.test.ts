import { describe, expect, it } from "vitest";
import type { ImageEntry } from "@/lib/content/media";
import { zoomAttrs } from "./zoom";

const MAP: ImageEntry = {
  type: "image",
  href: { type: "internal", path: "adventure/SKT/027-skt03-thenorth.webp" },
  title: "Map 3.1: The North",
  width: 3000,
  height: 1905,
};

describe("zoomAttrs", () => {
  /** The column is served a variant sized for the column; this is not that. */
  it("points at the full-size file", () => {
    expect(zoomAttrs(MAP, "The Savage Frontier")?.href).toBe(
      "/api/media/adventure/SKT/027-skt03-thenorth.webp",
    );
  });

  it("carries the printed size, which is what the viewer zooms to", () => {
    const attrs = zoomAttrs(MAP, "The Savage Frontier");

    expect(attrs?.["data-zoom-w"]).toBe("3000");
    expect(attrs?.["data-zoom-h"]).toBe("1905");
  });

  it("marks the link so the viewer knows to catch it", () => {
    expect(zoomAttrs(MAP, "x")).toHaveProperty("data-zoom");
  });

  it("describes the image by its own words, then its title", () => {
    expect(zoomAttrs(MAP, "The Savage Frontier")?.["data-zoom-alt"]).toBe(
      "Map 3.1: The North",
    );
    expect(
      zoomAttrs({ ...MAP, altText: "A map of the North" }, "x")?.[
        "data-zoom-alt"
      ],
    ).toBe("A map of the North");
  });

  /** Most images in the books carry neither, hence the page's own name. */
  it("falls back to what is being read", () => {
    const bare: ImageEntry = { type: "image", href: { path: "a/b.webp" } };

    expect(zoomAttrs(bare, "The Savage Frontier")?.["data-zoom-alt"]).toBe(
      "The Savage Frontier",
    );
  });

  /** Nothing to open, so the caller leaves it a picture rather than a link. */
  it("gives nothing back for an image with no path", () => {
    expect(zoomAttrs({ type: "image" }, "x")).toBeUndefined();
  });

  it("takes an external image at its word", () => {
    const external: ImageEntry = {
      type: "image",
      href: { type: "external", url: "https://example.com/map.webp" },
    };

    expect(zoomAttrs(external, "x")?.href).toBe("https://example.com/map.webp");
  });
});
