import { Stack, Text } from "@chakra-ui/react";
import { Fragment } from "react";
import { Entries, Inline, type Entry } from "@/components/entry";
import { languageKind, languageScript } from "@/lib/content/languages";
import type { ReferenceIndex } from "@/lib/content/references";
import type { LanguageGroup, LanguageVariant } from "@/server/db/queries/generic";

type Fact = "type" | "script" | "typicalSpeakers";
const FACTS: readonly Fact[] = ["type", "script", "typicalSpeakers"];

export function LanguageAside({ language, refs }: { language: LanguageGroup; refs: ReferenceIndex }) {
  const shared = FACTS.filter((fact) => same(language.variants, fact));

  return (
    <Stack gap="4" px="4" py="4">
      <Stack gap="1">
        <Text fontFamily="ui" fontSize="2xs" fontWeight="medium" letterSpacing="widest" textTransform="uppercase" color="fg.subtle">
          {language.sourceIds.join(", ")}
        </Text>
        <Text as="h1" fontFamily="display" fontSize="2xl" lineHeight="1.05" letterSpacing="tight">
          {language.name}
        </Text>
      </Stack>

      {shared.length > 0 ? <Facts facts={shared} variant={language.variants[0]!} refs={refs} /> : null}

      {language.variants.map((variant) => {
        const differing = FACTS.filter((fact) => !shared.includes(fact));
        const entries = entriesOf(variant);
        if (differing.length === 0 && entries.length === 0) return null;
        return (
          <Stack key={variant.naturalKey} gap="3" pt="2" borderTopWidth="1px" borderColor="border">
            <Text as="h2" fontFamily="ui" fontSize="2xs" fontWeight="medium" letterSpacing="wide" textTransform="uppercase" color="fg.subtle">
              {variant.sourceName}
            </Text>
            {differing.length > 0 ? <Facts facts={differing} variant={variant} refs={refs} /> : null}
            <Entries entries={entries} refs={refs} selfKey={variant.naturalKey} context={language.name} />
          </Stack>
        );
      })}
    </Stack>
  );
}

function Facts({ facts, variant, refs }: { facts: Fact[]; variant: LanguageVariant; refs: ReferenceIndex }) {
  return (
    <Stack gap="2">
      {facts.map((fact) => {
        const label = fact === "type" ? "Kind" : fact === "script" ? "Script" : "Typical speakers";
        const value = fact === "type" ? languageKind(stringOf(variant.data[fact])) : fact === "script" ? languageScript(stringOf(variant.data[fact])) : null;
        const speakers = speakersOf(variant);
        if (fact === "typicalSpeakers" && speakers.length === 0) return null;
        return <Stack key={fact} gap="0"><Text fontFamily="ui" fontSize="2xs" fontWeight="medium" letterSpacing="wide" textTransform="uppercase" color="fg.subtle">{label}</Text><Text fontFamily="body" fontSize="sm" color="fg" textTransform={fact === "typicalSpeakers" ? "capitalize" : undefined}>{fact === "typicalSpeakers" ? speakers.map((speaker, index) => <Fragment key={index}>{index > 0 ? ", " : null}<Inline text={speaker} refs={refs} selfKey={variant.naturalKey} context={variant.name} /></Fragment>) : value}</Text></Stack>;
      })}
    </Stack>
  );
}

function same(variants: LanguageVariant[], fact: Fact): boolean {
  const first = JSON.stringify(variants[0]!.data[fact]);
  return variants.every((variant) => JSON.stringify(variant.data[fact]) === first);
}
function stringOf(value: unknown): string | null { return typeof value === "string" ? value : null; }
function speakersOf(variant: LanguageVariant): string[] { const value = variant.data.typicalSpeakers; return Array.isArray(value) ? value.filter((speaker): speaker is string => typeof speaker === "string") : []; }
function entriesOf(variant: LanguageVariant): Entry[] { const value = variant.data.entries; return Array.isArray(value) ? value as Entry[] : []; }
