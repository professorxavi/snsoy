import { Box } from "@chakra-ui/react";
import Image from "next/image";
import { imageUrl, type ImageEntry } from "@/lib/content/media";

/**
 * Corpus illustrations.
 *
 * The artwork is wildly inconsistent in shape — measured across the 111 races
 * that have a lead image, aspect ratios run from **0.39 to 2.04**, so at a fixed
 * width the rendered height ranges 145px to 612px. No single width tames that,
 * which is why the *shape* picks the treatment rather than the layout imposing
 * one:
 *
 * - **Landscape** (49 leads) is composed wide — Plasmoid is two figures side by
 *   side — and becomes an unreadable stamp in a narrow float. It gets a banner.
 * - **Portrait and square** (62 leads) is what a text wrap is for, and is how a
 *   sourcebook insets a character study.
 *
 * Every image carries real `width`/`height`, so `next/image` reserves the right
 * space and nothing reflows when one loads late.
 *
 * No fill and no frame anywhere: the art is cut out with a genuine alpha channel
 * — every file is a VP8X webp with the alpha flag set — so a background colour
 * shows up as a grey slab behind it and a border boxes in art drawn without one.
 * That also makes the height cap free: `object-fit: contain` letterboxes into
 * transparency, which is just the page.
 */

/**
 * At or above this width/height, art is composed wide enough to need a banner.
 *
 * Set to sit in a genuine gap in the data rather than on a round number. Lead
 * image ratios cluster either side of it — the widest "square-ish" ones are
 * Satyr at 1.121 and Triton at 1.114, the narrowest "landscape" is Minotaur
 * (MOT) at 1.188 — so 1.15 separates them with room on both sides and cannot
 * flip an image from one treatment to the other on a rounding difference.
 *
 * Moving it is the single knob for this: 1.12 would additionally banner Satyr,
 * 1.10 would add Triton and Goblin, 1.00 would add both Centaurs and Locathah.
 */
export const LANDSCAPE_RATIO = 1.15;

/** Unknown dimensions fall back to the float, the safer of the two. */
export function isLandscape(image: ImageEntry): boolean {
  if (!image.width || !image.height) return false;
  return image.width / image.height >= LANDSCAPE_RATIO;
}

export function Illustration({
  image,
  entityName,
  /** Caps the rendered height; the art scales down inside it rather than cropping. */
  maxHeight,
  sizes = "(max-width: 48em) 100vw, 15rem",
  priority = false,
}: {
  image: ImageEntry;
  /** Used for alt text when the image carries no title of its own. */
  entityName: string;
  maxHeight?: number;
  sizes?: string;
  /** Set on the lead image so it is not lazy-loaded above the fold. */
  priority?: boolean;
}) {
  const src = imageUrl(image.href);
  if (!src) return null;

  return (
    <Box lineHeight="0">
      <Image
        src={src}
        /**
         * Derived, not read. **No image in the corpus has an `altText` field**
         * — 50 of 140 carry a `title`, the rest nothing — so the entity's own
         * name is the fallback rather than an empty string.
         */
        alt={image.title ?? entityName}
        width={image.width ?? 400}
        height={image.height ?? 500}
        priority={priority}
        sizes={sizes}
        style={{
          width: "100%",
          height: "auto",
          maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          objectFit: "contain",
        }}
      />
    </Box>
  );
}

/**
 * Wide art, given room to be seen.
 *
 * Centred and height-capped rather than stretched to the column: a 1.2-ratio
 * image at full measure would stand 500px tall and become a wall between the
 * header and the traits.
 */
export function IllustrationBanner({
  image,
  entityName,
  maxHeight = 340,
  priority = false,
}: {
  image: ImageEntry;
  entityName: string;
  maxHeight?: number;
  priority?: boolean;
}) {
  return (
    <Box display="flex" justifyContent="center">
      <Box maxW="100%">
        <Illustration
          image={image}
          entityName={entityName}
          maxHeight={maxHeight}
          sizes="(max-width: 48em) 100vw, 40rem"
          priority={priority}
        />
      </Box>
    </Box>
  );
}

/** Everything after the lead, for the races carrying more than one image. */
export function IllustrationRow({
  images,
  entityName,
}: {
  images: ImageEntry[];
  entityName: string;
}) {
  if (images.length === 0) return null;

  return (
    <Box
      display="grid"
      gridTemplateColumns={{
        base: "1fr",
        sm: `repeat(${Math.min(images.length, 3)}, minmax(0, 1fr))`,
      }}
      gap="4"
      alignItems="center"
    >
      {images.map((image, index) => (
        <Illustration
          key={image.href?.path ?? index}
          image={image}
          entityName={entityName}
          maxHeight={260}
          sizes="(max-width: 48em) 100vw, 12rem"
        />
      ))}
    </Box>
  );
}

/** Pull the image list off an entity's merged fluff, if it has one. */
export function fluffImages(fluff: unknown): ImageEntry[] {
  const images = (fluff as { images?: unknown })?.images;
  if (!Array.isArray(images)) return [];
  return images.filter(
    (image): image is ImageEntry =>
      typeof image === "object" && image !== null && "href" in image,
  );
}

/**
 * The artists to credit, deduplicated.
 *
 * Collected so attribution can live in one place at the foot of the page. Held
 * against each image it would otherwise print wherever its figure happened to
 * end — which, for a floated illustration, is somewhere in the middle of an
 * unrelated trait. 107 of 140 images carry a credit.
 */
export function imageCredits(images: ImageEntry[]): string[] {
  const seen = new Set<string>();
  for (const image of images) {
    const credit = image.credit?.trim();
    if (credit) seen.add(credit);
  }
  return [...seen];
}
