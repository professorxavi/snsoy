import type { EntityType } from "@/server/db/schema/enums";
import { splitByTags, type TagSegment } from "./tags";

/**
 * Classifies inline `{@tag}` markup and resolves the tags that point at other
 * entities.
 *
 * Tags fall into four kinds, which the renderer styles differently: `reference`
 * (links to an entity), `roll` (dice, interactive but goes nowhere), `format`
 * (bold, italic) and `plain` (recognised but not yet actionable). Unknown tags
 * are reported to the coverage report rather than silently dropped.
 *
 * No React and no database access here — ingest uses the same tokenizer.
 */

/* ------------------------------------------------------------------ *
 * Reference tags
 * ------------------------------------------------------------------ */

/**
 * Tag name to the entity type it addresses, and the source assumed when the tag
 * omits one. Note the vocabularies differ: `{@creature}` addresses a `monster`.
 */
const REFERENCE_TAGS = {
  spell: { type: "spell", defaultSource: "phb" },
  creature: { type: "monster", defaultSource: "mm" },
  item: { type: "item", defaultSource: "dmg" },
  condition: { type: "condition", defaultSource: "phb" },
  status: { type: "status", defaultSource: "phb" },
  skill: { type: "skill", defaultSource: "phb" },
  sense: { type: "sense", defaultSource: "phb" },
  action: { type: "action", defaultSource: "phb" },
  race: { type: "race", defaultSource: "phb" },
  feat: { type: "feat", defaultSource: "phb" },
  background: { type: "background", defaultSource: "phb" },
  class: { type: "class", defaultSource: "phb" },
  optfeature: { type: "optionalfeature", defaultSource: "phb" },
  reward: { type: "reward", defaultSource: "dmg" },
  disease: { type: "disease", defaultSource: "dmg" },
  hazard: { type: "hazard", defaultSource: "dmg" },
  object: { type: "object", defaultSource: "dmg" },
  trap: { type: "trap", defaultSource: "dmg" },
  vehicle: { type: "vehicle", defaultSource: "gos" },
  vehupgrade: { type: "vehicleUpgrade", defaultSource: "gos" },
  psionic: { type: "psionic", defaultSource: "utwbtw" },
  language: { type: "language", defaultSource: "phb" },
  variantrule: { type: "variantrule", defaultSource: "dmg" },
  table: { type: "table", defaultSource: "dmg" },
  boon: { type: "boon", defaultSource: "mtf" },
  cult: { type: "cult", defaultSource: "mtf" },
  deck: { type: "deck", defaultSource: "dmg" },
  charoption: { type: "charoption", defaultSource: "mot" },
} as const satisfies Record<
  string,
  { type: EntityType; defaultSource: string }
>;

/** Tags whose natural key needs more than `type|name|source` to be unique. */
const STRUCTURAL_REFERENCE_TAGS = new Set([
  "classFeature",
  "subclassFeature",
  "deity",
  "card",
  "book",
  "adventure",
]);

const ROLL_TAGS = new Set([
  "damage",
  "dice",
  "scaledamage",
  "scaledice",
  "hit",
  "dc",
  "d20",
  "chance",
  "recharge",
  "coinflip",
  "skillCheck",
  // Not a number at all — it stands in for one the reader supplies. Styled as a
  // roll because that is what it occupies the place of.
  "hitYourSpellAttack",
]);

/**
 * Stage directions in an action's text, not part of the sentence: the attack
 * line a stat block opens with and the "Hit:" that introduces its damage.
 *
 * Set apart as a kind of their own because print sets them apart too — bold
 * italic, mid-paragraph — and because they are the single largest gap in the
 * renderer: `{@atk}` and `{@h}` occur 11,496 times across the bestiary and
 * nowhere else, so until now every monster attack rendered two unsupported-tag
 * markers.
 *
 * `{@m}` is the opposite extreme at two occurrences, both a spelljammer's
 * ramming attack, and it was found by sweeping the vehicles through the panel
 * — nothing cheaper would have met it.
 */
