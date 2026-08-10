import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  attunementPhrase,
  formatItemTypeLine,
  formatItemValue,
  formatWeight,
  itemTypeName,
  rarityRank,
} from "@/lib/content/items";
import type * as ItemQueries from "./items";

/**
 * Smoke test: run the item queries against the seeded database, and check the
 * formatters against the corpus rather than against fixtures.
 *
 * `items.test.ts` proves each shape formats correctly against shapes written by
 * hand. This is the tier that catches the shape nobody wrote down — an item
 * whose type resolves to nothing, or whose printed line comes out empty —
 * across all 3,645 rows at once.
 *
 * Counts are exact. Ingest runs once and every instance restores the same dump,
 * so a number that moves means the seed was re-cut or a query changed shape.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

/** Items in the published-material seed, across the three entity types. */
const ITEM_COUNT = 3645;
const MAGIC_ITEM_COUNT = 3448;
const BASE_ITEM_COUNT = 124;
const ITEM_GROUP_COUNT = 73;

describeDb("item queries against the seed", () => {
  let queries: typeof ItemQueries;
  let db: typeof import("../client").db;
  let sql: typeof import("drizzle-orm").sql;

  beforeAll(async () => {
    queries = await import("./items");
    db = (await import("../client")).db;
    sql = (await import("drizzle-orm")).sql;
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("listItems", () => {
    /**
     * The whole point of the blend: one list covers all three entity types, so
     * someone looking for a longsword finds it without knowing that the mundane
     * one is a `baseitem` and the +1 is an `item`.
     */
    it("lists all three item types as one corpus", async () => {
      const list = await queries.listItems();

      expect(list.total).toBe(ITEM_COUNT);
      expect(list.rows).toHaveLength(50);
      expect(list.pageCount).toBe(Math.ceil(ITEM_COUNT / 50));
    });

    it("orders by name by default", async () => {
      const names = (await queries.listItems()).rows.map((row) => row.name);

      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it("clamps a page past the end", async () => {
      const list = await queries.listItems({ page: 9999 });

      expect(list.page).toBe(list.pageCount);
      expect(list.rows.length).toBeGreaterThan(0);
    });

    /**
     * Alphabetical order puts artifacts first and uncommon after rare, so the
     * rarity sort runs off the scale in `RARITY_ORDER` rather than the string.
     */
    it("sorts by rarity from weakest to strongest", async () => {
      const list = await queries.listItems({ sort: "rarity", perPage: ITEM_COUNT });
      const ranks = list.rows.map((row) => rarityRank(row.rarity));

      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      expect(list.rows[0]!.rarity).toBe("none");
      expect(list.rows.at(-1)!.rarity).toBe("unknown (magic)");
    });

    /** 1,562 items record no price, and an unpriced item is not a free one. */
    it("sorts by value with the unpriced last", async () => {
      const list = await queries.listItems({ sort: "value", perPage: ITEM_COUNT });
      const values = list.rows.map((row) => row.valueCp);

      const priced = values.filter((value) => value != null);
      expect(priced).toEqual([...priced].sort((a, b) => a! - b!));
      expect(values.slice(priced.length).every((value) => value == null)).toBe(true);
    });

    it("filters by rarity", async () => {
      const list = await queries.listItems({ rarities: ["legendary"] });

      expect(list.total).toBe(302);
      expect(list.rows.every((row) => row.rarity === "legendary")).toBe(true);
    });

    /**
     * A category is an entity type, which is what keeps each row linking to its
     * own URL segment while they share one list.
     */
    it("filters to one of the three categories", async () => {
      const equipment = await queries.listItems({ categories: ["baseitem"] });
      const groups = await queries.listItems({ categories: ["itemGroup"] });

      expect(equipment.total).toBe(BASE_ITEM_COUNT);
      expect(groups.total).toBe(ITEM_GROUP_COUNT);
      expect(equipment.rows.every((row) => row.entityType === "baseitem")).toBe(true);
    });

    /**
     * `WON` is ours, not the corpus's: 776 items are typed by a `wondrous` flag
     * and nothing else, and without the synthetic code they would be
     * unreachable from the rail.
     */
    it("filters by a synthetic type the corpus only flags", async () => {
      const list = await queries.listItems({ types: ["WON"] });

      expect(list.total).toBe(670);
      expect(list.rows.every((row) => row.typeName === "Wondrous Item")).toBe(true);
    });

    it("narrows on several facets at once", async () => {
      const list = await queries.listItems({
        rarities: ["very rare"],
        attunement: true,
      });

      expect(list.total).toBeGreaterThan(0);
      expect(
        list.rows.every((row) => row.rarity === "very rare" && row.requiresAttunement),
      ).toBe(true);
    });

    it("searches names case-insensitively", async () => {
      const list = await queries.listItems({ q: "LONGSWORD" });

      expect(list.total).toBeGreaterThan(0);
      expect(list.rows.every((row) => /longsword/i.test(row.name))).toBe(true);
    });

    it("returns an empty page rather than failing on no matches", async () => {
      const list = await queries.listItems({ q: "no-such-item-anywhere" });

      expect(list.total).toBe(0);
      expect(list.rows).toEqual([]);
      expect(list.pageCount).toBe(1);
    });

    /**
     * The column the schema projected and ingest never filled. Every row's type
     * name comes from the corpus's own vocabulary instead, so a null here means
     * the resolution broke rather than that the item has no type.
     */
    it("resolves a type name for every typed row", async () => {
      const list = await queries.listItems({ perPage: 200 });
      const typed = list.rows.filter((row) => row.typeCode != null);

      expect(typed.length).toBeGreaterThan(0);
      expect(typed.every((row) => row.typeName != null)).toBe(true);
    });
  });

  describe("itemFacets", () => {
    it("offers every value in the corpus", async () => {
      const facets = await queries.itemFacets();

      expect(facets.rarities).toHaveLength(10);
      // 33 abbreviations the corpus uses, plus the three synthetic codes.
      expect(facets.types).toHaveLength(36);
      expect(facets.categories).toHaveLength(3);
    });

    it("orders rarity by power rather than alphabetically", async () => {
      const values = (await queries.itemFacets()).rarities.map((f) => f.value);

      expect(values.slice(0, 7)).toEqual([
        "none",
        "common",
        "uncommon",
        "rare",
        "very rare",
        "legendary",
        "artifact",
      ]);
    });

    /**
     * The value in the URL is the abbreviation and the label is the word, so a
     * filtered link survives a change of wording.
     */
    it("labels type codes with the name the vocabulary gives them", async () => {
      const facets = await queries.itemFacets();
      const heavy = facets.types.find((facet) => facet.value === "HA")!;

      expect(heavy.label).toBe("Heavy Armor");
      expect(facets.types.map((facet) => facet.label)).toEqual(
        [...facets.types.map((facet) => facet.label!)].sort((a, b) =>
          a.localeCompare(b),
        ),
      );
    });

    it("names the three categories for a player rather than a schema", async () => {
      const facets = await queries.itemFacets();

      expect(facets.categories.map((facet) => facet.label)).toEqual([
        "Magic items",
        "Equipment",
        "Groups",
      ]);
      expect(facets.categories.find((f) => f.value === "item")!.count).toBe(
        MAGIC_ITEM_COUNT,
      );
    });

    /** Unfiltered, a facet's counts have to add up to the corpus. */
    it("counts every item across the category facet", async () => {
      const facets = await queries.itemFacets();
      const total = facets.categories.reduce((sum, facet) => sum + facet.count, 0);

      expect(total).toBe(ITEM_COUNT);
    });

    /** Eight items carry neither a type nor a flag that stands in for one. */
    it("counts every typed item across the type facet", async () => {
      const facets = await queries.itemFacets();
      const total = facets.types.reduce((sum, facet) => sum + facet.count, 0);

      expect(total).toBe(ITEM_COUNT - 8);
    });

    /**
     * The whole point of the facet query: a facet is counted against the
     * *other* filters but not its own, so selecting one rarity does not zero
     * out every other one and strand the reader inside their own filter.
     */
    it("counts a facet against the other filters, not its own", async () => {
      const facets = await queries.itemFacets({ rarities: ["legendary"] });

      const legendary = facets.rarities.find((f) => f.value === "legendary")!;
      const common = facets.rarities.find((f) => f.value === "common")!;

      expect(legendary.selected).toBe(true);
      expect(common.count).toBeGreaterThan(0);

      // A different facet *is* narrowed by the selected rarity.
      const categories = facets.categories.reduce((sum, f) => sum + f.count, 0);
      expect(categories).toBeLessThan(ITEM_COUNT);
    });

    it("disables an option that would return nothing", async () => {
      // Nothing mundane requires attunement.
      const facets = await queries.itemFacets({
        categories: ["baseitem"],
        attunement: true,
      });

      expect(facets.rarities.some((facet) => facet.disabled)).toBe(true);
      // A selected option stays clickable even at zero, or the filter that
      // narrowed to nothing could never be undone from the rail.
      expect(facets.attunement.disabled).toBe(false);
    });

    it("counts the flag facets", async () => {
      const facets = await queries.itemFacets();

      expect(facets.attunement.count).toBe(1622);
      expect(facets.magic.count).toBe(2947);
    });
  });

  describe("itemVocabulary", () => {
    it("reads the corpus's own names for its codes", async () => {
      const { types, properties } = await queries.itemVocabulary();

      expect(types.get("HA")).toBe("Heavy Armor");
      expect(types.get("RG")).toBe("Ring");
      expect(properties.get("V")).toBe("Versatile");
      expect(properties.get("2H")).toBe("Two-Handed");
    });

    /** A property's name is the name of the rules entry that defines it. */
    it("covers every property abbreviation items cite", async () => {
      const { properties } = await queries.itemVocabulary();

      const cited = (await db.execute(
        sql`select distinct split_part(p, '|', 1) as code
            from items, lateral unnest(properties) p`,
      )) as unknown as { code: string }[];

      const missing = cited.filter((row) => !properties.has(row.code));
      expect(missing).toEqual([]);
    });
  });

  describe("getItem", () => {
    it("returns a magic item with everything the panel prints", async () => {
      const staff = await queries.getItem("item", "DMG", "staff-of-fire");

      expect(staff).not.toBeNull();
      expect(staff!.name).toBe("Staff of Fire");
      expect(staff!.sourceName).toBe("Dungeon Master's Guide");
      expect(staff!.rarity).toBe("very rare");
      // Typeless in the corpus, and typed by its `staff` flag here.
      expect(staff!.typeName).toBe("Staff");
      expect(attunementPhrase(staff!.data.reqAttune as string)).toBe(
        "requires attunement by a druid, sorcerer, warlock, or wizard",
      );
    });

    it("returns a base item with its equipment-table values", async () => {
      const sword = await queries.getItem("baseitem", "PHB", "longsword");

      expect(sword!.typeName).toBe("Melee Weapon");
      expect(formatItemValue(sword!.valueCp)).toBe("15 gp");
      expect(formatWeight(sword!.weightLb)).toBe("3 lb.");
      expect(sword!.properties).toEqual(["V"]);
      expect(sword!.data.dmg1).toBe("1d8");
    });

    /**
     * The one measured slug collision in the family: DMG `potion-of-healing` is
     * both an `item` and an `itemGroup`. The type is part of the key, which is
     * what keeps their two URLs distinct.
     */
    it("distinguishes two entity types sharing a slug", async () => {
      const potion = await queries.getItem("item", "dmg", "potion-of-healing");
      const group = await queries.getItem("itemGroup", "dmg", "potion-of-healing");

      expect(potion!.name).toBe("Potion of Healing");
      expect(group!.name).toBe("Potion of Healing (*)");
      expect(potion!.id).not.toBe(group!.id);
    });

    /** Source ids are mixed case in the data but lowercase in a URL. */
    it("matches the source case-insensitively", async () => {
      expect((await queries.getItem("baseitem", "phb", "dagger"))?.name).toBe(
        "Dagger",
      );
    });

    it("is null for an item that does not exist", async () => {
      expect(await queries.getItem("item", "dmg", "no-such-item")).toBeNull();
    });

    /**
     * The 1,852 generated variants are the corpus's magic-variant templates
     * applied to a base item. Unresolved, "+1 Longsword" would carry no damage,
     * no weight and no price of its own.
     */
    it("returns a generated variant with its base item's statistics", async () => {
      const sword = await queries.getItem("item", "DMG", "1-longsword");

      expect(sword!.data._baseName).toBe("Longsword");
      expect(sword!.data.dmg1).toBe("1d8");
      expect(sword!.weightLb).toBe(3);
    });
  });

  /**
   * The formatters over every item in the corpus.
   *
   * The printed line under an item's name is the one thing every panel shows,
   * so an empty one is a visibly broken panel — and the rows that produce one
   * are exactly the rows no fixture thought to include.
   */
  describe("the formatters over the whole corpus", () => {
    let all: {
      name: string;
      rarity: string | null;
      type_code: string | null;
      value_cp: number | null;
      weight_lb: number | null;
      data: Record<string, never>;
    }[];
    let types: ReadonlyMap<string, string>;

    beforeAll(async () => {
      all = (await db.execute(
        sql`select e.name, i.rarity, i.value_cp, i.weight_lb, i.data,
                   coalesce(
                     i.item_type,
                     case
                       when i.is_wondrous then 'WON'
                       when (i.data->>'staff')::boolean then 'STF'
                       when (i.data->>'poison')::boolean then 'PSN'
                     end
                   ) as type_code
            from items i join entities e on e.id = i.entity_id`,
      )) as unknown as typeof all;

      types = (await queries.itemVocabulary()).types;
    });

    it("has the expected number of items", () => {
      expect(all).toHaveLength(ITEM_COUNT);
    });

    /**
     * A code with no name would print as the abbreviation — "HA" where "Heavy
     * Armor" belongs — which is the corpus using a type this code has not seen.
     */
    it("names every type code the corpus uses", () => {
      const unnamed = all
        .filter((row) => row.type_code != null)
        .filter((row) => itemTypeName(row.type_code, types) === row.type_code)
        .map((row) => `${row.name}: ${row.type_code}`);

      expect(unnamed).toEqual([]);
    });

    /**
     * Every item says something about itself. The eight the type facet cannot
     * account for are all rated "unknown (magic)", so the rarity carries the
     * line where the type would have — which is why `rarityPhrase` keeps that
     * rating rather than treating it as another absence.
     */
    it("prints a line under the name of every item", () => {
      const empty = all
        .filter(
          (row) =>
            !formatItemTypeLine({
              typeName: itemTypeName(row.type_code, types),
              rarity: row.rarity,
              reqAttune: row.data.reqAttune,
            }),
        )
        .map((row) => row.name);

      expect(empty).toEqual([]);
    });

    it("prints a price for every item that has one", () => {
      const broken = all
        .filter((row) => row.value_cp != null && formatItemValue(row.value_cp) === "—")
        .map((row) => row.name);

      expect(broken).toEqual([]);
    });

    it("prints a weight for every item that has one", () => {
      const broken = all
        .filter((row) => row.weight_lb != null && formatWeight(row.weight_lb) === "—")
        .map((row) => row.name);

      expect(broken).toEqual([]);
    });

    /**
     * Attunement is a boolean for most items and a qualifying phrase for 272,
     * and a phrase that came through empty would silently drop the class
     * restriction that is the whole point of the line.
     */
    it("phrases attunement for every item that requires it", () => {
      const broken = all
        .filter((row) => row.data.reqAttune)
        .filter((row) => !attunementPhrase(row.data.reqAttune))
        .map((row) => row.name);

      expect(broken).toEqual([]);
    });
  });
});
