import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { coverageReport, resetCoverage } from "@/components/entry/coverage";
import { system } from "@/theme";
import type { ItemDetail as ItemDetailRow } from "@/server/db/queries/items";
import { ItemDetail } from "./item-detail";

/**
 * Every item in the corpus, through the panel that renders it.
 *
 * `item-detail.test.tsx` proves the panel handles the shapes someone wrote
 * down. This is the tier that catches the shape nobody did: an entry type the
 * renderer has no case for, a tag it does not know, or a formatter that throws
 * on a value only one item in three thousand carries.
 *
 * Rendered to a string rather than into a DOM — 3,645 panels is far more markup
 * than jsdom needs to build for a question about which branches were taken.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const ITEM_COUNT = 3634;

/**
 * Tags no item renderer can help with, and the same list the book sections
 * already carry. `{@color}` is inline formatting from one comic-styled source —
 * two occurrences, both in the Deck of Wild Cards — so it is a gap in the
 * renderer rather than in this panel.
 */
const KNOWN_TAG_GAPS = ["color"] as const;

describeDb("the item panel over the whole corpus", () => {
  let gaps: { kind: string; name: string }[];
  let rendered: number;
  let markup: string[];

  beforeAll(async () => {
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/server/db/client");
    const { items } = await import("@/server/db/schema/content");
    const { entities } = await import("@/server/db/schema/entities");
    const { itemEntryTemplates, itemVocabulary } = await import(
      "@/server/db/queries/items"
    );
    const { resolveItemEntries } = await import("@/lib/content/items");

    const rows = await db
      .select({
        naturalKey: entities.naturalKey,
        name: entities.name,
        sourceId: entities.sourceId,
        page: entities.page,
        rarity: items.rarity,
        itemType: items.itemType,
        valueCp: items.valueCp,
        weightLb: items.weightLb,
        armorClass: items.armorClass,
        properties: items.properties,
        data: items.data,
      })
      .from(items)
      .innerJoin(entities, eq(entities.id, items.entityId));

    const [vocabulary, templates] = await Promise.all([
      itemVocabulary(),
      itemEntryTemplates(),
    ]);

    rendered = rows.length;
    markup = [];
    resetCoverage();

    for (const row of rows) {
      // The type name is resolved by the query in production; here the panel is
      // handed whatever the row carries, since what is under test is the
      // rendering rather than the lookup.
      const item = {
        ...row,
        // This test reads the table directly rather than through `getItem`, so
        // the shared descriptions have to be spliced here the way the query
        // splices them — otherwise the 170 items that cite one would be swept
        // over the markup they were meant to stop printing.
        data: {
          ...row.data,
          entries: resolveItemEntries(row.data["entries"], row.data, templates),
        },
        sourceName: row.sourceId,
        typeName: row.itemType,
      } as unknown as ItemDetailRow;

      markup.push(
        renderToStaticMarkup(
          <ChakraProvider value={system}>
            <ItemDetail item={item} refs={{}} vocabulary={vocabulary.properties} />
          </ChakraProvider>,
        ),
      );
    }

    gaps = coverageReport();
    // Rendering every item in the corpus takes longer than the default hook
    // budget allows.
  }, 120_000);

  afterAll(async () => {
    resetCoverage();
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  it("renders every item in the corpus", () => {
    expect(rendered).toBe(ITEM_COUNT);
  });

  /**
   * Items were the last large block of dead cross-references — 8,182 of them
   * across the three types — so this is the assertion that says the block is
   * genuinely closed rather than merely reachable.
   */
  it("meets no entry type it cannot render", () => {
    expect(gaps.filter((gap) => gap.kind === "entry")).toEqual([]);
  });

  /**
   * The ratchet on the shared descriptions.
   *
   * `{#itemEntry}` is not a tag the renderer knows about and never will — it
   * falls through `splitByTags` as ordinary text, so it reports no coverage gap
   * and shows up only as markup printed in the middle of a panel. 170 items did
   * exactly that, 36 of them with nothing else to show. The only way to catch it
   * is to read the rendered output.
   */
  it("prints no unresolved citation or placeholder in any panel", () => {
    const leaked = markup
      .map((html, index) => ({ html, index }))
      .filter(({ html }) => html.includes("{#itemEntry") || html.includes("{{item."))
      .map(({ index }) => index);

    expect(leaked).toEqual([]);
  });

  it("meets no tag outside the known gaps", () => {
    const unexpected = gaps
      .filter((gap) => gap.kind === "tag")
      .filter((gap) => !KNOWN_TAG_GAPS.includes(gap.name as never));

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