const CUE_TAGS = new Set(["atk", "h", "m", "hom"]);

/** Tag name to the HTML emphasis it stands for. */
export const FORMAT_TAGS = {
  b: "bold",
  bold: "bold",
  i: "italic",
  italic: "italic",
  u: "underline",
  underline: "underline",
  s: "strike",
  strike: "strike",
  highlight: "highlight",
  note: "note",
} as const;

export type FormatKind = (typeof FORMAT_TAGS)[keyof typeof FORMAT_TAGS];

/**
 * Recognised but not yet actionable. Listed so they stay out of the unknown-tag
 * report, which should only contain genuine gaps.
 *
 * `style` and `link` are here as the lesser of two losses rather than because
 * they are finished. `{@style name|small-caps}` loses its small caps and
 * `{@link text|url}` loses its URL, but both keep their words — and a sentence
 * missing a typographic flourish reads better than one interrupted by a red
 * unsupported-tag marker.
 *
 * `itemProperty` is here because there is nothing for it to open. It addresses
 * a weapon property — finesse, loading, two-handed — which lives in
 * `support_data` as vocabulary rather than as an entity, so it has no natural
 * key, no page and no aside. All 17 occurrences carry their own display text,
 * so the words survive intact; see `labelForTag`.
 */
const PLAIN_TAGS = new Set([
  "filter",
  "quickref",
  "5etools",
  "footnote",
  "style",
  "link",
  "itemProperty",
  "unit",
  // Every recipe came from the cookbooks, which we do not carry. The tag is
  // left rendering its own words, which is what the books print anyway.
  "recipe",
]);

export type TagKind =
  | "reference"
  | "anchor"
  | "roll"
  | "format"
  | "cue"
  | "plain"
  | "unknown";

export function kindOfTag(name: string): TagKind {
  if (name in REFERENCE_TAGS || STRUCTURAL_REFERENCE_TAGS.has(name)) {
    return "reference";
  }
  if (name === "area") return "anchor";
  if (ROLL_TAGS.has(name)) return "roll";
  if (name in FORMAT_TAGS) return "format";
  if (CUE_TAGS.has(name)) return "cue";
  if (PLAIN_TAGS.has(name)) return "plain";
  return "unknown";
}

/* ------------------------------------------------------------------ *
 * Anchors
 * ------------------------------------------------------------------ */

/**
 * `{@area Aarakocra|59f|x}` — a book pointing at one of its own numbered
 * locations. Unlike every other reference this addresses a position *inside* a
 * chapter rather than an entity: `59f` is the `id` the source data hangs on the
 * entry node itself, so there is no natural key and nothing in `entities` to
 * resolve against. Hence a kind of its own.
 *
 * The tag occurs in `book_sections` and nowhere else — no creature, item or
 * spell writes one — so only a chapter page ever supplies an `AreaIndex`.
 */
export function areaTargetForTag(tag: TagSegment): string | null {
  if (tag.kind !== "tag" || tag.name !== "area") return null;
  return part(tag, 1) || null;
}

/** Entry id to the URL that reaches it: `#59f` in this chapter, a path across. */
export type AreaIndex = Readonly<Record<string, string>>;

/**
 * The ids a page must mark, so a link from another chapter has somewhere to
 * land. Keyed by id — a record rather than a Set because it crosses the
 * server/client boundary, the same reason `ReferenceIndex` is one.
 *
 * Book-wide, not page-wide: a page cannot know it is a target by reading its
 * own text, since the tag pointing at it is written somewhere else.
 */
export type AnchoredIds = Readonly<Record<string, true>>;

export const EMPTY_AREAS: AreaIndex = Object.freeze({});

export const EMPTY_ANCHORS: AnchoredIds = Object.freeze({});

/**
 * Every area id a page points at, so one query can resolve them all. The mirror
 * of `collectReferences`, and separate from it because the two resolve against
 * different things.
 */
