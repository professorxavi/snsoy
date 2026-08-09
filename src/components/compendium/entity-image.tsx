import { Box } from "@chakra-ui/react";
import Image from "next/image";
import { imageUrl, type ImageEntry } from "@/lib/content/media";

/**
 * Entity illustrations.
 *
 * Aspect ratios range from 0.39 to 2.04, so a fixed width would vary rendered
 * height by 4x. Shape picks the treatment instead: landscape art gets a banner,
 * portrait and square art floats with text wrapped around it.
 *
 * No background or border, because the images have a real alpha channel and
 * either would show as a slab behind cut-out art.
 */

/**
 * Width/height at or above which art gets a banner instead of a float. 1.15
 * sits in a gap in the data (nearest ratios are 1.121 and 1.188), so no image
 * flips treatment on a rounding difference.
 */
export const LANDSCAPE_RATIO = 1.15;

/** Unknown dimensions fall back to the float. */
export function isLandscape(image: ImageEntry): boolean {
  if (!image.width || !image.height) return false;
  return image.width / image.height >= LANDSCAPE_RATIO;
}

export function Illustration({
  image,
  entityName,
  /** Caps rendered height. The art scales down rather than cropping. */
  maxHeight,
  sizes = "(max-width: 48em) 100vw, 15rem",
  priority = false,
}: {
  image: ImageEntry;
  /** Used for alt text when the image carries no title of its own. */
  entityName: string;
  maxHeight?: number;
  sizes?: string;
  /** Set on above-the-fold images to skip lazy loading. */
  priority?: boolean;
}) {
  const src = imageUrl(image.href);
  if (!src) return null;

  return (
    <Box lineHeight="0">
      <Image
        src={src}
        // No image carries `altText` and most lack a `title`, so fall back to
        // the entity name.
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
 * Art for the top corner of a page, whole and at size.
 *
 * Nothing is cropped. The figure is the picture — every one of these is a
 * character standing on a wash of scenery — so it is scaled to fit and given
 * the room to be seen, out in the margin where the reading measure is not.
 *
 * It runs down past the header and beside the opening paragraphs, so the foot
 * of it is masked away to nothing rather than ending on a line. That, and the
 * soft edges the art already has, are what let text sit in front of it.
 *
 * Hidden below `lg`, where there is no margin to stand it in. Callers show the
 * art some other way at those widths.
 */
export function IllustrationPlate({
  image,
  entityName,
  side = "right",
  priority = false,
}: {
  image: ImageEntry;
  entityName: string;
  /** The corner it stands in. Decides which way it dissolves into the page. */
  side?: "left" | "right";
  priority?: boolean;
}) {
  const src = imageUrl(image.href);
  if (!src) return null;

  const ratio = image.width && image.height ? image.width / image.height : 0.85;

  return (
    /*
     * Two masks, one per axis, on two elements — the same result as compositing
     * them and no dependence on `mask-composite`.
     *
     * The plate is wider than the margin it stands in, so its inner edge runs
     * over the column. That edge is dissolved rather than cropped: the art is
     * whole, at size, and simply stops existing by the time it reaches a line
     * of text. The foot goes the same way, since the picture is taller than the
     * header it sits beside and would otherwise end on a hard line across the
     * opening paragraphs.
     */
    <Box
      w="100%"
      lineHeight="0"
      css={{
        maskImage: "linear-gradient(to bottom, #000 55%, transparent 95%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 55%, transparent 95%)",
      }}
    >
      <Box
        css={(() => {
          // Away from the corner it stands in: a plate on the right keeps its
          // right edge and dissolves leftward, into the column.
          const inward = side === "right" ? "left" : "right";
          const fade = `linear-gradient(to ${inward}, #000 55%, transparent 92%)`;
          return { maskImage: fade, WebkitMaskImage: fade };
        })()}
      >
        <Image
          src={src}
          alt={image.title ?? entityName}
          width={image.width ?? 800}
          height={image.height ?? Math.round(800 / ratio)}
          priority={priority}
          sizes="(max-width: 62em) 0px, (max-width: 96em) 24rem, 30rem"
          style={{ width: "100%", height: "auto" }}
        />
      </Box>
    </Box>
  );
}

/**
 * Wide art, centred and height-capped rather than stretched to the column
 * width, where a 1.2-ratio image would stand 500px tall.
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

/** Everything after the lead image. */
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

/** Artists to credit, deduplicated, for a single attribution line per page. */
export function imageCredits(images: ImageEntry[]): string[] {
  const seen = new Set<string>();
  for (const image of images) {
    const credit = image.credit?.trim();
    if (credit) seen.add(credit);
  }
  return [...seen];
}
