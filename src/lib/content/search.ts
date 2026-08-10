import { ASIDE_TYPES } from "@/lib/aside";
import { BROWSABLE_TYPES, isBrowsable, type BrowsableType } from "@/lib/routes";
import type { EntityType } from "@/server/db/schema/enums";

/**
 * The parts of search that touch no database: what a result type is called, how
 * a raw query string is cleaned up, and how a highlighted snippet is read back
 * apart.
 *
 * Ranking itself lives in `server/db/queries/search`, because it is expressed
 * in SQL and cannot be meaningfully lifted out of it. What can be lifted is
 * everything the results page needs in order to print a row.
 */

/* ------------------------------------------------------------------ *
 * The query
 * ------------------------------------------------------------------ */

/**
 * Two characters. A single character matches nothing useful through the
 * trigram index — a trigram needs three — while still costing a scan of every
 * name in the corpus, so it is refused rather than answered slowly and badly.
 */
export const MIN_QUERY_LENGTH = 2;

/**
 * Long enough for the longest entity name in the corpus with room to spare, and
 * short enough that a pasted paragraph cannot turn into a tsquery with hundreds
 * of terms.
 */
export const MAX_QUERY_LENGTH = 120;

/**
 * The query as the database should see it: trimmed, with runs of whitespace
 * collapsed so `"fire  bolt"` and `"fire bolt"` are one query and one cache
 * entry.
 *
 * Returns null for anything too short to answer, which the page renders as a
 * prompt rather than as an empty result — "no matches" is a lie when nothing
 * was looked for.
 */
export function normalizeQuery(raw: string | undefined): string | null {
  if (!raw) return null;

  const collapsed = raw.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);

  return collapsed.length >= MIN_QUERY_LENGTH ? collapsed : null;
}

/* ------------------------------------------------------------------ *
 * Result types
 * ------------------------------------------------------------------ */

/**
 * What to call each entity type in a result badge — singular, and in the
 * player's vocabulary rather than the corpus's. A `monster` is a Creature and an
 * `optionalfeature` is an Invocation or a Maneuver depending on the book, so it
 * gets the general word the rules use for the category.
 *
 * Every type in the enum is named. A missing one would print a raw enum value
 * like `vehicleUpgrade` in the interface, and the compiler is a better place to
 * catch that than a screenshot.
 */
export const TYPE_LABELS: Record<EntityType, string> = {
  spell: "Spell",
  monster: "Creature",
  item: "Magic Item",
  baseitem: "Equipment",
  itemGroup: "Item Group",
  magicvariant: "Magic Variant",
  race: "Race",
  subrace: "Subrace",
  background: "Background",
  feat: "Feat",
  class: "Class",
  subclass: "Subclass",
  classFeature: "Class Feature",
  subclassFeature: "Subclass Feature",
  optionalfeature: "Optional Feature",
  bookSection: "Chapter",
  action: "Action",
  boon: "Boon",
  card: "Card",
  charoption: "Character Option",
  condition: "Condition",
  cult: "Cult",
  deck: "Deck",
  deity: "Deity",
  disease: "Disease",
  hazard: "Hazard",
  language: "Language",
  object: "Object",
  psionic: "Psionic",
  raceFeature: "Race Feature",
  recipe: "Recipe",
  reward: "Reward",
  sense: "Sense",
  skill: "Skill",
  status: "Status",
  table: "Table",
  trap: "Trap",
  variantrule: "Variant Rule",
  vehicle: "Vehicle",
  vehicleUpgrade: "Vehicle Upgrade",
};

export function typeLabel(type: EntityType): string {
  return TYPE_LABELS[type];
}

/* ------------------------------------------------------------------ *
 * Where a suggestion goes
 * ------------------------------------------------------------------ */

/**
 * The URL parameter that asks the results page to open one entity on arrival.
 *
 * A one-shot instruction, not filter state: the page reads it once to decide
 * what the aside starts with, and every link the page builds omits it. That is
 * what keeps it from re-opening the same entity each time a facet is clicked,
 * and it is why this is not a reversal of the decision that the aside is not
 * routed — nothing about opening a *second* entity touches the URL.
 */
export const OPEN_PARAM = "open";

/**
 * `type:source:slug`. All three alphabets exclude the colon — types are
 * alphanumeric, source ids are alphanumeric with hyphens, and every slug in the
 * corpus matches `^[a-z0-9]+(-[a-z0-9]+)*$` — so no escaping is needed and the
 * parameter stays readable in a shared link.
 */
