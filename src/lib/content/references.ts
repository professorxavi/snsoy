import type { EntityType } from "@/server/db/schema/enums";
import { splitByTags, type TagSegment } from "./tags";

/**
 * Turning inline `{@tag}` markup into things the renderer can act on.
 *
 * Every tag falls into exactly one of four kinds, and the split is what the
 * design system's three ink treatments are built on:
 *
 * - **reference** — points at another entity. Rendered cyan and underlined.
 * - **roll** — interactive but goes nowhere (`{@damage 8d6}`, `{@hit +5}`).
 *   Ink-coloured with a dotted underline. Rendering these cyan would promise a
 *   destination that does not exist.
 * - **format** — bold, italic, notes. No colour of its own.
 * - **plain** — recognised but not yet actionable (`{@filter}`, `{@quickref}`).
 *   Renders as its label so prose stays readable, and is counted as covered.
 *
 * Anything not in these tables is unknown, and the renderer reports it rather
 * than swallowing it — that report is what decides which tags get built next.
 *
 * Kept free of React and of database access on purpose: reference collection
 * runs on the server before render, and the tokenizer it sits on is also used
 * at ingest time.
 */

/* ------------------------------------------------------------------ *
 * Reference tags
 * ------------------------------------------------------------------ */

/**
 * Tag name to the entity type it addresses, plus the source assumed when the
 * tag omits one.
 *
 * The tag vocabulary is not the enum vocabulary — `{@creature}` addresses a
 * `monster` — so this is also the translation between them. Defaults are the
 * corpus's own: an unqualified creature is from the Monster Manual, an
 * unqualified item from the Dungeon Master's Guide, and everything else from
 * the Player's Handbook.
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
  psionic: { type: "psionic", defaultSource: "utwbtw" },
  language: { type: "language", defaultSource: "phb" },
  variantrule: { type: "variantrule", defaultSource: "dmg" },
  table: { type: "table", defaultSource: "dmg" },
  boon: { type: "boon", defaultSource: "dmg" },
  cult: { type: "cult", defaultSource: "mtf" },
  card: { type: "card", defaultSource: "dmg" },
  deck: { type: "deck", defaultSource: "dmg" },
  recipe: { type: "recipe", defaultSource: "hf" },
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
]);

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
 * Recognised but deliberately inert.
 *
 * `{@filter}` links into a pre-filtered browse view and `{@quickref}` into a
 * generated quick-reference index; both need machinery that does not exist yet.
 * Listing them here keeps them out of the unknown-tag report, so that report
 * stays a list of genuine gaps rather than known deferrals.
 */
const PLAIN_TAGS = new Set(["filter", "quickref", "area", "5etools", "footnote"]);

export type TagKind = "reference" | "roll" | "format" | "plain" | "unknown";

export function kindOfTag(name: string): TagKind {
  if (name in REFERENCE_TAGS || STRUCTURAL_REFERENCE_TAGS.has(name)) {
    return "reference";
  }
  if (ROLL_TAGS.has(name)) return "roll";
  if (name in FORMAT_TAGS) return "format";
  if (PLAIN_TAGS.has(name)) return "plain";
  return "unknown";
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
 * Natural key to target, for everything one page refers to.
 *
 * A plain object rather than a `Map` because this crosses the server/client
 * boundary — the browse view hands it to an interactive aside — and a plain
 * object needs no thought about what serializes.
 *
 * These types live here, in the pure module, rather than beside the query that
 * builds them: the renderer consumes them on every request and must not pull a
 * database client into the bundle to name its own props.
 */
export type ReferenceIndex = Readonly<Record<string, ResolvedReference>>;

export const EMPTY_REFERENCES: ReferenceIndex = Object.freeze({});

/**
 * The first candidate key that actually resolved.
 *
 * `{@item club}` proposes `item|club|phb`, `baseitem|club|phb` and
 * `itemgroup|club|phb`; exactly one exists, and which one is not knowable from
 * the tag alone.
 */
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

/** `dwarf (hill)` — the corpus's way of naming a subrace inside a race tag. */
const QUALIFIED_NAME = /^(.+?)\s*\((.+)\)$/;

/**
 * The natural keys a reference tag might point at, best candidate first.
 *
 * A list rather than a single key because **a tag name does not determine an
 * entity type**. Both cases were found by checking this resolver against the
 * links ingest had already resolved, and both are silent wrong-link bugs
 * otherwise:
 *
 * - `{@item club|phb}` is a `baseitem`, not an `item`. Mundane gear and magic
 *   items share one tag.
 * - `{@race dwarf (hill)}` is the *subrace* `subrace|hill|dwarf|phb|phb`. The
 *   parenthesised form is how the corpus names a subrace from a race tag.
 *
 * Natural keys are also the only safe way to resolve a tag at all: the URL slug
 * is derived at ingest with transformations a caller cannot reproduce — `Melf's
 * Acid Arrow` becomes `melfs-acid-arrow`, `Antipathy/Sympathy` becomes
 * `antipathy-sympathy` — so slugifying a tag's name here would quietly produce
 * dead links. Keys are matched against a unique index instead.
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
      return qualified
        ? [
            `race|${name}|${source}`,
            `subrace|${qualified[2]}|${qualified[1]}|${source}|${source}`,
          ]
        : [`race|${name}|${source}`];
    }

    return [`${spec.type.toLowerCase()}|${name}|${source}`];
  }

  switch (tag.name) {
    /**
     * `{@book display|SOURCE|chapter|header}` — and the chapter is an *index*,
     * which is exactly why it stays inside the natural key and never reaches a
     * URL. Sections are addressed publicly by slug.
     */
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

    default:
      return [];
  }
}

