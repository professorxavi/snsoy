import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { AsideIdentity } from "@/components/compendium/aside-identity";
import { Entries, Inline, type Entry } from "@/components/entry";
import {
  applyBaseName,
  baseItemName,
  formatDamage,
  formatItemArmorClass,
  formatItemTypeLine,
  formatItemValue,
  formatProperties,
  formatStrengthRequirement,
  formatWeight,
  itemGroupTags,
} from "@/lib/content/items";
import type { ReferenceIndex } from "@/lib/content/references";
import { walkStrings } from "@/lib/content/walk";
import type { ItemDetail as ItemDetailRow } from "@/server/db/queries/items";

/**
 * An item in the aside — which is the only place an item is rendered.
 *
 * The same bargain the skill and condition asides strike, for the same reason:
 * an item is a printed line, a handful of numbers and a paragraph or two, so
 * the panel prints all of it and there is no page behind it to link on to.
 * 8,182 cross-references reach items from book text, and every one of them was
 * a dead link until this existed.
 *
 * The numbers sit between rules, as an equipment table sets them, and only the
 * ones the item actually has are printed — a Staff of Fire has no weight and no
 * price, and a column of em dashes would say nothing about it.
 *
 * Deliberately without artwork, which 523 items have, on the same grounds as
 * the stat block: a plate at the top of a 400px panel pushes what the reader
 * came for below the fold.
 */
export function ItemDetail({
  item,
  refs,
  vocabulary,
}: {
  item: ItemDetailRow;
  refs: ReferenceIndex;
  /** Property abbreviation to name, from the books' own vocabulary. */
  vocabulary: ReadonlyMap<string, string>;
}) {
  const data = item.data as ItemData;

  const context = { refs, selfKey: item.naturalKey, context: item.name };

  const properties = formatProperties(item.properties, vocabulary, data);

  /*
   * Range is normally spoken for by a property — thrown and ammunition both
   * name it — so it gets a line of its own only where no property carried it.
   * Three items in the books are in that position.
   */
  const carriedRange = /\(range /.test(properties);

  const stats = [
    { label: "Damage", text: formatDamage(data.dmg1, data.dmgType) },
    { label: "Range", text: carriedRange ? null : (data.range ?? null) },
    { label: "Properties", text: properties || null },
    {
      label: "Armor Class",
      text: formatItemArmorClass(item.armorClass, item.itemType, data),
    },
    { label: "Strength", text: formatStrengthRequirement(data.strength) },
    { label: "Stealth", text: data.stealth ? "Disadvantage" : null },
    {
      label: "Cost",
      text: item.valueCp == null ? null : formatItemValue(item.valueCp),
    },
    {
      label: "Weight",
      text: item.weightLb == null ? null : formatWeight(item.weightLb),
    },
  ].filter((row): row is { label: string; text: string } => Boolean(row.text));

  const typeLine = formatItemTypeLine({
    typeName: item.typeName,
    baseName: baseItemName(data),
    rarity: item.rarity,
    reqAttune: data.reqAttune,
  });

  const members = itemGroupTags(data);

  /*
   * Four items reach here with `{=baseName}` placeholders still standing —
   * ingest expands the magic variant but not the prose it inherited — and
   * without this they print "{=baseName/l} of slaying" where a word belongs.
   * Cheap to skip: the walk only runs for an item built on another one.
   */
  const entries = data._baseName
    ? walkStrings(data.entries, (text) => applyBaseName(text, data._baseName!))
    : data.entries;

  return (
    <Stack gap="4" px="4" py="4">
      <AsideIdentity
        sourceId={item.sourceId}
        sourceName={item.sourceName}
        page={item.page}
        name={item.name}
      >
        {typeLine ? (
          <Text
            fontFamily="body"
            fontStyle="italic"
            fontSize="sm"
            color="fg.muted"
            mt="1"
          >
            {typeLine}
          </Text>
        ) : null}
      </AsideIdentity>

      {stats.length > 0 ? (
        <Stack
          gap="0.5"
          borderTopWidth="1px"
          borderBottomWidth="1px"
          borderColor="border"
          py="2"
        >
          {stats.map((row) => (
            <StatLine key={row.label} label={row.label} value={row.text} />
          ))}
        </Stack>
      ) : null}

      <Entries entries={entries} {...context} />

      {members.length > 0 ? (
        <Box>
          <Heading>Covers</Heading>
          <Stack gap="0.5">
            {members.map((tag) => (
              <Text key={tag} fontFamily="body" fontSize="sm" lineHeight="1.55">
                <Inline text={tag} {...context} />
              </Text>
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}

/** What the panel reads off the item's stored data. */
interface ItemData {
  entries?: Entry[];
  reqAttune?: boolean | string;
  baseItem?: string;
  _baseName?: string;
  dmg1?: string;
  dmg2?: string;
  dmgType?: string;
  range?: string;
  strength?: string;
  stealth?: boolean;
  dexterityMax?: number | null;
  /** An item group's members, as bare names rather than tags. */
  items?: string[];
}

/**
 * "**Damage** 1d8 slashing".
 *
 * Run-in rather than in a label column, for the reason the stat block's lines
 * are: the values are short and a 400px panel has no width to give away.
 */
function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <Text fontFamily="body" fontSize="sm" lineHeight="1.55">
      <Text as="span" fontWeight="semibold">
        {label}
      </Text>{" "}
      {value}
    </Text>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <Text
      as="h2"
      fontFamily="ui"
      fontSize="2xs"
      fontWeight="semibold"
      letterSpacing="widest"
      textTransform="uppercase"
      color="fg.subtle"
      mb="1.5"
    >
      {children}
    </Text>
  );
}
