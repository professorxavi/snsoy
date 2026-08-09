import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import {
  Entries,
  Inline,
  type Entry,
  type SpellcastingEntry,
} from "@/components/entry";
import {
  abilityScores,
  formatArmorClass,
  formatChallenge,
  formatConditionImmunities,
  formatCreatureLine,
  formatDefences,
  formatHitPoints,
  formatLanguages,
  formatSaves,
  formatSenses,
  formatSkills,
  formatSpeed,
  legendaryIntro,
  type Ability,
  type AcEntry,
  type AlignmentEntry,
  type ChallengeRating,
  type CreatureType,
  type DefenceEntry,
  type HitPoints,
  type Speeds,
} from "@/lib/content/monsters";
import type { ReferenceIndex } from "@/lib/content/references";
import { sourceHref } from "@/lib/routes";
import type { MonsterDetail } from "@/server/db/queries/monsters";

/**
 * A creature's stat block.
 *
 * Laid out as the books lay it out, because that is the layout its readers have
 * memorised: identity, then the three defensive lines, then the six scores,
 * then the qualities, then everything the creature can do. Someone who opened
 * this mid-encounter is looking for one number and finds it by position.
 *
 * Rendered for the aside, which is 400px wide. That is narrower than the two
 * columns print uses, so this is the one-column form throughout — but nothing
 * is dropped, because a stat block with parts missing is not a stat block.
 *
 * Deliberately without the creature's artwork, which 2,457 of them have. The
 * art is a portrait plate several hundred pixels tall, and putting it above the
 * block would push the armour class below the fold in the panel whose whole
 * purpose is to answer a question without moving the reader.
 */
export function MonsterStatblock({
  monster,
  refs,
}: {
  monster: MonsterDetail;
  refs: ReferenceIndex;
}) {
  const data = monster.data as StatblockData;

  const context = { refs, selfKey: monster.naturalKey, context: monster.name };

  /*
   * Spellcasting is stored apart from the traits and actions but printed among
   * them, and `displayAs` says which — 473 of 1,263 blocks are cast as actions
   * rather than possessed as a trait.
   *
   * The type is asserted rather than trusted: 35 of these blocks carry no
   * `type` at all, and an untyped one reaches the renderer as an unknown block
   * and prints a coverage warning where a creature's spells should be.
   */
  const spellcasting = (data.spellcasting ?? []).map(
    (block): SpellcastingEntry => ({ ...block, type: "spellcasting" }),
  );
  const spellTraits = spellcasting.filter((block) => block.displayAs !== "action");
  const spellActions = spellcasting.filter((block) => block.displayAs === "action");

  /*
   * Every line below is optional — a giant rat has none of them — so the block
   * prints only what the creature actually has rather than a column of em
   * dashes. Senses, Languages and Challenge are the exception: all three are on
   * every stat block in print, and a missing one would read as a rendering
   * fault rather than as a fact about the creature.
   */
  const qualities = [
    { label: "Saving Throws", text: formatSaves(data.save) },
    { label: "Skills", text: formatSkills(data.skill) },
    { label: "Damage Vulnerabilities", text: formatDefences(data.vulnerable, "vulnerable") },
    { label: "Damage Resistances", text: formatDefences(data.resist, "resist") },
    { label: "Damage Immunities", text: formatDefences(data.immune, "immune") },
    { label: "Condition Immunities", text: formatConditionImmunities(data.conditionImmune) },
  ]
    .filter((row) => row.text)
    .concat([
      { label: "Senses", text: formatSenses(data.senses, data.passive) },
      { label: "Languages", text: formatLanguages(data.languages) },
      // `crDisplay` is the string as printed; `data.cr` is the only one that
      // carries a lair or coven rating, so it wins where it is an object.
      { label: "Challenge", text: formatChallenge(data.cr ?? monster.crDisplay) },
    ]);

  return (
    <Stack gap="3" px="4" py="4">
      <Box>
        <Text
          fontFamily="ui"
          fontSize="2xs"
          fontWeight="medium"
          letterSpacing="widest"
          textTransform="uppercase"
          color="fg.subtle"
        >
          <Box asChild _hover={{ color: "brand" }}>
            <NextLink href={sourceHref(monster.sourceId)}>
              {monster.sourceName}
            </NextLink>
          </Box>
          {monster.page ? ` · p. ${monster.page}` : null}
        </Text>

        <Text
          as="h1"
          fontFamily="display"
          fontSize="2xl"
          lineHeight="1.05"
          letterSpacing="tight"
          textWrap="balance"
          mt="1"
        >
          {monster.name}
        </Text>

        <Text
          fontFamily="body"
          fontStyle="italic"
          fontSize="sm"
          color="fg.muted"
          mt="1"
        >
          {formatCreatureLine(data)}
        </Text>
      </Box>

      {/* The three lines that decide whether it can be hurt and how it moves. */}
      <Ruled>
        <StatLine label="Armor Class" value={formatArmorClass(data.ac)} ctx={context} />
        <StatLine label="Hit Points" value={formatHitPoints(data.hp)} ctx={context} />
        <StatLine label="Speed" value={formatSpeed(data.speed)} ctx={context} />
      </Ruled>

      <AbilityTable data={data} />

      <Ruled>
        {qualities.map((row) => (
          <StatLine key={row.label} label={row.label} value={row.text} ctx={context} />
        ))}
      </Ruled>

      {/* Traits are unheaded in print — they are simply what the creature is. */}
      <Block entries={[...(data.trait ?? []), ...spellTraits]} ctx={context} />

      <Block
        heading="Actions"
        intro={asEntries(data.actionNote)}
        entries={[...(data.action ?? []), ...spellActions]}
        ctx={context}
      />
      <Block heading="Bonus Actions" entries={data.bonus} ctx={context} />
      <Block
        heading="Reactions"
        intro={asEntries(data.reactionHeader ?? data.reactionNote)}
        entries={data.reaction}
        ctx={context}
      />
      <Block
        heading="Legendary Actions"
        // Ten creatures state their own; the other 341 get the standard one,
        // which the corpus expects its reader to supply.
        intro={asEntries(data.legendaryHeader) ?? [legendaryIntro(data)]}
        entries={data.legendary}
        ctx={context}
      />
      <Block
        heading="Mythic Actions"
        intro={asEntries(data.mythicHeader)}
        entries={data.mythic}
        ctx={context}
      />

      {/* Optional rules attached to the creature, boxed by the renderer. */}
      {data.variant?.length ? (
        <Box pt="1">
          <Entries entries={data.variant} {...context} />
        </Box>
      ) : null}
    </Stack>
  );
}

