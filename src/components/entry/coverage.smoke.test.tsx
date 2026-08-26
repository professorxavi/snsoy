import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "@/theme";
import { Entries, type Entry } from "@/components/entry";
import { coverageReport, resetCoverage } from "./coverage";

/**
 * Renderer coverage across every book and adventure section.
 *
 * A ratchet, not a target. The corpus holds entry types and tags the renderer
 * does not handle yet, and that is a known state rather than a bug — an
 * unhandled entry renders as a conspicuous block, which is the correct
 * behaviour for something nobody has written a treatment for. What must not
 * happen is the set growing quietly, which is exactly what a new source or a
 * refactor of the switch statement would do.
 *
 * The gaps are collected by running the real renderer over the real sections
 * and reading what it reported about itself, rather than by keeping a list of
 * handled types beside it. The script this replaced kept such a list, and it
 * had drifted: six types the renderer handles today were still counted as
 * gaps, so the number it printed was wrong in the safe direction and nobody
 * noticed.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * Entry types the renderer has no treatment for yet. **Empty:** every structure
 * the books use in their prose now renders.
 *
 * Shrinking this list was the point, and adding to it should be a deliberate
 * act with a reason rather than something a test update absorbs on the way
 * past. That goes double now that it is empty — the next name added here is the
 * first, and it should be argued for.
 *
 * The last three came off together. `flowchart` earned the ratchet on its own:
 * a *container*, so one unhandled marker dropped all 115 blocks inside the 17
 * of them — the opening summary of nine adventures. `abilityGeneric` and
 * `inlineBlock` were one occurrence and two, both first met in the PHB.
 */
const KNOWN_ENTRY_GAPS: readonly string[] = [];

/**
 * Tags with no treatment yet.
 *
 * Longer than the entry list and much cheaper to shorten — most of these are
 * inline formatting from one or two comic-styled sources, not new structure.
 */
const KNOWN_TAG_GAPS = [
  "5etoolsAudio",
  "5etoolsImg",
  "ability",
  "color",
  "comic",
  "comicH1",
  "comicH2",
  "comicH3",
  "comicH4",
  "comicNote",
  "savingThrow",
] as const;

describeDb("renderer coverage over every book section", () => {
  let gaps: { entry: Set<string>; tag: Set<string> };
  let sectionCount: number;

  beforeAll(async () => {
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/server/db/client");
    const { bookSections } = await import("@/server/db/schema/books");
    const { entities } = await import("@/server/db/schema/entities");

    // Joined for the name only, which labels a gap with the chapter it was
    // first seen in — the difference between a report you can act on and a
    // list of type names.
    const rows = await db
      .select({ title: entities.name, data: bookSections.data })
      .from(bookSections)
      .innerJoin(entities, eq(entities.id, bookSections.entityId));

    sectionCount = rows.length;
    resetCoverage();

    for (const row of rows) {
      const entries = (row.data as { entries?: Entry[] })?.entries;
      if (!entries?.length) continue;

      // Rendered to a string rather than into a DOM: 1,006 chapter bodies is
      // far more markup than jsdom needs to build for a question about which
      // branches the renderer took.
      renderToStaticMarkup(
        <ChakraProvider value={system}>
          <Entries entries={entries} context={row.title ?? undefined} />
        </ChakraProvider>,
      );
    }

    const report = coverageReport();
    gaps = {
      entry: new Set(
        report.filter((g) => g.kind === "entry").map((g) => g.name),
      ),
      tag: new Set(report.filter((g) => g.kind === "tag").map((g) => g.name)),
    };
    // Rendering every chapter body in the corpus takes longer than the default
    // hook budget allows.
  }, 120_000);

  afterAll(async () => {
    resetCoverage();
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  it("renders every section in the corpus", () => {
    expect(sectionCount).toBe(833);
  });

  it("meets no entry type outside the known gaps", () => {
    const unexpected = [...gaps.entry].filter(
      (name) => !KNOWN_ENTRY_GAPS.includes(name),
    );

    expect(unexpected).toEqual([]);
  });

  it("meets no tag outside the known gaps", () => {
    const unexpected = [...gaps.tag].filter(
      (name) => !KNOWN_TAG_GAPS.includes(name as never),
    );

    expect(unexpected).toEqual([]);
  });

  /**
   * The other half of the ratchet. Without this the known lists only ever grow
   * stale: a type gets handled, the gap disappears, and the list keeps naming
   * it forever — which is how the script this replaced ended up wrong.
   */
  it("still has a gap for everything the known lists name", () => {
    expect(
      KNOWN_ENTRY_GAPS.filter((name) => !gaps.entry.has(name)),
      "handled now — delete from KNOWN_ENTRY_GAPS",
    ).toEqual([]);

    expect(
      KNOWN_TAG_GAPS.filter((name) => !gaps.tag.has(name)),
      "handled now — delete from KNOWN_TAG_GAPS",
    ).toEqual([]);
  });
});