export function encodeOpenParam(
  type: BrowsableType,
  sourceId: string,
  slug: string,
): string {
  return `${type}:${sourceId.toLowerCase()}:${slug}`;
}

export interface OpenTarget {
  type: BrowsableType;
  sourceId: string;
  slug: string;
}

/**
 * Read the parameter back, or null.
 *
 * Validated rather than trusted: the value is a URL someone can type, and it
 * reaches `openEntityAside`, so a type outside `ASIDE_TYPES` has to be refused
 * here rather than rendering "Nothing to show for this yet" in a panel that
 * opened by itself.
 */
export function parseOpenParam(raw: string | undefined): OpenTarget | null {
  if (!raw) return null;

  const [type, sourceId, ...rest] = raw.split(":");
  const slug = rest.join(":");
  if (!type || !sourceId || !slug) return null;

  // Checked against the segment map before being narrowed, since `type` here is
  // an arbitrary string off the URL rather than a value from the enum.
  if (!(BROWSABLE_TYPES as readonly string[]).includes(type)) return null;
  const browsable = type as BrowsableType;

  if (!ASIDE_TYPES.has(browsable)) return null;

  return { type: browsable, sourceId, slug };
}

/** Where picking a suggestion should land. */
export interface Suggestible {
  name: string;
  entityType: EntityType;
  sourceId: string;
  slug: string;
  href: string | null;
}

/**
 * The destination for a chosen suggestion.
 *
 * Three cases, in order, and the first covers almost everything anyone searches
 * for:
 *
 * 1. **The aside can render it** — creatures, items, spells, classes, races,
 *    skills and conditions, some 7,200 of which have no page of their own at
 *    all. It lands on the results page with that one already open, which is the
 *    only place in the app where such an entity can be shown.
 * 2. **It has a page** — a chapter is the clearest case; the chapter *is* the
 *    thing being asked for, and there is nothing to preview.
 * 3. **Neither.** Deities, cards, feats and the rest still have no renderer and
 *    no route. The results page at least shows the row, its kind and its book,
 *    which is more than a 404 would.
 */
export function suggestionHref(suggestion: Suggestible): string {
  const query = `q=${encodeURIComponent(suggestion.name)}`;

  if (
    isBrowsable(suggestion.entityType) &&
    ASIDE_TYPES.has(suggestion.entityType)
  ) {
    const open = encodeOpenParam(
      suggestion.entityType,
      suggestion.sourceId,
      suggestion.slug,
    );
    return `/search?${query}&${OPEN_PARAM}=${encodeURIComponent(open)}`;
  }

  return suggestion.href ?? `/search?${query}`;
}

/** Where "See all results" goes. */
export function resultsHref(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`;
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

/**
 * The delimiters `ts_headline` wraps a matched word in.
 *
 * Control characters, not `<b>` or `<<`: the body they surround is arbitrary
 * prose from the corpus, and any delimiter made of printable characters is one
 * a book could contain. STX and ETX cannot occur in the text — ingest strips
 * markup to plain words — so splitting on them can never cut a real sentence in
 * half and the snippet never has to be trusted as markup.
 */
export const MATCH_START = "\u0002";
export const MATCH_END = "\u0003";

export interface SnippetPart {
  text: string;
  /** A word the query matched. Rendered as a `<mark>`. */
  match: boolean;
}

/**
 * Read a `ts_headline` result back into parts, so the matched words can be
 * marked up without ever inserting HTML the database produced.
 *
 * Unbalanced delimiters are treated as plain text rather than as an error: a
 * headline truncated mid-highlight should still print its words.
 */
export function parseSnippet(raw: string | null | undefined): SnippetPart[] {
  if (!raw) return [];

  const parts: SnippetPart[] = [];
  let rest = raw;

  while (rest.length > 0) {
    const start = rest.indexOf(MATCH_START);
    if (start === -1) break;

    const end = rest.indexOf(MATCH_END, start);
    if (end === -1) break;

    if (start > 0) parts.push({ text: rest.slice(0, start), match: false });
    parts.push({
      text: rest.slice(start + MATCH_START.length, end),
      match: true,
    });
    rest = rest.slice(end + MATCH_END.length);
  }

  if (rest.length > 0) parts.push({ text: rest, match: false });

  return parts.filter((part) => part.text.length > 0);
}
