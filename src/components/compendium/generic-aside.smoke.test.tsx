import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { coverageReport, resetCoverage } from "@/components/entry/coverage";
import { system } from "@/theme";
import type { GenericEntity } from "@/server/db/queries/generic";
import { GenericAside } from "./generic-aside";

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
 * switch in `openEntityAside`.
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
  sense: 4,
  status: 2,
  action: 30,
  variantrule: 115,
  language: 135,
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

    const rows = await db
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
          <GenericAside entity={entity} refs={{}} />
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

  it.each(Object.entries(TYPES))("renders every %s", (type, count) => {
    expect(rendered[type]).toBe(count);
  });

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
