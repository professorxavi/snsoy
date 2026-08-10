"use server";

import { Box, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { ClassAside } from "@/components/compendium/class-aside";
import { GenericAside } from "@/components/compendium/generic-aside";
import { ItemDetail } from "@/components/compendium/item-detail";
import { LanguageAside } from "@/components/compendium/language-aside";
import { MonsterStatblock } from "@/components/compendium/monster-statblock";
import { RaceAside } from "@/components/compendium/race-aside";
import { SpellDetail } from "@/components/compendium/spell-detail";
import { ASIDE_IGNORE_ATTR, isAsideType, type AsideType } from "@/lib/aside";
import { actionTimeLabel } from "@/lib/content/actions";
import { characterOptionSummary } from "@/lib/content/character-options";
import { featPrerequisite } from "@/lib/content/feats";
import { itemGroupTags } from "@/lib/content/items";
import {
  featureTypeSummary,
  formatPrerequisites,
} from "@/lib/content/optional-features";
import { checkName } from "@/lib/content/skills";
import { ruleTypeLabel } from "@/lib/content/variant-rules";
import { collectReferences } from "@/lib/content/references";
import { hrefFor, type BrowsableType } from "@/lib/routes";
import { getBackground } from "@/server/db/queries/backgrounds";
import { getClass } from "@/server/db/queries/classes";
import { getFeat } from "@/server/db/queries/feats";
import { getGeneric, getLanguageGroup } from "@/server/db/queries/generic";
import { getOptionalFeature } from "@/server/db/queries/optional-features";
import {
  getItem,
  itemVocabulary,
  type ItemEntityType,
} from "@/server/db/queries/items";
import { getMonster } from "@/server/db/queries/monsters";
import { getRace } from "@/server/db/queries/races";
import { resolveReferences } from "@/server/db/queries/references";
import { getSpell } from "@/server/db/queries/spells";

type AsideLoader = (source: string, slug: string) => Promise<ReactNode>;
type GenericAsideType = Extract<
  AsideType,
  | "skill"
  | "condition"
  | "sense"
  | "status"
  | "action"
  | "variantrule"
  | "charoption"
>;
type GenericAsideConfig = {
  noun: string;
  subtitle?: (data: Record<string, unknown>, name: string) => string | null;
};

const GENERIC_ASIDE_TYPES: Record<GenericAsideType, GenericAsideConfig> = {
  skill: {
    noun: "skill",
    subtitle: (data, name) =>
      checkName(typeof data["ability"] === "string" ? data["ability"] : null, name),
  },
  condition: { noun: "condition" },
  sense: { noun: "sense" },
  status: { noun: "status" },
  action: {
    noun: "action",
    subtitle: (data: Record<string, unknown>) => actionTimeLabel(data["time"]),
  },
  variantrule: {
    noun: "variant rule",
    subtitle: (data: Record<string, unknown>) => ruleTypeLabel(data["ruleType"]),
  },
  charoption: {
    noun: "character option",
    // The kind is the only thing separating a dark gift from a rune, and the
    // option's own text never names it.
    subtitle: (data: Record<string, unknown>) =>
      characterOptionSummary(data["optionType"]),
  },
};

const ASIDE_LOADERS: Record<AsideType, AsideLoader> = {
  spell: spellAside,
  class: classAside,
  race: raceAside,
  skill: (source, slug) => genericAside("skill", source, slug),
  condition: (source, slug) => genericAside("condition", source, slug),
  monster: monsterAside,
  item: (source, slug) => itemAside("item", source, slug),
  baseitem: (source, slug) => itemAside("baseitem", source, slug),
  itemGroup: (source, slug) => itemAside("itemGroup", source, slug),
  sense: (source, slug) => genericAside("sense", source, slug),
  status: (source, slug) => genericAside("status", source, slug),
  action: (source, slug) => genericAside("action", source, slug),
  language: languageAside,
  variantrule: (source, slug) => genericAside("variantrule", source, slug),
  charoption: (source, slug) => genericAside("charoption", source, slug),
  background: backgroundAside,
  feat: featAside,
  optionalfeature: optionalFeatureAside,
};

/**
 * One entity, rendered on the server for the aside.
 *
 * Opening something is a call, not a navigation: the caller hands this function
 * to the client already bound, the client awaits it and drops the returned tree
 * into the panel. Nothing about the URL changes, so reading twenty entities
 * leaves the history stack exactly as it found it.
 *
 * Returning rendered JSX rather than JSON is what lets `SpellDetail`, the class
 * aside and the whole `Entries` renderer stay server components: the reply is an
 * RSC payload, the same kind a page streams, so none of it reaches the bundle.
 *
 * **Bind this in a server component.** Importing it into a client component
 * instead leaves the returned tree's client modules out of the client manifest,
 * and `next dev` then fails to resolve Chakra and `next/link` at reply time. A
 * production build papers over it, so the breakage shows up only locally.
 *
 * Types not handled here are never asked for — `ASIDE_TYPES` in `aside-links`
 * decides what gets intercepted, and the two lists have to agree.
 */
export async function openEntityAside(
  type: BrowsableType,
  source: string,
  slug: string,
): Promise<ReactNode> {
  if (!isAsideType(type)) {
    return <AsideMessage>Nothing to show for this yet.</AsideMessage>;
  }

  return ASIDE_LOADERS[type](source, slug);
}

async function spellAside(source: string, slug: string): Promise<ReactNode> {
  const spell = await getSpell(source, slug);

  // An action cannot call `notFound()` — there is no route to fail. The aside
  // says so in place instead, and the page underneath is untouched.
  if (!spell) return <AsideMessage>No such spell.</AsideMessage>;

  // The spell's own references only. What refers *to* it belongs on the page —
  // see `SpellDetail` — so the aside does not pay for the second query either.
  const refs = await resolveReferences(collectReferences(spell.data));

  return (
    <>
      <SpellDetail spell={spell} refs={refs} density="aside" />
      <FullPageLink
        href={hrefFor({
          entityType: "spell",
          sourceId: spell.sourceId,
          slug: spell.slug,
        })}
      >
        Open full page →
      </FullPageLink>
    </>
  );
}

async function classAside(source: string, slug: string): Promise<ReactNode> {
  const found = await getClass(source, slug);
  if (!found) return <AsideMessage>No such class.</AsideMessage>;

  // Only the description is rendered here, so only its references are needed —
  // resolving the whole class would mean every feature and subclass for text
  // the aside does not print.
  const refs = await resolveReferences(collectReferences(found.fluff));

  return <ClassAside found={found} refs={refs} />;
}

async function raceAside(source: string, slug: string): Promise<ReactNode> {
  const race = await getRace(source, slug);
  if (!race) return <AsideMessage>No such race.</AsideMessage>;

  // Both blobs, because a race's prose is in fluff for 98 of the 134 and its
  // trait names are in `data`. The parent's only: the aside prints no subraces,
  // so resolving theirs would be up to thirteen more for text it omits.
  const refs = await resolveReferences(
    collectReferences([race.data, race.fluff]),
  );

  return <RaceAside race={race} refs={refs} />;
}

/**
 * A creature, in full. Like a skill or a condition it has no page behind it, so
 * this is not a preview of anywhere — it is the stat block itself.
 *
 * The largest thing the aside answers for, and the reason it was worth
 * building: 15,887 `{@creature}` tags point into the reader, more than spells,
 * items and conditions together, and every one of them was a dead link until
 * this case existed.
 */
async function monsterAside(source: string, slug: string): Promise<ReactNode> {
  const monster = await getMonster(source, slug);
  if (!monster) return <AsideMessage>No such creature.</AsideMessage>;

  /*
   * `data` only. A creature's fluff is its lore and its artwork, neither of
   * which the stat block prints — resolving it would mean a second blob and its
   * references for text that never renders.
   */
  const refs = await resolveReferences(collectReferences(monster.data));

  return <MonsterStatblock monster={monster} refs={refs} />;
}

/**
 * An item, in full — magic item, mundane gear or item group alike.
 *
 * All three types share this because a single `{@item}` tag covers all three,
 * and a reader following one has no reason to care which they landed on. Like a
 * creature, an item has no page behind it, so this is the whole of what is
 * shown rather than a preview of somewhere else.
 *
 * The vocabulary is fetched alongside the item because the corpus stores an
 * item's type and properties as abbreviations and the column meant to hold the
 * resolved names was never populated — see `itemVocabulary`.
 */
async function itemAside(
  type: ItemEntityType,
  source: string,
  slug: string,
): Promise<ReactNode> {
  const item = await getItem(type, source, slug);
  if (!item) return <AsideMessage>No such item.</AsideMessage>;

  /*
   * `data`, plus the group's members. A group lists what it covers as bare
   * names rather than tags, so `itemGroupTags` puts them in the form the
   * resolver reads — without it the 73 groups would print dead text where
   * their whole purpose is to point somewhere.
   */
  const [refs, vocabulary] = await Promise.all([
    resolveReferences(
      collectReferences([item.data, itemGroupTags(item.data as { items?: string[] })]),
    ),
    itemVocabulary(),
  ]);

  return <ItemDetail item={item} refs={refs} vocabulary={vocabulary.properties} />;
}

/**
 * One of the `generic_entities` types, in full.
 *
 * Like a skill or a condition, these have no page behind them, so the panel is
 * the whole of what is shown rather than a preview of somewhere else.
 *
 * No field map is passed. The map exists so a *list* can put a JSON value in a
 * column; here the entity's whole blob is already in hand, so `subtitle` reads
 * what it needs straight off it — an action's `time` arrives parsed here and as
 * JSON text in a table cell, which is the difference the two formatters carry.
 */
async function genericAside(
  type: GenericAsideType,
  source: string,
  slug: string,
): Promise<ReactNode> {
  const { noun, subtitle } = GENERIC_ASIDE_TYPES[type];
  const entity = await getGeneric(type, source, slug, {});
  if (!entity) return <AsideMessage>No such {noun}.</AsideMessage>;

  const refs = await resolveReferences(collectReferences(entity.data));

  return (
    <GenericAside
      entity={entity}
      refs={refs}
      subtitle={subtitle?.(entity.data, entity.name)}
    />
  );
}

/**
 * The three player options with a table of their own.
 *
 * Each prints in full for the same reason the short rules do — there is no page
 * behind it — but each reaches its own query module rather than the generic
 * one, because all three predate `generic_entities` and were given typed
 * columns by ingest.
 *
 * What differs between them is one line. A background's own text opens with its
 * proficiencies, so it needs no subtitle; a feat's never states its
 * prerequisite, which is structured data beside the prose and is the first
 * thing a player checks; an optional feature needs both what kind of choice it
 * is and what it costs to take.
 */
async function backgroundAside(source: string, slug: string): Promise<ReactNode> {
  const background = await getBackground(source, slug);
  if (!background) return <AsideMessage>No such background.</AsideMessage>;

  const refs = await resolveReferences(collectReferences(background.data));

  return <GenericAside entity={background} refs={refs} />;
}

async function featAside(source: string, slug: string): Promise<ReactNode> {
  const feat = await getFeat(source, slug);
  if (!feat) return <AsideMessage>No such feat.</AsideMessage>;

  const refs = await resolveReferences(collectReferences(feat.data));
  const prerequisite = featPrerequisite(feat.prerequisites);

  return (
    <GenericAside
      entity={feat}
      refs={refs}
      subtitle={prerequisite ? `Prerequisite: ${prerequisite}` : null}
    />
  );
}

async function optionalFeatureAside(
  source: string,
  slug: string,
): Promise<ReactNode> {
  const feature = await getOptionalFeature(source, slug);
  if (!feature) return <AsideMessage>No such option.</AsideMessage>;

  const refs = await resolveReferences(collectReferences(feature.data));
  const prerequisite = formatPrerequisites(feature.prerequisites);
  const kind = featureTypeSummary(feature.featureTypes);

  return (
    <GenericAside
      entity={feature}
      refs={refs}
      subtitle={prerequisite ? `${kind} · Prerequisite: ${prerequisite}` : kind}
    />
  );
}

async function languageAside(source: string, slug: string): Promise<ReactNode> {
  const language = await getLanguageGroup(source, slug);
  if (!language) return <AsideMessage>No such language.</AsideMessage>;

  const refs = await resolveReferences(
    collectReferences(language.variants.map((variant) => variant.data)),
  );

  return <LanguageAside language={language} refs={refs} />;
}

/**
 * The way out of the aside into the full page. It matters more than it did when
 * the aside was a route: the URL no longer changes, so this is the only way to
 * reach a shareable link for what is open.
 */
function FullPageLink({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  if (!href) return null;

  return (
    <Box px="4" pb="6" {...{ [ASIDE_IGNORE_ATTR]: "" }}>
      <Text
        asChild
        fontFamily="ui"
        fontSize="2xs"
        letterSpacing="wide"
        textTransform="uppercase"
        color="brand"
        _hover={{ textDecoration: "underline" }}
      >
        <NextLink href={href}>{children}</NextLink>
      </Text>
    </Box>
  );
}

function AsideMessage({ children }: { children: ReactNode }) {
  return (
    <Box px="4" py="6">
      <Text fontFamily="body" fontSize="sm" color="fg.muted">
        {children}
      </Text>
    </Box>
  );
}
