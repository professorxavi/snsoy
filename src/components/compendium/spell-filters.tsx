"use client";

import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { levelLabel, schoolName } from "@/lib/content/spells";
import type { FacetOption, SpellFacets } from "@/lib/content/spell-browse";

/**
 * The spell filter rail.
 *
 * **Every option is always shown.** One that would return nothing is disabled,
 * not removed — a rail whose contents rearrange as you filter is a rail you
 * cannot learn, and a vanished option is indistinguishable from one that never
 * existed. Disabling keeps the shape of the data visible while still saying
 * clearly that this route is closed.
 *
 * Counts are computed against the other filters but not their own, so selecting
 * "Evocation" does not zero out every other school. Without that a rail can
 * only ever narrow, and you can never see what else is there.
 *
 * The controls are buttons rather than links because filtering no longer
 * navigates — the whole list is already here, so a click is a state change and
 * the URL is updated afterwards to match.
 */

const CASTING_TIME_LABELS: Record<string, string> = {
  action: "Action",
  bonus: "Bonus action",
  reaction: "Reaction",
  round: "Round",
  minute: "Minute",
  hour: "Hour",
};

export function SpellFilters({
  facets,
  filtered,
  onToggleLevel,
  onToggleSchool,
  onToggleTime,
  onToggleClass,
  onToggleConcentration,
  onToggleRitual,
  onClear,
}: {
  facets: SpellFacets;
  filtered: boolean;
  onToggleLevel: (value: number) => void;
  onToggleSchool: (value: string) => void;
  onToggleTime: (value: string) => void;
  onToggleClass: (value: string) => void;
  onToggleConcentration: () => void;
  onToggleRitual: () => void;
  onClear: () => void;
}) {
  return (
    <Stack gap="5" px="3" py="4" pb="12">
      {/* Reserves its own row whether or not it is shown, so the groups below
          do not shift up and down as the first filter is applied. */}
      <Box minH="4">
        {filtered ? (
          <Box
            asChild
            fontFamily="ui"
            fontSize="2xs"
            fontWeight="medium"
            letterSpacing="wide"
            textTransform="uppercase"
            color="brand"
            _hover={{ textDecoration: "underline" }}
          >
            <button type="button" onClick={onClear}>
              Clear filters
            </button>
          </Box>
        ) : null}
      </Box>

      <Group label="Level">
        {facets.levels.map((facet) => (
          <Option
            key={facet.value}
            facet={facet}
            onToggle={() => onToggleLevel(facet.value)}
          >
            {levelLabel(facet.value)}
          </Option>
        ))}
      </Group>

      <Group label="School">
        {facets.schools.map((facet) => (
          <Option
            key={facet.value}
            facet={facet}
            onToggle={() => onToggleSchool(facet.value)}
          >
            {schoolName(facet.value)}
          </Option>
        ))}
      </Group>

      <Group label="Casting time">
        {facets.times.map((facet) => (
          <Option
            key={facet.value}
            facet={facet}
            onToggle={() => onToggleTime(facet.value)}
          >
            {CASTING_TIME_LABELS[facet.value] ?? facet.value}
          </Option>
        ))}
      </Group>

      <Group label="Class">
        {facets.classes.map((facet) => (
          <Option
            key={facet.value}
            facet={facet}
            onToggle={() => onToggleClass(facet.value)}
          >
            <Box as="span" textTransform="capitalize">
              {facet.value}
            </Box>
          </Option>
        ))}
      </Group>

      <Group label="Requires">
        <Option facet={facets.concentration} onToggle={onToggleConcentration}>
          Concentration
        </Option>
        <Option facet={facets.ritual} onToggle={onToggleRitual}>
          Ritual
        </Option>
      </Group>
    </Stack>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box as="section">
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
        {label}
      </Text>
      <Stack gap="0">{children}</Stack>
    </Box>
  );
}

/**
 * One filter option.
 *
 * Selected state is carried by fill *and* weight, not colour alone — purple at
 * 11px against a panel is not a reliable signal on its own (WCAG 1.4.1).
 * Disabled state uses `aria-pressed` plus a real `disabled` attribute so it is
 * announced as an unavailable toggle rather than merely looking greyed out.
 */
function Option<T>({
  facet,
  onToggle,
  children,
}: {
  facet: FacetOption<T>;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { selected, disabled, count } = facet;

  return (
    <Box
      asChild
      display="flex"
      justifyContent="space-between"
      alignItems="baseline"
      gap="2"
      px="2"
      py="1"
      rounded="l1"
      textAlign="left"
      fontFamily="ui"
      fontSize="xs"
      fontWeight={selected ? "semibold" : "normal"}
      color={selected ? "brand" : "fg.muted"}
      bg={selected ? "brand.subtle" : "transparent"}
      transition="background .1s, color .1s"
      _hover={disabled ? {} : { bg: selected ? "brand.subtle" : "bg.muted", color: "fg" }}
      _disabled={{ opacity: 0.38, cursor: "not-allowed", color: "fg.subtle" }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={selected}
      >
        <Box as="span">{children}</Box>
        <Box
          as="span"
          fontSize="2xs"
          color="fg.subtle"
          fontVariantNumeric="tabular-nums"
        >
          {count}
        </Box>
      </button>
    </Box>
  );
}

/** What the rail becomes once the aside takes the width. */
export function CollapsedFilters({ active }: { active: boolean }) {
  return (
    <Box
      py="4"
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="3"
    >
      <Text
        fontSize="md"
        color={active ? "brand" : "fg.subtle"}
        aria-hidden="true"
      >
        &#9698;
      </Text>
      <Text
        fontSize="2xs"
        letterSpacing="widest"
        textTransform="uppercase"
        color={active ? "brand" : "fg.subtle"}
        fontWeight="semibold"
        css={{ writingMode: "vertical-rl" }}
      >
        Filters
      </Text>
    </Box>
  );
}
