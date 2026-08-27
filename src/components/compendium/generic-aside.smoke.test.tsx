import { ChakraProvider } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Entries } from "@/components/entry";
import { coverageReport, resetCoverage } from "@/components/entry/coverage";
import { system } from "@/theme";
import type { GenericEntity } from "@/server/db/queries/generic";
import { DeckContents } from "./deck-contents";
import { GenericAside } from "./generic-aside";
import { ObjectActions } from "./object-actions";
import { VehicleStatblock } from "./vehicle-statblock";

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
  reward: 234,
  cult: 29,
  boon: 12,
  card: 475,
  deck: 22,
  vehicle: 35,
  vehicleUpgrade: 31,
  table: 7,
  magicvariant: 129,
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
 * These four are not tags at all but `{=prop}` substitutions, and they are the
 * one thing a magic variant cannot render. A template writes prose that suits
 * every base item it applies to — "{=baseName/at} {=baseName/l} of slaying",
 * "an extra 7 {=dmgType} damage" — and the value names the *base item*, which a
 * template has none of. `resolveItemTemplates` fills in the 41 placeholders
 * naming a field the template itself carries, and leaves these 14 standing.
 *
 * Three of the 129 variants are affected: `Arrow of Slaying (*)`, which nothing
 * cites, and `Vicious Weapon` / `Vicious +1 Weapon`. Every concrete expansion
 * of all three renders correctly, because expansion is where a base item
 * exists. Closing these means rewording the sentence for the generic case,
 * which is an editorial call rather than a missing renderer.
 */
const KNOWN_TAG_GAPS: readonly string[] = [
  "baseName/l",
  "baseName/a",
  "baseName/at",
  "dmgType",
];

/**
 * What a type keeps *outside* `entries`, handed to the panel the way the loader
 * hands it in production — see `GENERIC_ASIDE_TYPES` in `aside-actions`.
 *
 * This is the half of the sweep that keeps finding things, and it has to be
 * kept honest by hand: the panel renders what it is given, so a type whose
 * content lives beside `entries` would otherwise be swept over the half of
 * itself that renders and report nothing. Six of the twenty-two types here are
 * in that position, and four of them have no `entries` at all.
 */
function extraFor(
  type: string,
  data: unknown,
  naturalKey: string,
  name: string,
): ReactNode {
  const blob = data as Record<string, unknown>;
  const ctx = { refs: {}, selfKey: naturalKey, context: name };

  switch (type) {
    // 13 of the 20 objects keep their attacks in `actionEntries`, and the
    // `attack` entry type they use appears nowhere else in the data.
    case "object":
      return <ObjectActions actions={blob["actionEntries"]} {...ctx} />;

    // A deck's cards are stored as bare addresses rather than as tags.
    case "deck":
      return <DeckContents data={blob} {...ctx} />;

    // 33 of the 35 vehicles have no prose whatever — this is all of them.
    case "vehicle":
      return <VehicleStatblock data={blob} {...ctx} />;

    // The blob is the renderer's own `table` entry with its type left off.
    case "table":
      return <Entries entries={[{ ...blob, type: "table" }]} {...ctx} />;

    default:
      return null;
  }
}

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
            {extraFor(row.entityType, row.data, row.naturalKey, row.name)}
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
