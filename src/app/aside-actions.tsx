"use server";

import { Box, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { ClassAside } from "@/components/compendium/class-aside";
import { ConditionAside } from "@/components/compendium/condition-aside";
import { GenericAside } from "@/components/compendium/generic-aside";
import { ItemDetail } from "@/components/compendium/item-detail";
import { MonsterStatblock } from "@/components/compendium/monster-statblock";
import { RaceAside } from "@/components/compendium/race-aside";
import { SkillAside } from "@/components/compendium/skill-aside";
import { SpellDetail } from "@/components/compendium/spell-detail";
import { ASIDE_IGNORE_ATTR } from "@/lib/aside";
import { actionTimeLabel } from "@/lib/content/actions";
import { itemGroupTags } from "@/lib/content/items";
import { languageSubtitle } from "@/lib/content/languages";
import { ruleTypeLabel } from "@/lib/content/variant-rules";
import { collectReferences } from "@/lib/content/references";
import { hrefFor, type BrowsableType } from "@/lib/routes";
import { getClass } from "@/server/db/queries/classes";
import { getCondition } from "@/server/db/queries/conditions";
import { getGeneric } from "@/server/db/queries/generic";
import {
  getItem,
  itemVocabulary,
  type ItemEntityType,
} from "@/server/db/queries/items";
import { getMonster } from "@/server/db/queries/monsters";
import { getRace } from "@/server/db/queries/races";
import { resolveReferences } from "@/server/db/queries/references";
import { getSkill } from "@/server/db/queries/skills";
import { getSpell } from "@/server/db/queries/spells";

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
  switch (type) {
    case "spell":
      return spellAside(source, slug);
    case "class":
      return classAside(source, slug);
    case "race":
      return raceAside(source, slug);
    case "skill":
      return skillAside(source, slug);
    case "condition":
      return conditionAside(source, slug);
    case "monster":
      return monsterAside(source, slug);
    case "item":
    case "baseitem":
    case "itemGroup":
      return itemAside(type, source, slug);
    case "sense":
      return genericAside(type, source, slug, "sense");
    case "status":
      return genericAside(type, source, slug, "status");
    case "action":
      return genericAside(type, source, slug, "action", (data) =>
        actionTimeLabel(data["time"]),
      );
    case "language":
      return genericAside(type, source, slug, "language", (data) =>
        languageSubtitle(data),
      );
    case "variantrule":
      return genericAside(type, source, slug, "variant rule", (data) =>
        ruleTypeLabel(data["ruleType"]),
      );
    default:
      return <AsideMessage>Nothing to show for this yet.</AsideMessage>;
  }
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

/*
 * Skills and conditions have no page behind them, so these two are not previews
 * of somewhere else — they are the whole of what we show. Both are short enough
 * to print entire, which is the reason they were given no page.
 */

async function skillAside(source: string, slug: string): Promise<ReactNode> {
  const skill = await getSkill(source, slug);
  if (!skill) return <AsideMessage>No such skill.</AsideMessage>;

  const refs = await resolveReferences(collectReferences(skill.data));

  return <SkillAside skill={skill} refs={refs} />;
}

async function conditionAside(source: string, slug: string): Promise<ReactNode> {
  const condition = await getCondition(source, slug);
  if (!condition) return <AsideMessage>No such condition.</AsideMessage>;

  // Worth resolving here where it is not for a skill: conditions cite each
  // other by name — four of them open by saying the creature is incapacitated
  // — and those tags are what let the aside stack one on the next.
  const refs = await resolveReferences(collectReferences(condition.data));

  return <ConditionAside condition={condition} refs={refs} />;
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
 * Like a skill or a condition — which are the same shape and will fold into
 * this — these have no page behind them, so the panel is the whole of what is
 * shown rather than a preview of somewhere else.
 *
 * No field map is passed. The map exists so a *list* can put a JSON value in a
 * column; here the entity's whole blob is already in hand, so `subtitle` reads
 * what it needs straight off it — an action's `time` arrives parsed here and as
 * JSON text in a table cell, which is the difference the two formatters carry.
 */
async function genericAside(
  type: BrowsableType,
  source: string,
  slug: string,
  /** What to call it when there is nothing there: "No such sense." */
  noun: string,
  /** The one line under the name, for the types that have a second fact. */
  subtitle?: (data: Record<string, unknown>) => string | null,
): Promise<ReactNode> {
  const entity = await getGeneric(type, source, slug, {});
  if (!entity) return <AsideMessage>No such {noun}.</AsideMessage>;

  const refs = await resolveReferences(collectReferences(entity.data));

  return (
    <GenericAside
      entity={entity}
      refs={refs}
      subtitle={subtitle?.(entity.data)}
    />
  );
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