/** What the stat block reads off the creature's stored data. */
interface StatblockData extends Partial<Record<Ability, number>> {
  name?: string;
  size?: string[];
  type?: string | CreatureType;
  alignment?: AlignmentEntry[];
  alignmentPrefix?: string;
  ac?: AcEntry[];
  hp?: HitPoints;
  speed?: Speeds;
  save?: Record<string, string>;
  skill?: Record<string, string>;
  senses?: string[];
  passive?: number;
  languages?: string[];
  cr?: ChallengeRating;
  immune?: DefenceEntry[];
  resist?: DefenceEntry[];
  vulnerable?: DefenceEntry[];
  conditionImmune?: string[];
  trait?: Entry[];
  action?: Entry[];
  bonus?: Entry[];
  reaction?: Entry[];
  legendary?: Entry[];
  legendaryActions?: number;
  mythic?: Entry[];
  /*
   * The paragraph above a group. Written as an array of entries by most of the
   * creatures that carry one, and as a bare string by a few, which is why every
   * one of these goes through `asEntries` rather than straight to the renderer.
   */
  actionNote?: Entry[] | string;
  reactionHeader?: Entry[] | string;
  reactionNote?: Entry[] | string;
  legendaryHeader?: Entry[] | string;
  mythicHeader?: Entry[] | string;
  variant?: Entry[];
  spellcasting?: Omit<SpellcastingEntry, "type">[];
  shortName?: string | boolean;
  isNamedCreature?: boolean;
}

interface RenderContext {
  refs: ReferenceIndex;
  selfKey: string;
  context: string;
}

/**
 * A group of stat lines between two rules, as print sets them.
 *
 * The rules are what make a stat block scannable — they are why the eye can
 * find the ability scores without reading anything — so they are structural
 * here rather than decorative, and a group renders nothing when empty so no
 * pair of rules ever closes on nothing.
 */
function Ruled({ children }: { children: ReactNode }) {
  return (
    <Stack
      gap="0.5"
      borderTopWidth="1px"
      borderBottomWidth="1px"
      borderColor="border"
      py="2"
    >
      {children}
    </Stack>
  );
}

