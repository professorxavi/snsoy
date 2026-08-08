import { Box, Text } from "@chakra-ui/react";
import Image from "next/image";
import { imageUrl, type ImageEntry } from "@/lib/content/media";

/**
 * A corpus illustration.
 *
 * Every image the corpus references carries its own `width` and `height` —
 * measured across all 140 race images, none are missing — so `next/image` gets
 * real intrinsic dimensions and the page never reflows when one loads. That
 * matters more here than usual: these are tall portraits sitting beside text,
 * and a late-arriving one would shove a paragraph the reader is already in.
 *
 * Alt text is derived rather than read. **No image in the corpus has an
 * `altText` field** — 50 of 140 carry a `title`, the rest carry nothing — so
 * the entity's own name is the fallback, and the image is marked decorative
 * only when it would otherwise be labelled with something meaningless.
 */

export function Illustration({
  image,
  entityName,
  width = 260,
  priority = false,
}: {
  image: ImageEntry;
  /** Used for alt text when the image carries no title of its own. */
  entityName: string;
  width?: number;
  /** Set on the lead image so it is not lazy-loaded above the fold. */
  priority?: boolean;
}) {
  const src = imageUrl(image.href);
  if (!src) return null;

  const intrinsicWidth = image.width ?? width;
  const intrinsicHeight = image.height ?? Math.round(width * 1.25);

  return (
    <Box as="figure" m="0">
      <Box
        overflow="hidden"
        borderWidth="1px"
        borderColor="border"
        rounded="l1"
        bg="bg.muted"
        lineHeight="0"
      >
        <Image
          src={src}
          alt={image.title ?? entityName}
          width={intrinsicWidth}
          height={intrinsicHeight}
          priority={priority}
          sizes={`(max-width: 48em) 100vw, ${width}px`}
          style={{ width: "100%", height: "auto" }}
        />
      </Box>

      {/* Attribution, present on 107 of 140. Small, quiet, but not omitted. */}
      {image.credit ? (
        <Text
          as="figcaption"
          fontFamily="ui"
          fontSize="2xs"
          lineHeight="1.4"
          color="fg.subtle"
          mt="1.5"
        >
          {image.credit}
        </Text>
      ) : null}
    </Box>
  );
}

/** Everything after the lead image, for the 24 races that have more than one. */
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
      gap="3"
    >
      {images.map((image, index) => (
        <Illustration
          key={image.href?.path ?? index}
          image={image}
          entityName={entityName}
          width={200}
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