/**
 * The natural key of the entity a fragment renders inside.
 *
 * Fragments — subraces and class/subclass features — have no page of their own;
 * they are anchors on their parent's. The parent is recoverable from the
 * fragment's own key because every fragment key already carries its parent's
 * identity, so this needs no extra lookup to work out *what* to fetch:
 *
 *   subrace|hill|dwarf|phb|phb                   -> race|dwarf|phb
 *   classfeature|divine sense|paladin|phb|1|phb  -> class|paladin|phb
 *   subclassfeature|…|wizard|phb|bladesinging|tce|6|tce
 *                                                -> subclass|bladesinging|wizard|phb|tce
 *
 * Note the last case: a fragment's source and its parent's source differ
 * routinely — a PHB wizard has TCE subclasses — which is why the parent's
 * source is read from the key rather than assumed to match the fragment's.
 */
export function parentKeyFor(naturalKey: string): string | null {
  const parts = naturalKey.split("|");

  switch (parts[0]) {
    /** subrace|name|race|raceSource|source */
    case "subrace":
      return parts.length >= 4 ? `race|${parts[2]}|${parts[3]}` : null;

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
  damage: 1,
  dice: 1,
  hit: 1,
  dc: 1,
  d20: 1,
  recharge: 1,
  coinflip: 1,
};

/**
 * The text a tag shows to a reader.
 *
 * Most tags carry an optional display override — `{@condition blinded||blind}`
 * exists so the sentence reads as English rather than as a lookup key — and
 * respecting it is what keeps rendered prose grammatical.
 */
export function labelForTag(tag: TagSegment): string {
  if (tag.kind !== "tag") return "";

  const first = part(tag, 0);

  switch (tag.name) {
    /** Display text comes first; the rest is addressing. */
    case "book":
    case "adventure":
    case "filter":
      return first;

    /** `{@quickref name|source|chapter|?|display}` */
    case "quickref":
      return part(tag, 4) || first;

    /** The rendered value is the per-level step, not the base. */
    case "scaledamage":
    case "scaledice":
      return part(tag, 3) || part(tag, 2) || first;

    /** A bare modifier reads as a modifier only if it is signed. */
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

    case "recharge":
      return first ? `Recharge ${first}–6` : "Recharge 6";

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
 * Every natural key a JSON value might refer to, anywhere in its depth.
 *
 * Candidates, not confirmed targets — an `{@item}` contributes three keys and
 * at most one of them exists. Resolution decides which; this only has to make
 * sure nothing is missed.
 *
 * The renderer needs this *before* it renders: resolving references one tag at
 * a time would mean a database round trip per link, and a spell's description
 * can hold dozens. Collecting first turns the whole page into a single lookup.
 *
 * Nested tags are walked too — `{@b {@spell fireball}}` is real markup, and the
 * tokenizer leaves the inner tag as raw text inside the outer one's parts.
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
      Object.values(node).forEach(visit);
    }
  };

  visit(value);
  return found;
}
