import { Box, Table, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { AsideLink } from "@/components/compendium/aside-link";
import { asideKey } from "@/lib/aside";
import { abilityLabel, skillCovers } from "@/lib/content/skills";
import { withValue, type QueryParams } from "@/lib/query-params";
import { hrefFor, listHrefFor } from "@/lib/routes";
import type { SkillRow, SkillSort } from "@/server/db/queries/skills";

/**
 * The skill list, as a dense comparison table — the same shape the spell table
 * takes, and for the same reason: a row click opens the skill beside the list
 * rather than navigating away from it.
 *
 * What differs is everything paging and filtering: there are eighteen skills
 * from one book, so there is no pager, no search field and no facet rail. The
 * two orders below are the only state the view has.
 *
 * Stays a server component. Only the name in each row is a client component,
 * and `open` arrives as a prop rather than an import — a shared component has
 * no business importing a route's action, and doing so would drag the database
 * client into every test that renders a table.
 */

const BASE = listHrefFor("skill");

export function SkillTable({
  rows,
  params,
  open,
}: {
  rows: SkillRow[];
  params: QueryParams;
  /** Renders one skill for the aside. The route supplies its server function. */
  open: (source: string, slug: string) => Promise<ReactNode>;
}) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <Box overflowX="auto">
      <Table.Root size="sm" interactive stickyHeader>
        <Table.Header>
          <Table.Row bg="bg.muted">
            <SortableHeader params={params} sort="name">
              Name
            </SortableHeader>
            <SortableHeader params={params} sort="ability">
              Ability
            </SortableHeader>
            <Header optional>Covers</Header>
            <Header optional>Source</Header>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {rows.map((row) => (
            <SkillRowView key={row.id} row={row} open={open} />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}

function SkillRowView({
  row,
  open,
}: {
  row: SkillRow;
  open: (source: string, slug: string) => Promise<ReactNode>;
}) {
  const href = hrefFor({
    entityType: "skill",
    sourceId: row.sourceId,
    slug: row.slug,
  });

  return (
    <Table.Row position="relative">
      <Cell fontWeight="medium">
        {/*
          One anchor stretched over the whole row by a pseudo-element, rather
          than a link per cell — four identical links per row is noise with a
          keyboard or a screen reader.

          The row's tint follows the anchor's `aria-current` through a `:has()`
          rule in `BrowseFrame`, so the selection needs no prop and this stays a
          server component.
        */}
        <Box
          asChild
          color="fg"
          _after={{ content: '""', position: "absolute", inset: 0 }}
          _hover={{ color: "brand" }}
        >
          <AsideLink
            /*
             * The skill's canonical URL, which is the one every `{@skill}` tag
             * in the corpus already points at — even though nothing serves it:
             * a skill renders in the aside and has no page of its own. Kept
             * because it is the entity's identity and what "copy link address"
             * should yield, not because it resolves.
             */
            href={href ?? "#"}
            // Built the same way the reader's links build theirs, so a skill
            // opened from a stat block and the same skill opened from this
            // table are one entry in the cache and one selected row, not two.
            entityKey={asideKey("skill", row.sourceId, row.slug)}
            label={row.name}
            load={open.bind(null, row.sourceId, row.slug)}
          >
            {row.name}
          </AsideLink>
        </Box>
      </Cell>

      <Cell>{abilityLabel(row.ability)}</Cell>
      <Cell optional>{skillCovers(row.slug)}</Cell>
      <Cell optional muted>
        {row.sourceId}
      </Cell>
    </Table.Row>
  );
}

/** Columns the browse frame's CSS hides while the aside is open. */
const OPTIONAL_ATTR = { "data-col-optional": "" };

function Header({
  children,
  optional,
  sorted,
}: {
  children: ReactNode;
  optional?: boolean;
  /** Announced on the header cell itself, which is where `aria-sort` belongs. */
  sorted?: boolean;
}) {
  return (
    <Table.ColumnHeader
      {...(optional ? OPTIONAL_ATTR : {})}
      aria-sort={sorted ? "ascending" : undefined}
      fontFamily="ui"
      fontSize="2xs"
      fontWeight="semibold"
      letterSpacing="wide"
      textTransform="uppercase"
      color="fg.subtle"
      whiteSpace="nowrap"
    >
      {children}
    </Table.ColumnHeader>
  );
}

function SortableHeader({
  params,
  sort,
  children,
}: {
  params: QueryParams;
  sort: SkillSort;
  children: ReactNode;
}) {
  const active = (params["sort"] ?? "name") === sort;

  return (
    <Header sorted={active}>
      <Box
        asChild
        color={active ? "brand" : "inherit"}
        _hover={{ color: "brand" }}
      >
        <NextLink href={`${BASE}${withValue(params, "sort", sort)}`}>
          {children}
          {active ? " ↓" : null}
        </NextLink>
      </Box>
    </Header>
  );
}

function Cell({
  children,
  optional,
  muted,
  fontWeight,
}: {
  children: ReactNode;
  optional?: boolean;
  muted?: boolean;
  fontWeight?: string;
}) {
  return (
    <Table.Cell
      {...(optional ? OPTIONAL_ATTR : {})}
      fontFamily="ui"
      fontSize="xs"
      fontWeight={fontWeight}
      color={muted ? "fg.subtle" : "fg.muted"}
      whiteSpace="nowrap"
    >
      {children}
    </Table.Cell>
  );
}

/**
 * Only reachable with an unseeded database — nothing here filters — so it says
 * that rather than offering to widen a search that was never narrowed.
 */
function EmptyState() {
  return (
    <Box px="6" py="16" textAlign="center">
      <Text fontFamily="body" fontSize="md" color="fg.muted">
        No skills to show.
      </Text>
    </Box>
  );
}
