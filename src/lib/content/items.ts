/**
 * Formats an item's printed line and its physical statistics.
 *
 * Like the creature formatters, these read the raw `data` object rather than
 * the typed columns wherever the two disagree. The columns are for filtering:
 * `item_type_name` was projected by the schema but never populated by ingest,
 * so the human-readable type is resolved here from the books' own
 * `itemType` vocabulary instead of being read off the row.
 *
 * **Strings returned here may contain `{@tag}` markup and must be rendered
 * through `Inline`.** An item's damage cites nothing, but the base item it was
 * built from and its prose both do.
 *
 * Shapes were measured over all 3,645 items in the books — 3,448 `item`, 124
 * `baseitem` and 73 `itemGroup` rows — and the counts in the comments say how
 * many take each branch.
 */

import { getPath, walkStrings } from "./walk";

const EM_DASH = "—";

/* ------------------------------------------------------------------ *
 * Type
 * ------------------------------------------------------------------ */

/**
 * Types the books do not name but flag.
 *
 * 776 items are `wondrous`, 29 are typeless staffs and 21 are poisons, and none
 * of the three has an entry in the `itemType` vocabulary — an item with no type
 * at all would be unfilterable and would print a bare rarity. The codes are
 * ours, chosen not to collide with the 34 real abbreviations.
 */
export const SYNTHETIC_ITEM_TYPES: Record<string, string> = {
  WON: "Wondrous Item",
  STF: "Staff",
  PSN: "Poison",
};

/**
 * The display name for a type abbreviation.
 *
 * `vocabulary` is the books' own `itemType` support data, so the 34 real
 * abbreviations are never duplicated here — pass the map the query loaded. An
 * abbreviation neither side knows is returned unchanged rather than dropped,
 * which keeps a new book's type visible instead of silently blank.
 */
export function itemTypeName(
  abbreviation: string | null | undefined,
  vocabulary: ReadonlyMap<string, string>,
): string | null {
  if (!abbreviation) return null;
  return (
    vocabulary.get(abbreviation) ??
    SYNTHETIC_ITEM_TYPES[abbreviation] ??
    abbreviation
  );
}

/**
 * Strip the source a reference carries: `AF|DMG` is the ammunition property
 * defined in the DMG, and both the type and property columns store that form.
 * The part before the pipe is the key the vocabulary is indexed by.
 */
export function bareCode(value: string): string {
  return value.split("|")[0]!;
}

/**
 * The name of the item a magic one was built on, as it reads inside the type
 * line: "longsword", "plate armor".
 *
 * Two sources, because the books record it twice. 205 items point at their
 * base with `baseItem: "longsword|phb"`, and the 1,852 generated variants carry
 * `_baseName: "Longsword"` instead. Both are lowercased — the line reads
 * "Weapon (longsword)", never "Weapon (Longsword)".
 */
export function baseItemName(data: {
  baseItem?: string;
  _baseName?: string;
}): string | null {
  const referenced = data.baseItem ? bareCode(data.baseItem) : null;
  const name = referenced ?? data._baseName ?? null;
  return name ? name.toLowerCase() : null;
}

/* ------------------------------------------------------------------ *
 * Rarity and attunement
 * ------------------------------------------------------------------ */

/**
 * Rarity from weakest to strongest, with the four non-ratings after it.
 *
 * Alphabetical order is actively wrong here — it puts "artifact" first,
 * "uncommon" after "rare", and "very rare" last of the real tiers — and a rail
 * that lists power out of order is worse than one with no order at all.
 */
export const RARITY_ORDER = [
  "none",
  "common",
  "uncommon",
  "rare",
  "very rare",
  "legendary",
  "artifact",
  "varies",
  "unknown",
  "unknown (magic)",
];

/** Where a rarity sits on that scale. Anything unlisted sorts to the end. */
export function rarityRank(rarity: string | null | undefined): number {
  const index = rarity == null ? -1 : RARITY_ORDER.indexOf(rarity);
  return index === -1 ? RARITY_ORDER.length : index;
}