export function collectAreaTargets(value: unknown): Set<string> {
  const found = new Set<string>();

  const visitString = (text: string) => {
    if (!text.includes("{@")) return;
    for (const segment of splitByTags(text)) {
      if (segment.kind !== "tag") continue;

      const target = areaTargetForTag(segment);
      if (target) found.add(target);

      for (const nested of segment.parts) visitString(nested);
    }
  };

  const visit = (node: unknown) => {
    if (typeof node === "string") return visitString(node);
    if (Array.isArray(node)) return node.forEach(visit);
    if (node && typeof node === "object") Object.values(node).forEach(visit);
  };

  visit(value);
  return found;
}

/* ------------------------------------------------------------------ *
 * Resolved references
 * ------------------------------------------------------------------ */

/** A reference target, once the database has confirmed it exists. */
export interface ResolvedReference {
  /** The entity's real name, used when a tag supplies no display override. */
  name: string;
  entityType: EntityType;
  /** Null when the target exists but has no page of its own. */
  href: string | null;
}

/**
 * Natural key to target, for everything one page refers to. A plain object
 * rather than a Map so it serializes across the server/client boundary.
 */
export type ReferenceIndex = Readonly<Record<string, ResolvedReference>>;

export const EMPTY_REFERENCES: ReferenceIndex = Object.freeze({});

