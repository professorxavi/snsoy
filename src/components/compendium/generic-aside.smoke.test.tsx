import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { coverageReport, resetCoverage } from "@/components/entry/coverage";
import { system } from "@/theme";
import type { GenericEntity } from "@/server/db/queries/generic";
import { GenericAside } from "./generic-aside";
import { ObjectActions } from "./object-actions";
import { RecipeBody } from "./recipe-body";

/**
 * Every entity of every generic type the aside can open, through the panel that
 * renders it.
 *
 * `generic-aside.test.tsx` proves the panel handles the shapes someone wrote
 * down. This is the tier that catches the shape nobody did: an entry type the
 * renderer has no case for, or a tag it does not know. It is the tier that found
 * the `{=baseName/l}` bug in items and the `{@color}` gap in book sections, and
 * it is cheap here — these types run to hundreds of rows, not thousands.
 *
 * One file rather than one per type. The panel is the same component for all of
 * them, so five copies would assert the same thing five times over and diverge
 * the moment one was edited. Add a type to `TYPES` when its case joins the
 * loader map in `openEntityAside`.
 *
 * Rendered to a string rather than into a DOM — the question is which branches
 * were taken, and jsdom would build markup nobody reads to answer it.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * Exact counts, measured against the seed. Ingest runs once and every instance
 * restores the same dump, so a number that moves means the seed was re-cut.
 */
const TYPES = {
  skill: 18,
  condition: 15,
  sense: 4,
  status: 2,
  action: 30,
  variantrule: 115,
  language: 135,
  charoption: 44,
  trap: 29,
  hazard: 28,
  disease: 22,
  object: 20,
  deity: 494,
  recipe: 241,
  reward: 235,
  cult: 29,
  boon: 12,
} as const;

/**
 * The three player options that predate `generic_entities` and were given typed
 * columns by ingest. They render through the same panel, so they are covered
 * here rather than in a file of their own — only the table they are read from
 * differs.
 */
const TYPED_TABLES = {
  background: 96,
  feat: 105,
  optionalfeature: 151,
} as const;

/**
 * Tags no renderer in this codebase handles yet.
 *
 * `{@vehupgrade}` is 23 occurrences, all in the ship and airship variant rules,
 * and it addresses `vehicleUpgrade` — a type with no view and no aside case, so
 * there is nothing for the tag to open. It closes when that type is built, not
 * before, and this list is what stops it being forgotten.
 */
const KNOWN_TAG_GAPS: readonly string[] = ["vehupgrade"];

describeDb("the generic panel over every entity it serves", () => {
  let gaps: { kind: string; name: string }[];
  let rendered: Record<string, number>;

  beforeAll(async () => {
    const { inArray, eq } = await import("drizzle-orm");
    const { db } = await import("@/server/db/client");
    const { genericEntities } = await import("@/server/db/schema/content");
    const { entities } = await import("@/server/db/schema/entities");

    const { backgrounds, feats, optionalFeatures } = await import(
      "@/server/db/schema/content"
    );

    const generic = await db
      .select({
        entityType: entities.entityType,
        naturalKey: entities.naturalKey,
        name: entities.name,
        slug: entities.slug,
        sourceId: entities.sourceId,
        page: entities.page,
        data: genericEntities.data,
      })
      .from(genericEntities)
      .innerJoin(entities, eq(entities.id, genericEntities.entityId))
      .where(
        inArray(entities.entityType, Object.keys(TYPES) as (keyof typeof TYPES)[]),
      );

    const typed = await Promise.all(
      [backgrounds, feats, optionalFeatures].map((table) =>
        db
          .select({
            entityType: entities.entityType,
            naturalKey: entities.naturalKey,
            name: entities.name,
            slug: entities.slug,
            sourceId: entities.sourceId,
            page: entities.page,
            data: table.data,
          })
          .from(table)
          .innerJoin(entities, eq(entities.id, table.entityId)),
      ),
    );

    const rows = [...generic, ...typed.flat()];

    rendered = {};
    resetCoverage();

    for (const row of rows) {
      rendered[row.entityType] = (rendered[row.entityType] ?? 0) + 1;

      // The source's display name is resolved by the query in production; here
      // the panel is handed the id, since what is under test is the rendering
      // rather than the join.
      const entity = {
        ...row,
        id: row.naturalKey,
        sourceName: row.sourceId,
      } as unknown as GenericEntity;

      renderToStaticMarkup(
        <ChakraProvider value={system}>
          <GenericAside entity={entity} refs={{}}>
            {/*
              Objects keep their attacks outside `entries`, and the panel is
              handed them the same way in production. Without this the 13 that
              have any would be swept for coverage over the half of themselves
              that renders — and the `attack` entry type, which only they use,
              would never be exercised at all.
            */}
            {row.entityType === "object" ? (
              <ObjectActions
                actions={(row.data as Record<string, unknown>)["actionEntries"]}
                refs={{}}
                selfKey={row.naturalKey}
                context={row.name}
              />
            ) : null}

            {/*
              A recipe has no `entries` at all, so sweeping it through the panel
              alone would render nothing and report nothing. This is where its
              ingredients and instructions — and the `{@unit}` tag that only
              they use — are actually exercised.
            */}
            {row.entityType === "recipe" ? (
              <RecipeBody
                data={row.data as Record<string, unknown>}
                refs={{}}
                selfKey={row.naturalKey}
                context={row.name}
              />
            ) : null}
          </GenericAside>
        </ChakraProvider>,
      );
    }

    gaps = coverageReport();
  }, 120_000);

  afterAll(async () => {
    resetCoverage();
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  it.each([...Object.entries(TYPES), ...Object.entries(TYPED_TABLES)])(
    "renders every %s",
    (type, count) => {
      expect(rendered[type]).toBe(count);
    },
  );

  /**
   * The assertion that says a block of dead cross-references is genuinely
   * closed rather than merely reachable — a tag that opens a panel rendering a
   * visible fallback is not a link that works.
   */
  it("meets no entry type it cannot render", () => {
    expect(gaps.filter((gap) => gap.kind === "entry")).toEqual([]);
  });

  it("meets no tag outside the known gaps", () => {
    const unexpected = gaps
      .filter((gap) => gap.kind === "tag")
      .filter((gap) => !KNOWN_TAG_GAPS.includes(gap.name));

    expect(unexpected).toEqual([]);
  });

  /**
   * The other half of the ratchet. Without this the known list only ever goes
   * stale: a tag gets handled, the gap disappears, and the list keeps naming it
   * forever.
   */
  it("still has a gap for everything the known list names", () => {
    const met = new Set(gaps.map((gap) => gap.name));

    expect(
      KNOWN_TAG_GAPS.filter((name) => !met.has(name)),
      "handled now — delete from KNOWN_TAG_GAPS",
    ).toEqual([]);
  });
});
