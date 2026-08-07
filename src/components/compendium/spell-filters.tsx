import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { levelLabel, schoolName } from "@/lib/content/spells";
import {
  clearAll,
  hasFilters,
  readBoolean,
  readList,
  toggleFlag,
  toggleValue,
  type QueryParams,
} from "@/lib/query-params";
import type { spellFacets } from "@/server/db/queries/spells";

/**
 * The spell filter rail.
 *
 * Every control is a link, not a checkbox. That is deliberate: filter state is
 * already in the URL, so a link *is* the state change — no form, no client
 * state, no hydration needed for the rail to work, and every option is
 * middle-clickable into a new tab. It also means the rail renders correctly on
 * the server with the counts already filled in.
 *
 * Counts come from facets computed against the other filters but not their own,
 * so ticking "Evocation" does not zero out every other school. Without that a
 * rail can only ever narrow, and you can never see what else is there.
 */

type Facets = Awaited<ReturnType<typeof spellFacets>>;

/** Parameters that count as filters — `page` and `sort` are not. */
export const FILTER_KEYS = [
  "q",
  "level",
  "school",
  "time",
  "class",
  "conc",
  "ritual",
];

const CASTING_TIME_LABELS: Record<string, string> = {
  action: "Action",
  bonus: "Bonus action",
  reaction: "Reaction",
  minute: "Minute",
  hour: "Hour",
};

export function SpellFilters({
  params,
  facets,
}: {
  params: QueryParams;
  facets: Facets;
}) {
  const activeLevels = readList(params, "level");
  const activeSchools = readList(params, "school");
  const activeTimes = readList(params, "time");
  const activeClasses = readList(params, "class");

  const levels = [...facets.levels].sort((a, b) => a.value - b.value);
  const schools = [...facets.schools].sort((a, b) =>
    schoolName(a.value).localeCompare(schoolName(b.value)),
  );
  const classes = [...facets.classes].sort((a, b) =>
    a.value.localeCompare(b.value),
  );

  return (
    <Stack gap="5" px="3" py="4" pb="12">
      {hasFilters(params, FILTER_KEYS) ? (
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
          <NextLink href={`/compendium/spells${clearAll(params, ["sort"])}`}>
            Clear filters
          </NextLink>
        </Box>
      ) : null}

      <Group label="Level">
        {levels.map((facet) => (
          <Option
            key={facet.value}
            href={`/compendium/spells${toggleValue(params, "level", String(facet.value))}`}
            active={activeLevels.includes(String(facet.value))}
            count={facet.n}
          >
            {levelLabel(facet.value)}
          </Option>
        ))}
      </Group>

      <Group label="School">
        {schools.map((facet) => (
          <Option
            key={facet.value}
            href={`/compendium/spells${toggleValue(params, "school", facet.value)}`}
            active={activeSchools.includes(facet.value)}
            count={facet.n}
          >
            {schoolName(facet.value)}
          </Option>
        ))}
      </Group>

      <Group label="Casting time">
        {facets.castingTimes.map((facet) => (
          <Option
            key={facet.value}
            href={`/compendium/spells${toggleValue(params, "time", facet.value)}`}
            active={activeTimes.includes(facet.value)}
            count={facet.n}
          >
            {CASTING_TIME_LABELS[facet.value] ?? facet.value}
          </Option>
        ))}
      </Group>

      <Group label="Class">
        {classes.map((facet) => (
          <Option
            key={facet.value}
            href={`/compendium/spells${toggleValue(params, "class", facet.value)}`}
            active={activeClasses.includes(facet.value)}
            count={facet.n}
          >
            <Box as="span" textTransform="capitalize">
              {facet.value}
            </Box>
          </Option>
        ))}
      </Group>

      <Group label="Requires">
        <Option
          href={`/compendium/spells${toggleFlag(params, "conc")}`}
          active={readBoolean(params, "conc") === true}
        >
          Concentration
        </Option>
        <Option
          href={`/compendium/spells${toggleFlag(params, "ritual")}`}
          active={readBoolean(params, "ritual") === true}
        >
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
 * Active state is carried by fill *and* weight, not colour alone — purple at
 * 11px against a panel is not a reliable signal on its own (WCAG 1.4.1).
 */
function Option({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: ReactNode;
}) {
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
      fontFamily="ui"
      fontSize="xs"
      fontWeight={active ? "semibold" : "normal"}
      color={active ? "brand" : "fg.muted"}
      bg={active ? "brand.subtle" : "transparent"}
      transition="background .1s, color .1s"
      _hover={{ bg: active ? "brand.subtle" : "bg.muted", color: "fg" }}
    >
      <NextLink href={href} aria-current={active ? "true" : undefined}>
        <Box as="span">{children}</Box>
        {count != null ? (
          <Box
            as="span"
            fontSize="2xs"
            color="fg.subtle"
            fontVariantNumeric="tabular-nums"
          >
            {count}
          </Box>
        ) : null}
      </NextLink>
    </Box>
  );
}

/** What the rail becomes once the aside takes the width. */
export function CollapsedFilters({ params }: { params: QueryParams }) {
  const active = hasFilters(params, FILTER_KEYS);

  return (
    <Box
      py="4"
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="3"
    >
      <Text fontSize="md" color={active ? "brand" : "fg.subtle"} aria-hidden="true">
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
