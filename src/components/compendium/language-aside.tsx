import { Stack, Text } from "@chakra-ui/react";
import { Fragment } from "react";
import { Inline } from "@/components/entry";
import type { ReferenceIndex } from "@/lib/content/references";

/** The useful facts language records carry when they have no descriptive prose. */
export function LanguageAsideMetadata({
  data,
  refs,
  selfKey,
  context,
}: {
  data: Record<string, unknown>;
  refs: ReferenceIndex;
  selfKey: string;
  context: string;
}) {
  const speakers = Array.isArray(data["typicalSpeakers"])
    ? data["typicalSpeakers"].filter(
        (speaker): speaker is string => typeof speaker === "string",
      )
    : [];

  if (speakers.length === 0) return null;

  return (
    <Stack gap="1">
      <Text
        fontFamily="ui"
        fontSize="2xs"
        fontWeight="medium"
        letterSpacing="wide"
        textTransform="uppercase"
        color="fg.subtle"
      >
        Typical speakers
      </Text>
      <Text
        fontFamily="body"
        fontSize="sm"
        color="fg"
        textTransform="capitalize"
      >
        {speakers.map((speaker, index) => (
          <Fragment key={index}>
            {index > 0 ? ", " : null}
            <Inline text={speaker} refs={refs} selfKey={selfKey} context={context} />
          </Fragment>
        ))}
      </Text>
    </Stack>
  );
}