/** The first candidate key that resolved. */
export function lookupReference(
  candidates: readonly string[],
  index: ReferenceIndex,
): { key: string; target: ResolvedReference } | null {
  for (const key of candidates) {
    const target = index[key];
    if (target) return { key, target };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Natural keys
 * ------------------------------------------------------------------ */

const part = (tag: TagSegment & { kind: "tag" }, index: number): string =>
  (tag.parts[index] ?? "").trim();

/** `|` with nothing between it means "use the default", not "empty source". */
const sourceOr = (value: string, fallback: string): string =>
  (value || fallback).toLowerCase();

/** `dwarf (hill)` — how a race tag names a subrace. */
const QUALIFIED_NAME = /^(.+?)\s*\((.+)\)$/;

/**
 * The natural keys a reference tag might point at, best candidate first.
 *
 * Returns several because a tag name does not determine an entity type:
 * `{@item club}` may be an `item`, `baseitem` or `itemGroup`, and
 * `{@race dwarf (hill)}` is the subrace `subrace|hill|dwarf|phb|phb`.
 *
 * Resolve by natural key, never by slugifying the tag name. Slugs are derived
 * at ingest ("Melf's Acid Arrow" becomes "melfs-acid-arrow") and guessing them
 * produces dead links.
 */
export function candidateKeysForTag(tag: TagSegment): string[] {
  if (tag.kind !== "tag") return [];

  const name = part(tag, 0).toLowerCase();

  if (tag.name in REFERENCE_TAGS) {
    const spec = REFERENCE_TAGS[tag.name as keyof typeof REFERENCE_TAGS];
    if (!name) return [];
    const source = sourceOr(part(tag, 1), spec.defaultSource);

    if (tag.name === "item") {
      // Mundane gear, magic items and item groups all arrive as {@item}.
      return [
        `item|${name}|${source}`,
        `baseitem|${name}|${source}`,
        `itemgroup|${name}|${source}`,
      ];
    }

    if (tag.name === "race") {
      const qualified = QUALIFIED_NAME.exec(name);
      // A subrace key carries its parent race's source as well as its own, and
      // the two differ whenever the subrace was printed in a later book than
      // the race. The citing tag only ever names one source, so try the
      // parent's usual home as well.
      return qualified
        ? [
            `race|${name}|${source}`,
            `subrace|${qualified[2]}|${qualified[1]}|${source}|${source}`,
            ...(source === "phb"
              ? []
              : [`subrace|${qualified[2]}|${qualified[1]}|phb|${source}`]),
          ]
        : [`race|${name}|${source}`];
    }

    return [`${spec.type.toLowerCase()}|${name}|${source}`];
  }

  switch (tag.name) {
    // `{@book display|SOURCE|chapter|header}`. The chapter is an index, which
    // is why it stays in the natural key and never reaches a URL.
    case "book":
    case "adventure": {
      const source = part(tag, 1).toLowerCase();
      const chapter = part(tag, 2);
      return source && chapter ? [`booksection|${source}|${chapter}`] : [];
    }

    /** `{@classFeature name|class|classSource|level|source}` */
    case "classFeature": {
      const className = part(tag, 1).toLowerCase();
      const classSource = sourceOr(part(tag, 2), "phb");
      const level = part(tag, 3);
      if (!name || !className || !level) return [];
      return [
        `classfeature|${name}|${className}|${classSource}|${level}|${sourceOr(part(tag, 4), classSource)}`,
      ];
    }

    /** `{@subclassFeature name|class|classSource|subclass|subclassSource|level|source}` */
    case "subclassFeature": {
      const className = part(tag, 1).toLowerCase();
      const classSource = sourceOr(part(tag, 2), "phb");
      const subclass = part(tag, 3).toLowerCase();
      const subclassSource = sourceOr(part(tag, 4), classSource);
      const level = part(tag, 5);
      if (!name || !className || !subclass || !level) return [];
      return [
        `subclassfeature|${name}|${className}|${classSource}|${subclass}|${subclassSource}|${level}|${sourceOr(part(tag, 6), subclassSource)}`,
      ];
    }

    /** `{@deity name|pantheon|source}` */
    case "deity": {
      if (!name) return [];
      const pantheon = part(tag, 1).toLowerCase() || "forgotten realms";
      return [`deity|${name}|${pantheon}|${sourceOr(part(tag, 2), "phb")}`];
    }

    /*
     * `{@card name|deck|source|display}`. The deck is part of the address, not
     * decoration: five decks deal a card called Jester and only the set tells
     * them apart. Every one of the 677 tags in the books names its deck, so
     * there is no keyless form to fall back to.
     */
    case "card": {
      const set = part(tag, 1).toLowerCase();
      if (!name || !set) return [];
      return [`card|${name}|${set}|${sourceOr(part(tag, 2), "dmg")}`];
    }

    default:
      return [];
  }
}

/**
 * The tag that addresses what a statblock's `prop` names. `prop` is written in
 * entity-property vocabulary rather than tag vocabulary, and the two differ for
 * creatures — the property is `monster`, the tag is `{@creature}`. Anything not
 * listed here has no tag that reaches it.
 */
const PROP_TAGS: Record<string, string> = {
  monster: "creature",
};

/**
 * A `statblock` entry addresses another entity the same way an inline tag does,
 * so it resolves through the same index rather than a second mechanism.
 *
 * `tag` carries a tag name directly; `prop` names an entity property instead,
 * and its fluff variants (`monsterFluff`) point at the entity whose fluff it is.
 */
export function candidateKeysForStatblock(entry: {
  tag?: string;
  prop?: string;
  name?: string;
  source?: string;
}): string[] {
  const name = entry.name?.trim();
  if (!name) return [];

  let kind = entry.tag;
  if (!kind && entry.prop) {
    const prop = entry.prop.replace(/Fluff$/, "");
    kind = PROP_TAGS[prop] ?? prop;
  }
  if (!kind) return [];

  return candidateKeysForTag({
    kind: "tag",
    name: kind,
    parts: [name, entry.source ?? ""],
    raw: "",
  });
}

/**
 * The natural key of the entity a fragment renders inside. Derived from the
 * fragment's own key, which already carries the parent's identity:
 *
 *   subrace|hill|dwarf|phb|phb                  -> race|dwarf|phb
 *   classfeature|divine sense|paladin|phb|1|phb -> class|paladin|phb
 *
 * Read the parent's source from the key rather than reusing the fragment's;
 * they differ routinely.
 */
export function parentKeyFor(naturalKey: string): string | null {
  const parts = naturalKey.split("|");

  switch (parts[0]) {
    /** subrace|name|race|raceSource|source */
    case "subrace":
      return parts.length >= 4 ? `race|${parts[2]}|${parts[3]}` : null;

    /** subclass|shortName|class|classSource|source */
    case "subclass":
      return parts.length >= 4 ? `class|${parts[2]}|${parts[3]}` : null;

    /** classfeature|name|class|classSource|level|source */
    case "classfeature":
      return parts.length >= 4 ? `class|${parts[2]}|${parts[3]}` : null;

    /** subclassfeature|name|class|classSource|subclass|subclassSource|level|source */
    case "subclassfeature":
      return parts.length >= 6
        ? `subclass|${parts[4]}|${parts[2]}|${parts[3]}|${parts[5]}`
        : null;

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

/** Which part carries the display override, for tags where it is not part 2. */
const LABEL_PART: Record<string, number> = {
  classFeature: 5,
  subclassFeature: 7,
  deity: 3,
  card: 3,
  damage: 1,
  dice: 1,
  hit: 1,
  dc: 1,
  d20: 1,
  recharge: 1,
  coinflip: 1,
};

/**
 * The attack line a stat block's action opens with: `{@atk mw}` is "Melee
 * Weapon Attack:", `{@atk ms,rs}` is "Melee or Ranged Spell Attack:".
 *
 * Built from the codes rather than looked up, because they combine: the first
 * letter is the reach and the second the kind, and an attack usable both ways
 * lists two codes that share a kind. Seven combinations occur in the bestiary
 * and a table of them would be a table of one rule written out.
 *
 * A code may name only its reach (`{@atk m}`, four occurrences), in which case
 * there is no kind to print and the line is just "Melee Attack:".
 */
/**
 * Which way a `{@unit}` tag agrees: "½ cup", "1 egg", "2 eggs".
 *
 * The count has already had its placeholder substituted by the time this runs,
 * so it can be a numeral, a spelled-out word where the line opens with one, or
 * a vulgar fraction. Anything at or below one takes the singular, which is what
 * English does with fractions; a mixed number like 1½ does not.
 */
function isSingular(count: string): boolean {
  const text = count.trim().toLowerCase();
  if (text === "one") return true;
  if (/^[⅛¼⅓½⅔¾]$/.test(text)) return true;

  const value = Number(text);
  return Number.isFinite(value) && value <= 1;
}

function attackLabel(codes: string): string {
  const REACH: Record<string, string> = { m: "Melee", r: "Ranged" };
  const KIND: Record<string, string> = { w: "Weapon", s: "Spell" };

  const parsed = codes
    .split(",")
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean)
    .map((code) => ({ reach: REACH[code[0]!], kind: KIND[code[1]!] }))
    .filter((part) => part.reach);

  if (parsed.length === 0) return "Attack:";

  // Deduplicated: "mw,rw" is one weapon attack made two ways, not two attacks.
  const reaches = [...new Set(parsed.map((part) => part.reach!))];
  const kinds = [...new Set(parsed.map((part) => part.kind).filter(Boolean))];

  const words = [reaches.join(" or "), ...kinds, "Attack:"];
  return words.join(" ");
}

/**
 * The text a tag shows to a reader. Most tags carry an optional display
 * override, as in `{@condition blinded||blind}`.
 */
export function labelForTag(tag: TagSegment): string {
  if (tag.kind !== "tag") return "";

  const first = part(tag, 0);

  switch (tag.name) {
    /*
     * Display text comes first; the rest is addressing.
     *
     * `{@area Aarakocra|59f|x}` is the one that had to be found the hard way.
     * Its second part is an anchor id and its third a flag, so the default rule
     * printed the flag: 10,681 of the 11,393 area tags in the books rendered as
     * the single letter "x", which is every cross-reference an adventure makes
     * to one of its own numbered locations.
     */
    case "book":
    case "adventure":
    case "filter":
    case "area":
      return first;

    /** `{@quickref name|source|chapter|?|display}` */
    case "quickref":
      return part(tag, 4) || first;

    /*
     * `{@unit 2|yolk|yolks}` — the cookbooks' agreement tag, and the reason an
     * ingredient line reads "1 egg" and "2 egg yolks" from one string. The
     * count arrives as an already-substituted amount placeholder, so by the
     * time this runs the first part is a number.
     */
    case "unit":
      return isSingular(first) ? part(tag, 1) : part(tag, 2) || part(tag, 1);

    /*
     * `{@itemProperty LD|PHB|loading}`. The first part is the property's code,
     * which is the one thing a reader must not be shown — "LD" in the middle of
     * a sentence about loading weapons. Every occurrence in the data carries the
     * display text, and the code is only the fallback for one that does not.
     */
    case "itemProperty":
      return part(tag, 2) || first;

    // The rendered value is the per-level step, not the base.
    case "scaledamage":
    case "scaledice":
      return part(tag, 3) || part(tag, 2) || first;

    // A bare modifier only reads as one if it is signed.
    case "hit":
    case "d20": {
      const override = part(tag, 1);
      if (override) return override;
      return /^[+-]/.test(first) ? first : `+${first}`;
    }

    case "dc":
      return part(tag, 1) || `DC ${first}`;

    /** `{@chance percent|display|title|success|failure}` */
    case "chance":
      return part(tag, 1) || `${first} percent`;

    /*
     * Parenthesised, because the books write the tag where the parentheses
     * go: an action named `Fire Breath {@recharge 5}` is printed "Fire Breath
     * (Recharge 5–6)".
     */
    case "recharge":
      return first ? `(Recharge ${first}–6)` : "(Recharge 6)";

    case "atk":
      return attackLabel(first);

    /*
     * These two carry their trailing space. The books write `{@h}19` with
     * nothing between the tag and the damage, expecting the tag to supply the
     * separator — without it the line reads "Hit:19".
     */
    case "h":
      return "Hit: ";

    /**
     * The other half of `{@h}`, and rare: two occurrences, both the ramming
     * attack of a spelljammer, where a miss does something rather than nothing.
     */
    case "m":
      return "Miss: ";

    /** A save that does something either way, so the text follows both. */
    case "hom":
      return "Hit or Miss: ";

    // The reader's own number, not one the book can print.
    case "hitYourSpellAttack":
      return "your spell attack modifier";

    /** `{@skillCheck animal_handling 5}` — the skill and its bonus, no more. */
    case "skillCheck": {
      const [skill = "", bonus = ""] = first.split(/\s+/);
      const name = skill.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      if (!bonus) return name;
      return `${name} ${/^[+-]/.test(bonus) ? bonus : `+${bonus}`}`;
    }

    default: {
      const index = LABEL_PART[tag.name] ?? 2;
      return part(tag, index) || first;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Collection
 * ------------------------------------------------------------------ */

/**
 * Every natural key a JSON value might refer to, at any depth. Candidates, not
 * confirmed targets.
 *
 * Collected up front so a page resolves all its links in one query instead of
 * one per tag. Walks nested tags too, since `{@b {@spell fireball}}` is valid.
 */
export function collectReferences(value: unknown): Set<string> {
  const found = new Set<string>();

  const visitString = (text: string) => {
    if (!text.includes("{@")) return;
    for (const segment of splitByTags(text)) {
      if (segment.kind !== "tag") continue;

      for (const key of candidateKeysForTag(segment)) found.add(key);

      // Parts can themselves contain tags, so recurse rather than stop here.
      for (const nested of segment.parts) visitString(nested);
    }
  };

  const visit = (node: unknown) => {
    if (typeof node === "string") return visitString(node);
    if (Array.isArray(node)) return node.forEach(visit);
    if (node && typeof node === "object") {
      // A statblock's target is in its fields, not in any tag text.
      if ((node as { type?: unknown }).type === "statblock") {
        for (const key of candidateKeysForStatblock(node)) found.add(key);
      }
      Object.values(node).forEach(visit);
    }
  };

  visit(value);
  return found;
}
