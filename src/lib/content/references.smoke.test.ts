import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectReferences, kindOfTag } from "./references";
import { splitByTags } from "./tags";

/**
 * Smoke test: the render-time resolver against what ingest already resolved.
 *
 * Two independent passes over the same text produce the set of things a spell
 * refers to — ingest wrote `entity_links` once at load time, and the renderer
 * recomputes candidates on every request. They are written in different places
 * for different reasons, and they must not disagree. Where they do, one of them
 * is wrong and the reader either loses a link or gets one that goes nowhere.
 *
 * This is the check `references.test.ts` cannot make: that file pins the cases
 * someone thought to write down, this one runs the resolver over all 525 spells
 * and compares it against a second opinion.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

interface Loaded {
  /** Natural key to the references the renderer produces for that spell. */
  rendered: Map<string, Set<string>>;
  /** Natural key to the references ingest recorded for that spell. */
  ingested: Map<string, Set<string>>;
  /** Every natural key that actually exists in the database. */
  existing: Set<string>;
  data: unknown[];
  spellCount: number;
}

describeDb("the reference resolver against the seed", () => {
  let loaded: Loaded;

  beforeAll(async () => {
    const { eq, inArray, sql } = await import("drizzle-orm");
    const { db } = await import("@/server/db/client");
    const { entities } = await import("@/server/db/schema/entities");
    const { spells } = await import("@/server/db/schema/content");

    const rows = await db
      .select({ key: entities.naturalKey, data: spells.data })
      .from(spells)
      .innerJoin(entities, eq(entities.id, spells.entityId));

    const linkRows = (await db.execute(sql`
      SELECT f.natural_key AS from_key, t.natural_key AS to_key
      FROM entity_links l
      JOIN entities f ON f.id = l.from_id
      JOIN entities t ON t.id = l.to_id
      WHERE f.entity_type = 'spell'
    `)) as unknown as { from_key: string; to_key: string }[];

    const ingested = new Map<string, Set<string>>();
    for (const link of linkRows) {
      const set = ingested.get(link.from_key) ?? new Set<string>();
      set.add(link.to_key);
      ingested.set(link.from_key, set);
    }

    const rendered = new Map<string, Set<string>>();
    const allKeys = new Set<string>();
    for (const row of rows) {
      const refs = collectReferences(row.data);
      rendered.set(row.key, refs);
      for (const key of refs) allKeys.add(key);
    }

    const found = await db
      .select({ key: entities.naturalKey })
      .from(entities)
      .where(inArray(entities.naturalKey, [...allKeys]));

    loaded = {
      rendered,
      ingested,
      existing: new Set(found.map((row) => row.key)),
      data: rows.map((row) => row.data),
      spellCount: rows.length,
    };
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  it("reads every spell in the corpus", () => {
    expect(loaded.spellCount).toBe(525);
    expect(loaded.ingested.size).toBeGreaterThan(0);
  });

  /** Ingest found a link the renderer does not: the reader loses it. */
  it("finds everything ingest found", () => {
    const missing: string[] = [];

    for (const [spell, links] of loaded.ingested) {
      const ours = loaded.rendered.get(spell) ?? new Set<string>();
      for (const target of links) {
        if (!ours.has(target)) missing.push(`${spell} -> ${target}`);
      }
    }

    expect(missing).toEqual([]);
  });

  /**
   * The renderer resolves a target ingest did not record. A self-reference is
   * not a disagreement — the renderer deliberately declines to link a page to
   * itself, so ingest never recorded one.
   */
  it("finds nothing ingest did not", () => {
    const extra: string[] = [];

    for (const [spell, ours] of loaded.rendered) {
      const links = loaded.ingested.get(spell) ?? new Set<string>();
      for (const target of ours) {
        if (target === spell) continue;
        if (loaded.existing.has(target) && !links.has(target)) {
          extra.push(`${spell} -> ${target}`);
        }
      }
    }

    expect(extra).toEqual([]);
  });

  /**
   * An unhandled tag renders as a conspicuous marker rather than a link, which
   * is the right behaviour and the wrong outcome. Spell text is the slice that
   * is meant to be fully covered, so the count here is zero — book chapters
   * are a different and much larger question.
   */
  it("meets no tag it does not recognise in any spell", () => {
    const unknown = new Map<string, number>();

    const scan = (text: string) => {
      for (const segment of splitByTags(text)) {
        if (segment.kind !== "tag") continue;
        if (kindOfTag(segment.name) === "unknown") {
          unknown.set(segment.name, (unknown.get(segment.name) ?? 0) + 1);
        }
        segment.parts.forEach(scan);
      }
    };

    const walk = (value: unknown): void => {
      if (typeof value === "string") {
        if (value.includes("{@")) scan(value);
        return;
      }
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === "object") {
        return Object.values(value).forEach(walk);
      }
    };

    loaded.data.forEach(walk);

    expect(Object.fromEntries(unknown)).toEqual({});
  });

  /**
   * One tag can mean several types — `{@item club}` could be an item, a base
   * item or an item group — so the resolver offers every candidate and takes
   * the first that exists. Individual candidates failing is normal and
   * expected; a tag where *none* of them resolve is a real dead link.
   *
   * Asserted against the tags themselves rather than the flattened key set,
   * because counting unresolved keys makes correct ambiguity look like breakage.
   */
  it("resolves at least one candidate for every reference tag", async () => {
    const { candidateKeysForTag } = await import("./references");
    const dead: string[] = [];

    const scan = (text: string) => {
      for (const segment of splitByTags(text)) {
        if (segment.kind !== "tag") continue;
        if (kindOfTag(segment.name) === "reference") {
          const candidates = candidateKeysForTag(segment);
          if (
            candidates.length > 0 &&
            !candidates.some((key) => loaded.existing.has(key))
          ) {
            dead.push(segment.raw);
          }
        }
        segment.parts.forEach(scan);
      }
    };

    const walk = (value: unknown): void => {
      if (typeof value === "string") {
        if (value.includes("{@")) scan(value);
        return;
      }
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === "object") {
        return Object.values(value).forEach(walk);
      }
    };

    loaded.data.forEach(walk);

    // Deduplicated so one repeated tag does not read as hundreds of failures.
    expect([...new Set(dead)]).toEqual([]);
  });
});