/** "Very rare", "Unknown (magic)" — stored lowercase, shown as a label. */
export function rarityLabel(rarity: string): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

/**
 * The same, in a table column: "Very rare", or an em dash where the item has no
 * rating worth a cell.
 *
 * 699 items are rated "none" or "unknown", and a column reading "None" down
 * that many rows is noise where an empty cell is the fact. "Unknown (magic)" is
 * shortened because the column is already headed Rarity.
 */
export function rarityColumnLabel(rarity: string | null | undefined): string {
  if (!rarity || rarity === "none" || rarity === "unknown") return EM_DASH;
  if (rarity === "unknown (magic)") return "Unknown";
  return rarityLabel(rarity);
}

/**
 * How a rarity reads inside the type line, or null where it says nothing.
 *
 * "none" and "unknown" are omitted: 544 mundane items are rated "none", and
 * printing "Adventuring Gear, none" describes an absence rather than the item.
 * The other two are kept but reworded — "Ring, varies" is not a sentence, and
 * the 289 items rated "unknown (magic)" are magical with an unstated tier,
 * which is a fact worth carrying rather than hiding.
 */
export function rarityPhrase(rarity: string | null | undefined): string | null {
  if (!rarity || rarity === "none" || rarity === "unknown") return null;
  if (rarity === "varies") return "rarity varies";
  if (rarity === "unknown (magic)") return "rarity unknown";
  return rarity;
}

/**
 * "(requires attunement by a wizard)".
 *
 * `reqAttune` is a boolean for 1,350 items and a qualifying phrase for 272 more
 * — "by a spellcaster", "by a creature of good alignment". Twelve say
 * "optional", which is not a qualifier but a different statement entirely, so
 * it gets its own wording rather than "requires attunement by optional".
 */
export function attunementPhrase(
  reqAttune: boolean | string | null | undefined,
): string | null {
  if (!reqAttune) return null;
  if (reqAttune === true) return "requires attunement";
  if (reqAttune === "optional") return "attunement optional";
  return `requires attunement ${reqAttune}`;
}

/**
 * The italic line under an item's name: "Weapon (longsword), rare (requires
 * attunement by a spellcaster)".
 *
 * Every part is optional and the punctuation follows what is present, because
 * all three combinations occur — a mundane torch has only a type, an artifact
 * of unknown make has only a rarity, and 8 items have neither.
 */
