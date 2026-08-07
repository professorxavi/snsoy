import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { levelLabel, schoolName } from "@/lib/content/spells";
import {
  clearAll,
  hasFilters,
  toggleFlag,
  toggleValue,
  type QueryParams,
} from "@/lib/query-params";
import type { FacetOption, SpellFacetOptions } from "@/server/db/queries/spells";

/**
 * The spell filter rail.
 *
 * **Every option is always shown.** One that would return nothing is disabled,
 * not removed — a rail whose contents rearrange as you filter is a rail you
 * cannot learn, and a vanished option is indistinguishable from one that never
 * existed. The counts come from a facet query that groups over every spell but
 * counts against the *other* filters, so selecting "Evocation" does not zero
 * out every other school.
 *
 * Controls are links, and that is deliberate now that filtering is a server
 * round trip: filter state already lives in the URL, so a link *is* the state
 * change. No client state, no hydration needed for the rail to work, and every
 * option is middle-clickable into a new tab.
 *
 * A disabled option renders as a `<span>` rather than a dead `<a>`, so it is
 * neither focusable nor announced as a link to somewhere.
 */

const CASTING_TIME_LABELS: Record<string, string> = {
  action: "Action",
  bonus: "Bonus action",
  reaction: "Reaction",
  round: "Round",
  minute: "Minute",
  hour: "Hour",
};

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

const BASE = "/compendium/spells";

export function SpellFilters({
  params,
  facets,
}: {
  params: QueryParams;
  facets: SpellFacetOptions;
}) {
  const filtered = hasFilters(params, FILTER_KEYS);

  return (
    <Stack gap="5" px="3" py="4" pb="12">
      {/* Reserves its own row whether or not it is shown, so the groups below
          do not shift as the first filter is applied. */}
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
            <NextLink href={`${BASE}${clearAll(params, ["sort"])}`}>
              Clear filters
            </NextLink>
          </Box>
        ) : null}
      </Box>

      <Group label="Level">
        {facets.levels.map((facet) => (
          <Option
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "level", String(facet.value))}`}
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
            href={`${BASE}${toggleValue(params, "school", facet.value)}`}
          >
            {schoolName(facet.value)}
          </Option>
        ))}
      </Group>

      <Group label="Casting time">
        {facets.castingTimes.map((facet) => (
          <Option
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "time", facet.value)}`}
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
            href={`${BASE}${toggleValue(params, "class", facet.value)}`}
          >
            {facet.value}
          </Option>
        ))}
      </Group>

      <Group label="Requires">
        <Option
          facet={facets.concentration}
          href={`${BASE}${toggleFlag(params, "conc")}`}
        >
          Concentration
        </Option>
        <Option
          facet={facets.ritual}
          href={`${BASE}${toggleFlag(params, "ritual")}`}
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
 * Selected state is carried by fill *and* weight, not colour alone — purple at
 * 11px against a panel is not a reliable signal on its own (WCAG 1.4.1).
 */
function Option<T extends string | number>({
  facet,
  href,
  children,
}: {
  facet: FacetOption<T>;
  href: string;
  children: ReactNode;
}) {
  const { selected, disabled, count } = facet;

  const body = (
    <>
      <Box as="span">{children}</Box>
      <Box
        as="span"
        fontSize="2xs"
        color="fg.subtle"
        fontVariantNumeric="tabular-nums"
      >
        {count}
      </Box>
    </>
  );

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
      fontWeight={selected ? "semibold" : "normal"}
      color={selected ? "brand" : disabled ? "fg.subtle" : "fg.muted"}
      bg={selected ? "brand.subtle" : "transparent"}
      opacity={disabled ? 0.38 : 1}
      cursor={disabled ? "not-allowed" : undefined}
      transition="background .1s, color .1s"
      _hover={
        disabled ? {} : { bg: selected ? "brand.subtle" : "bg.muted", color: "fg" }
      }
    >
      {disabled ? (
        // Not a link: there is nowhere useful to go, and a disabled control
        // should not be focusable or announced as a destination.
        <span aria-disabled="true">{body}</span>
      ) : (
        <NextLink href={href} aria-current={selected ? "true" : undefined}>
          {body}
        </NextLink>
      )}
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