/**
 * "**Armor Class** 19 (natural armor)".
 *
 * Run-in rather than in a label column: the values are short and a 400px panel
 * has no width to give away, and print sets them this way for the same reason.
 *
 * The value goes through `Inline` because it is not plain text — 197 creatures
 * cite the spell that raises their AC and others cite the armour they wear, and
 * those are live cross-references.
 */
function StatLine({
  label,
  value,
  ctx,
}: {
  label: string;
  value: string;
  ctx: RenderContext;
}) {
  return (
    <Text fontFamily="body" fontSize="sm" lineHeight="1.55">
      <Text as="span" fontWeight="semibold">
        {label}
      </Text>{" "}
      <Inline text={value} refs={ctx.refs} selfKey={ctx.selfKey} context={ctx.context} />
    </Text>
  );
}

/**
 * The six ability scores, each with the modifier derived from it.
 *
 * Six columns even at 400px. It is the one part of a stat block that is a table
 * in print, read across rather than down, and stacking it into pairs to save
 * width would break the scan it exists to support.
 */
function AbilityTable({ data }: { data: StatblockData }) {
  const scores = abilityScores(data);

  // A handful of stat blocks — templates, mostly — carry no scores at all.
  if (scores.every((entry) => entry.score == null)) return null;

  return (
    <Box
      display="grid"
      gridTemplateColumns="repeat(6, minmax(0, 1fr))"
      gap="1"
      bg="bg.sunken"
      px="2"
      py="2"
      rounded="l1"
    >
      {scores.map((entry) => (
        <Box key={entry.ability} textAlign="center">
          <Text
            fontFamily="ui"
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="wide"
            textTransform="uppercase"
            color="fg.subtle"
          >
            {entry.ability}
          </Text>
          <Text
            fontFamily="body"
            fontSize="sm"
            fontVariantNumeric="tabular-nums"
            lineHeight="1.3"
          >
            {entry.score ?? "—"}
          </Text>
          <Text
            fontFamily="body"
            fontSize="xs"
            fontVariantNumeric="tabular-nums"
            color="fg.muted"
            lineHeight="1.2"
          >
            {entry.modifier ? `(${entry.modifier})` : ""}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/**
 * One headed group of things the creature can do.
 *
 * Renders nothing at all when the creature has no entries of that kind, which
 * is what keeps the caller free to list every group unconditionally — most
 * creatures have only actions, and 351 of 3,628 have legendary ones.
 *
 * The entries themselves go through the shared renderer rather than being
 * printed here: a trait is `{name, entries}`, which is the same run-in shape
 * as an `item`, and its text carries the attack and damage tags that only the
 * renderer knows how to set.
 */
function Block({
  heading,
  intro,
  entries,
  ctx,
}: {
  heading?: string;
  intro?: Entry[];
  entries?: Entry[];
  ctx: RenderContext;
}) {
  if (!entries?.length) return null;

  return (
    <Box>
      {heading ? (
        <Text
          as="h2"
          fontFamily="display"
          fontSize="md"
          letterSpacing="tight"
          borderBottomWidth="1px"
          borderColor="border.emphasized"
          pb="0.5"
          mb="2"
        >
          {heading}
        </Text>
      ) : null}

      {intro?.length ? (
        <Box mb="2">
          <Entries entries={intro} {...ctx} />
        </Box>
      ) : null}

      {/*
        Each entry is given the `item` shape explicitly rather than passed as
        it is stored. A trait is `{name, entries}` with no `type` at all, which
        the renderer would otherwise treat as an unknown block and report as a
        coverage gap on every creature in the corpus.
      */}
      <Entries
        entries={entries.map((entry) => asItem(entry))}
        {...ctx}
      />
    </Box>
  );
}

/** A group's introduction, however the creature happens to store it. */
function asEntries(value: Entry[] | string | undefined): Entry[] | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return [value];
  return value.length ? value : undefined;
}

/**
 * A trait or action as the renderer's run-in `item`.
 *
 * Anything that already declares a type is left alone — a spellcasting block
 * arrives here typed and has its own treatment.
 */
function asItem(entry: Entry): Entry {
  if (typeof entry !== "object" || entry === null) return entry;
  if ("type" in entry && entry.type) return entry;

  const named = entry as { name?: string; entries?: Entry[] };
  return { type: "item", name: named.name, entries: named.entries };
}