export function formatItemTypeLine(item: {
  typeName?: string | null;
  baseName?: string | null;
  rarity?: string | null;
  reqAttune?: boolean | string | null;
}): string {
  const type = item.typeName
    ? item.baseName
      ? `${item.typeName} (${item.baseName})`
      : item.typeName
    : null;

  const head = [type, rarityPhrase(item.rarity)].filter(Boolean).join(", ");
  const attunement = attunementPhrase(item.reqAttune);

  if (!head) return attunement ? capitalise(attunement) : "";
  return attunement ? `${head} (${attunement})` : head;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* ------------------------------------------------------------------ *
 * Money and weight
 * ------------------------------------------------------------------ */

/**
 * "15 gp", "5 sp", "1 cp".
 *
 * Value is stored in copper so that mixed denominations sort against each
 * other, and printed in the largest coin that divides it exactly — which is
 * how the equipment tables print it, and why a longsword is 15 gp rather than
 * 1,500 cp. The books hold values from 1 cp to 10,000 gp.
 */
export function formatItemValue(valueCp: number | null | undefined): string {
  if (valueCp == null) return EM_DASH;
  if (valueCp === 0) return "0 gp";

  if (valueCp % 100 === 0) return `${groupDigits(valueCp / 100)} gp`;
  if (valueCp % 10 === 0) return `${groupDigits(valueCp / 10)} sp`;
  return `${groupDigits(valueCp)} cp`;
}

/**
 * "3 lb.", "1/2 lb.", "1 1/2 lb.".
 *
 * Halves and quarters are written as fractions, as the equipment tables do: a
 * potion weighs 1/2 lb., never 0.5 lb. The books also hold eleven other
 * fractions — a coin is 0.02 lb. and a sling bullet 0.0625 — and those are
 * printed as the decimals they are rather than rounded into a fraction they do
 * not equal.
 */
export function formatWeight(weightLb: number | null | undefined): string {
  if (weightLb == null) return EM_DASH;

  const whole = Math.floor(weightLb);
  const fraction = weightLb - whole;

  if (fraction === 0) return `${groupDigits(whole)} lb.`;
  if (fraction !== 0.5 && fraction !== 0.25) return `${decimal(weightLb)} lb.`;

  const fractionText = fraction === 0.5 ? "1/2" : "1/4";
  return whole === 0
    ? `${fractionText} lb.`
    : `${groupDigits(whole)} ${fractionText} lb.`;
}

/** Fixed locale, so the separator does not vary by reader. */
function groupDigits(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * The same, for a value with a fractional part. The default of three decimal
 * places rounds a sling bullet's 0.0625 lb. to 0.063, so it is raised to four
 * — the most precision any weight in the books carries.
 */
function decimal(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/* ------------------------------------------------------------------ *
 * Weapons and armour
 * ------------------------------------------------------------------ */

/**
 * Damage type codes, as the books write them. The full rules vocabulary is
 * listed even though weapons exercise only seven of it — the map belongs to the
 * damage type, not to the subset of weapons that happen to deal it.
 */
const DAMAGE_TYPES: Record<string, string> = {
  A: "acid",
  B: "bludgeoning",
  C: "cold",
  F: "fire",
  I: "poison",
  L: "lightning",
  N: "necrotic",
  O: "force",
  P: "piercing",
  R: "radiant",
  S: "slashing",
  T: "thunder",
  Y: "psychic",
};

export function damageTypeName(code: string | null | undefined): string | null {
  if (!code) return null;
  return DAMAGE_TYPES[code] ?? code;
}

/** "1d8 slashing". The versatile die is a property, not a second damage line. */
export function formatDamage(
  dice: string | null | undefined,
  type: string | null | undefined,
): string | null {
  if (!dice) return null;
  const name = damageTypeName(type);
  return name ? `${dice} ${name}` : dice;
}

/**
 * One weapon property, expanded the way the equipment table prints it.
 *
 * Three of them carry a number that lives elsewhere on the item: versatile
 * names the two-handed die, and thrown and ammunition both name the range. A
 * bare "versatile" is the one piece of a weapon's line a reader cannot look up
 * anywhere else on the item, so the qualifier is not decoration.
 */
export function formatProperty(
  code: string,
  vocabulary: ReadonlyMap<string, string>,
  data: { dmg2?: string; range?: string },
): string {
  const key = bareCode(code);
  const name = (vocabulary.get(key) ?? key).toLowerCase();

  if (key === "V" && data.dmg2) return `${name} (${data.dmg2})`;
  if ((key === "T" || key === "A" || key === "AF") && data.range) {
    return `${name} (range ${data.range})`;
  }

  return name;
}

/** "finesse, light, thrown (range 20/60)" — in the order the item lists them. */
export function formatProperties(
  properties: string[] | null | undefined,
  vocabulary: ReadonlyMap<string, string>,
  data: { dmg2?: string; range?: string },
): string {
  if (!properties?.length) return "";
  return properties
    .map((code) => formatProperty(code, vocabulary, data))
    .join(", ");
}

/**
 * "13 + Dex modifier (max 2)", the way an armour row reads.
 *
 * `ac` is the base number and the type decides what is added to it: light
 * armour adds the whole Dexterity modifier, medium armour caps it, and heavy
 * armour adds none. The type is passed in rather than inferred from the number,
 * because 12 is a valid base for both light and medium.
 *
 * `dexterityMax` is read with `in` rather than for a value, because the books
 * uses its presence and its null differently: Serpent Scale Armor is medium
 * armour that sets it explicitly to null, meaning the usual cap of 2 does not
 * apply to it at all.
 */
export function formatItemArmorClass(
  ac: number | null | undefined,
  itemType: string | null | undefined,
  data: { dexterityMax?: number | null } = {},
): string | null {
  if (ac == null) return null;

  // A shield's value is a bonus to someone else's AC, not an AC of its own.
  if (itemType === "S") return `+${ac}`;

  if (itemType === "LA") return `${ac} + Dex modifier`;

  if (itemType === "MA") {
    if (!("dexterityMax" in data)) return `${ac} + Dex modifier (max 2)`;
    const cap = data.dexterityMax;
    return cap == null
      ? `${ac} + Dex modifier`
      : `${ac} + Dex modifier (max ${cap})`;
  }

  return String(ac);
}

/* ------------------------------------------------------------------ *
 * Base name substitution
 * ------------------------------------------------------------------ */

/**
 * `{=baseName}` placeholders, resolved against the item a variant was built on.
 *
 * A magic-variant template is written generically so that every item it applies
 * to reads correctly — "Arrow of Slaying" and "Crossbow Bolt of Slaying" share
 * one paragraph, which says `{=baseName/at} {=baseName/l} of slaying`. Ingest
 * expands the variant but leaves the placeholders standing, so four items in
 * the books reach the renderer with 40 of them between them and print
 * `{=baseName/l}` where a word belongs.
 *
 * The modifiers are the books' own, applied left to right: `l` lowercases,
 * `t` title-cases, `u` uppercases, and `a` replaces the name with the
 * indefinite article it takes. So `/at` is "An" and `/a` is "an".
 */
const BASE_NAME_PATTERN = /\{=baseName(?:\/([a-z]+))?\}/g;

export function applyBaseName(text: string, baseName: string): string {
  if (!text.includes("{=baseName")) return text;

  return text.replace(BASE_NAME_PATTERN, (_match, modifiers: string | undefined) => {
    let value = baseName;

    for (const modifier of modifiers ?? "") {
      if (modifier === "a") value = indefiniteArticle(value);
      else if (modifier === "l") value = value.toLowerCase();
      else if (modifier === "u") value = value.toUpperCase();
      else if (modifier === "t") value = titleCase(value);
    }

    return value;
  });
}

/**
 * "an" before a vowel, "a" otherwise — which is what the books' `a` modifier
 * means: it replaces the name rather than prefixing it, so the sentence writes
 * the article and the name as two separate placeholders.
 */
function indefiniteArticle(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

/* ------------------------------------------------------------------ *
 * Shared entries
 * ------------------------------------------------------------------ */

/**
 * `{#itemEntry Name}` citations, resolved against the shared description they
 * name.
 *
 * The books write a description that many items share exactly once and cites
 * it from each of them, as a literal string standing where a paragraph belongs.
 * `splitByTags` opens a tag only on `{@` or `{=`, so `{#…}` falls through as
 * text and 170 items print the citation instead of the prose: for 36 of them —
 * Potion of Fire Resistance, Acid Absorbing Tattoo, Red Chromatic Rose — the
 * citation is the *whole* description.
 *
 * The referent is already ingested, as six `support_data` rows of kind
 * `itemEntry`, so this is a lookup the app was never performing rather than
 * anything missing from the data.
 *
 * All 170 occurrences are a whole top-level element of `entries` (measured), so
 * a citation is matched as an entire string rather than scanned for inside one.
 */
const ITEM_ENTRY_PATTERN = /^\{#itemEntry\s+([^}|]+?)\s*(?:\|\s*([^}|]+?)\s*)?\}$/;

export interface ItemEntryTag {
  name: string;
  /** Absent on the DMG citations, which mean "the book I am in". */
  source: string | null;
}

export function parseItemEntryTag(text: string): ItemEntryTag | null {
  const match = ITEM_ENTRY_PATTERN.exec(text.trim());
  if (!match) return null;

  return { name: match[1]!, source: match[2] ?? null };
}

/**
 * How a citation addresses a template: `name|source`, lowercased, which is how
 * `support_data` keys them.
 *
 * A citation with no source means the book it is written in. The three
 * sourceless forms — Potion, Ring and Armor of Resistance — are all cited from
 * DMG items and all resolve to DMG templates; the grenades name `Grenade|DMG`
 * explicitly because two of the five are in QftIS. All 170 resolve under this
 * rule.
 */
export function itemEntryKey(
  name: string,
  source: string | null,
  itemSource: string,
): string {
  return `${name.toLowerCase()}|${(source ?? itemSource).toLowerCase()}`;
}

/**
 * `{{item.resist}}` and `{{item.detail1}}`, filled from the citing item.
 *
 * A template is written once for every item that shares it, so the two facts
 * that differ between them are read off the item rather than written into the
 * prose — which is what lets one paragraph serve 130 Armor of Resistance
 * variants. Both are the books' own placeholders and both are the only ones
 * it uses.
 *
 * An array joins with commas (`resist` is length 1 on every item carrying one),
 * and a value the item does not have substitutes nothing rather than leaving
 * the placeholder standing.
 */
const ITEM_PLACEHOLDER_PATTERN = /\{\{item\.([\w.]+)\}\}/g;

export function applyItemPlaceholders(
  text: string,
  data: Record<string, unknown>,
): string {
  if (!text.includes("{{item.")) return text;

  return text.replace(ITEM_PLACEHOLDER_PATTERN, (_match, path: string) => {
    const value = getPath(data, path.split("."));
    if (value == null) return "";
    return Array.isArray(value) ? value.join(", ") : String(value);
  });
}

/**
 * An item's entries with every citation replaced by the description it names.
 *
 * Spliced rather than nested: a template is an array of entries and the
 * citation is one element, so the template's entries take its place in the
 * list. A citation naming a template that does not exist is dropped — printing
 * the markup is what this exists to stop.
 *
 * Done in the query rather than the renderer, so that everything downstream is
 * handed prose: the panel sets the `{@dc}` and `{@damage}` tags a template
 * carries as it sets any others, `applyBaseName` runs over the spliced text
 * too, and a reference a template gains later resolves in the same pass as the
 * item's own rather than needing a second one.
 */
export function resolveItemEntries(
  entries: unknown,
  data: Record<string, unknown>,
  templates: ReadonlyMap<string, unknown[]>,
): unknown {
  if (!Array.isArray(entries)) return entries;

  const itemSource = typeof data["source"] === "string" ? data["source"] : "";

  return entries.flatMap((entry) => {
    if (typeof entry !== "string") return [entry];

    const tag = parseItemEntryTag(entry);
    if (!tag) return [entry];

    const template = templates.get(itemEntryKey(tag.name, tag.source, itemSource));
    if (!template) return [];

    return walkStrings(template, (text) => applyItemPlaceholders(text, data));
  });
}

/* ------------------------------------------------------------------ *
 * Item groups
 * ------------------------------------------------------------------ */

/**
 * An item group's members, as tag markup the renderer can resolve.
 *
 * The 73 groups list what they cover as bare names — `"Bag of Tricks, Gray"`,
 * or `"Potion of Healing|DMG"` for the 244 that name a source. Written that way
 * they are invisible to `collectReferences`, which only sees `{@tag}` markup,
 * so a group would print its members as dead text. Wrapping them in the tag the
 * the books would have used makes them resolve through the same path as every
 * other cross-reference — and an unresolvable one renders as plain text, which
 * is exactly what it was before.
 */
export function itemGroupTags(data: { items?: string[] }): string[] {
  return (data.items ?? []).map((member) => `{@item ${member}}`);
}

/**
 * "Str 15" — the minimum Strength heavy armour asks for.
 *
 * Stored as a string for 122 items and as an explicit null for 19 more, which
 * is the books' way of saying "no requirement" rather than leaving the key
 * out.
 */
export function formatStrengthRequirement(
  strength: string | number | null | undefined,
): string | null {
  if (strength == null || strength === "") return null;
  return `Str ${strength}`;
}
