import { describe, expect, it } from "vitest";
import type { ReferenceIndex } from "@/lib/content/references";
import type { ItemDetail as ItemDetailRow } from "@/server/db/queries/items";
import { render, screen } from "@/test/render";
import { ItemDetail } from "./item-detail";

/**
 * An item as a reader meets it.
 *
 * `items.test.ts` proves each value formats correctly; nothing there proves
 * they reach the panel or are labelled. The failures this covers are the ones
 * that survive green formatters: a rule closing on nothing for an item with no
 * numbers, an em dash printed where a value is simply absent, and an item
 * group whose members arrive as dead text.
 */

const PROPERTIES = new Map([
  ["V", "Versatile"],
  ["T", "Thrown"],
  ["F", "Finesse"],
  ["L", "Light"],
]);

const REFS: ReferenceIndex = {
  "item|bag of tricks, gray|dmg": {
    name: "Bag of Tricks, Gray",
    entityType: "item",
    href: "/compendium/items/dmg/bag-of-tricks-gray",
  },
};

function item(over: Partial<ItemDetailRow> = {}): ItemDetailRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    naturalKey: "baseitem|longsword|phb",
    name: "Longsword",
    slug: "longsword",
    sourceId: "PHB",
    entityType: "baseitem",
    page: 149,
    sourceName: "Player's Handbook",
    typeCode: "M",
    typeName: "Melee Weapon",
    rarity: "none",
    itemType: "M",
    requiresAttunement: false,
    valueCp: 1500,
    weightLb: 3,
    armorClass: null,
    properties: ["V"],
    data: { dmg1: "1d8", dmg2: "1d10", dmgType: "S" },
    ...over,
  } as unknown as ItemDetailRow;
}

describe("the item detail", () => {
  it("identifies the item and where it was printed", () => {
    render(<ItemDetail item={item()} refs={{}} vocabulary={PROPERTIES} />);

    expect(screen.getByRole("heading", { name: "Longsword" })).toBeInTheDocument();
    expect(screen.getByText(/Player's Handbook/)).toBeInTheDocument();
    expect(screen.getByText(/p\. 149/)).toBeInTheDocument();
  });

  it("prints the equipment-table values under their own labels", () => {
    render(<ItemDetail item={item()} refs={{}} vocabulary={PROPERTIES} />);

    expect(screen.getByText(/1d8 slashing/)).toBeInTheDocument();
    expect(screen.getByText(/versatile \(1d10\)/)).toBeInTheDocument();
    expect(screen.getByText(/15 gp/)).toBeInTheDocument();
    expect(screen.getByText(/3 lb\./)).toBeInTheDocument();
  });

  /** "Adventuring Gear, none" would describe an absence rather than the item. */
  it("drops the rarity of a mundane item from the printed line", () => {
    render(<ItemDetail item={item()} refs={{}} vocabulary={PROPERTIES} />);

    expect(screen.getByText("Melee Weapon")).toBeInTheDocument();
  });

  it("names the base item a magic one was built on", () => {
    render(
      <ItemDetail
        item={item({
          name: "+1 Longsword",
          entityType: "item",
          rarity: "uncommon",
          data: { _baseName: "Longsword", dmg1: "1d8", dmgType: "S" },
        })}
        refs={{}}
        vocabulary={PROPERTIES}
      />,
    );

    expect(
      screen.getByText("Melee Weapon (longsword), uncommon"),
    ).toBeInTheDocument();
  });

  it("qualifies attunement where the item does", () => {
    render(
      <ItemDetail
        item={item({
          name: "Staff of Fire",
          entityType: "item",
          typeCode: "STF",
          typeName: "Staff",
          itemType: null,
          rarity: "very rare",
          data: { reqAttune: "by a druid, sorcerer, warlock, or wizard" },
        })}
        refs={{}}
        vocabulary={PROPERTIES}
      />,
    );

    expect(
      screen.getByText(
        "Staff, very rare (requires attunement by a druid, sorcerer, warlock, or wizard)",
      ),
    ).toBeInTheDocument();
  });

  /**
   * A Staff of Fire has no weight, no price and no damage. A block of em dashes
   * would say nothing about it, and a pair of rules closing on nothing is worse
   * than no rules at all.
   */
  it("prints no statistics block for an item that has no statistics", () => {
    const { container } = render(
      <ItemDetail
        item={item({
          name: "Staff of Fire",
          entityType: "item",
          rarity: "very rare",
          valueCp: null,
          weightLb: null,
          properties: null,
          data: { entries: ["You can use an action to expend charges."] },
        })}
        refs={{}}
        vocabulary={PROPERTIES}
      />,
    );

    expect(container.textContent).not.toContain("—");
    expect(screen.queryByText(/Weight/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/You can use an action to expend charges/),
    ).toBeInTheDocument();
  });

  it("spells out what armour adds to a wearer's armour class", () => {
    render(
      <ItemDetail
        item={item({
          name: "Half Plate Armor",
          typeCode: "MA",
          typeName: "Medium Armor",
          itemType: "MA",
          armorClass: 15,
          properties: null,
          data: { stealth: true, strength: "15" },
        })}
        refs={{}}
        vocabulary={PROPERTIES}
      />,
    );

    expect(screen.getByText(/15 \+ Dex modifier \(max 2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Str 15/)).toBeInTheDocument();
    expect(screen.getByText(/Disadvantage/)).toBeInTheDocument();
  });

  /**
   * Ingest expands a magic variant but leaves the prose it inherited full of
   * `{=baseName}` placeholders. Four items arrive that way, and without the
   * substitution they print the placeholder where the weapon's name belongs.
   */
  it("resolves the placeholders a variant inherited from its template", () => {
    render(
      <ItemDetail
        item={item({
          name: "Arrow of Slaying",
          entityType: "item",
          rarity: "very rare",
          properties: null,
          data: {
            _baseName: "Arrow",
            entries: ["{=baseName/at} {=baseName/l} of slaying is a magic weapon."],
          },
        })}
        refs={{}}
        vocabulary={PROPERTIES}
      />,
    );

    expect(
      screen.getByText("An arrow of slaying is a magic weapon."),
    ).toBeInTheDocument();
  });

  /**
   * What makes an item group worth opening: it exists only to point at its
   * members, and the books write them as bare names that nothing would
   * otherwise turn into links.
   */
  it("leaves an item group's members as links", () => {
    render(
      <ItemDetail
        item={item({
          name: "Bag of Tricks",
          entityType: "itemGroup",
          typeCode: "WON",
          typeName: "Wondrous Item",
          itemType: null,
          rarity: "uncommon",
          valueCp: null,
          weightLb: null,
          properties: null,
          data: { items: ["Bag of Tricks, Gray|DMG"] },
        })}
        refs={REFS}
        vocabulary={PROPERTIES}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Bag of Tricks, Gray" }),
    ).toHaveAttribute("href", "/compendium/items/dmg/bag-of-tricks-gray");
  });

  /** There is no page behind an item, so the only way out is to its source. */
  it("offers no way out to a page that does not exist", () => {
    render(<ItemDetail item={item()} refs={{}} vocabulary={PROPERTIES} />);

    const destinations = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(destinations).toEqual(["/sources/phb"]);
  });
});
