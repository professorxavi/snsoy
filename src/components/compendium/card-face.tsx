import { Box } from "@chakra-ui/react";
import { Illustration } from "@/components/compendium/entity-image";
import { isImageEntry } from "@/lib/content/media";

/**
 * A card's face, printed under whatever the card says.
 *
 * The one place in the compendium where artwork is part of the answer rather
 * than beside it. Every one of the 656 cards carries a face, and 67 of them —
 * the Deck of Illusions among them — carry no text at all, so a panel without
 * the picture would open on a name and a source line and nothing else.
 *
 * Under the text, not above it, for the same reason a creature's portrait is
 * left out entirely: the panel is 400px wide and a portrait plate at the top
 * would push what the card *does* below the fold.
 */
export function CardFace({ face, name }: { face: unknown; name: string }) {
  if (!isImageEntry(face)) return null;

  return (
    <Box maxW="14rem">
      <Illustration
        image={face}
        entityName={name}
        sizes="(max-width: 48em) 60vw, 14rem"
      />
    </Box>
  );
}
