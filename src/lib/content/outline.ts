/**
 * Splitting a body of entries into the named sections a reading page anchors
 * and outlines.
 *
 * Shared by race pages and the book reader: both take a flat entry list where
 * the named top-level entries are the document's structure, and both need an
 * id per section that the outline and the section heading agree on.
 *
 * Only the top level is split. Deeper nesting is the renderer's job, and an
 * outline that reached every heading in a 555 KB chapter would be unusable.
 */

/** The shape this needs from an entry; the renderer defines the full type. */
type NamedEntry = { name?: unknown; entries?: unknown; id?: unknown };

export interface DocumentSection<E> {
  /** In-page anchor. Unique within the document. */
  id: string;
  title: string;
  entries: E[];
  /**
   * The id the source data hangs on the entry, where it has one. A top-level
   * section is split out of the tree before the renderer sees it, so this is
   * the only way its own id survives — and 713 `{@area}` tags in the books
   * point at one, which would otherwise land nowhere.
   */
  anchorId?: string;
}

export interface SplitDocument<E> {
  /** Prose before the first named section. */
  intro: E[];
  sections: DocumentSection<E>[];
}

export function splitSections<E>(entries: E[] | undefined): SplitDocument<E> {
  const intro: E[] = [];
  const sections: DocumentSection<E>[] = [];
  const used = new Set<string>();

  for (const entry of entries ?? []) {
    const named =
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as NamedEntry).name === "string" &&
      ((entry as NamedEntry).name as string).trim();

    if (!named) {
      intro.push(entry);
      continue;
    }

    const title = named;
    const nested = (entry as NamedEntry).entries;
    const anchorId = (entry as NamedEntry).id;
    sections.push({
      id: uniqueAnchor(title, used),
      title,
      entries: Array.isArray(nested) ? (nested as E[]) : [],
      ...(typeof anchorId === "string" ? { anchorId } : {}),
    });
  }

  return { intro, sections };
}

/**
 * An in-page anchor. Safe to derive, unlike an entity slug, because it only
 * addresses a heading within this document — nothing links to it from outside.
 */
export function uniqueAnchor(text: string, used: Set<string>): string {
  const base =
    text
      .toLowerCase()
      // Apostrophes close up rather than becoming separators; chapter titles
      // are full of possessives, and "xanathar-s-guide" reads as a typo.
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";

  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

/* -------------------------------------------------------------------------- */
/* Chapter outline                                                            */
/* -------------------------------------------------------------------------- */

/**
 * How many levels below a top-level section the outline reaches.
 *
 * Two, which is what the books are actually shaped like: a chapter section
 * holds locations and a location holds its numbered rooms. Measured over every
 * chapter, this is the same set of headings 5etools lists — its `depth` 0 and 1
 * are our levels 1 and 2 — plus the intermediate one it drops. Keeping that one
 * is the point: without it ToA's first chapter lists "1. Beggars' Palaces"
 * through "25. Dinosaur Pens" with no way to tell which ward any of them is in.
 *
 * A third level would reach 372 rows on the worst chapter and say nothing the
 * reader could not find by then.
 */
const OUTLINE_DEPTH = 2;

/**
 * How long a list of rows may get before it is broken into runs.
 *
 * Two sections in the books are alphabetical gazetteers — Storm King's Thunder
 * has 165 locations under one heading — and another 119 are dungeon keys long
 * enough to fill the gutter twice over. Naming runs of rows by the keys at
 * either end is how D&D Beyond handles the same chapter, and it generalises
 * where their alphabetical buckets do not: "1 – 12" reads as well as
 * "Amphail – Daggerford", and most of the long lists here are numbered.
 *
 * Runs of roughly twelve, so that a list of 165 costs 14 rows closed and 26
 * with one open, rather than 165 either way.
 */
const CHUNK_OVER = 24;
const CHUNK_TARGET = 12;

/** One row of the outline, and whatever nests under it. */
export interface OutlineNode {
  /**
   * What this row is known by within the chapter — its anchor, or a synthetic
   * one where it has none.
   */
  key: string;
  /**
   * In-page anchor. Absent on a run, which names a stretch of rows rather than
   * a heading and so has nowhere of its own to go.
   */
  id?: string;
  title: string;
  children: OutlineNode[];
}

export interface ChapterOutline {
  nodes: OutlineNode[];
  /**
   * The anchor each nested entry was given, keyed by the entry itself.
   *
   * Keyed by identity rather than by id because 219 of the 26,550 named entries
   * the outline reaches carry no id of their own, and those are exactly the
   * ones with nothing else to address them by. The renderer looks an entry up
   * here to decide whether to mark it — see `outlineAnchors` in
   * `components/entry`. Top-level sections are absent: the chapter page splits
   * them out and anchors them itself.
   */
  anchors: WeakMap<object, string>;
}

/** The shape a node needs to be structure rather than content. */
type StructuralEntry = { name: string; id?: unknown; entries?: unknown };

/**
 * Whether an entry is a heading the outline should list.
 *
 * Named, and one of the two grouping types. The exclusion that matters is
 * `inset`: a boxed sidebar carries a name and reads as a heading, but it is an
 * aside printed beside the text rather than a division of it, and listing
 * "Troubleshooting" between two wards of a city is a false structure.
 */
function structural(entry: unknown): entry is StructuralEntry {
  if (typeof entry !== "object" || entry === null) return false;

  const node = entry as NamedEntry & { type?: unknown };
  if (typeof node.name !== "string" || !node.name.trim()) return false;

  return (
    node.type === undefined ||
    node.type === "entries" ||
    node.type === "section"
  );
}

/**
 * The headings inside a chapter's top-level sections, as a tree.
 *
 * Takes the sections `splitSections` already produced rather than the raw body,
 * so the two agree on the top level's anchors and the page keeps rendering
 * exactly what it rendered before.
 *
 * Nearly every entry here has an id in the source data — 26,331 of 26,550 — and
 * using it means an outline row and an `{@area}` link that points at the same
 * heading land on one element instead of two. The rest get an anchor derived
 * from the title, sharing the top level's `used` set so nothing collides.
 */
export function chapterOutline<E>(
  sections: DocumentSection<E>[],
): ChapterOutline {
  const used = new Set(sections.map((section) => section.id));
  const anchors = new WeakMap<object, string>();

  function descend(entries: unknown, depth: number): OutlineNode[] {
    if (depth === 0 || !Array.isArray(entries)) return [];

    const nodes: OutlineNode[] = [];

    for (const entry of entries) {
      if (!structural(entry)) continue;

      const title = entry.name.trim();
      const own = typeof entry.id === "string" ? entry.id : undefined;
      let id: string;

      if (own && !used.has(own)) {
        used.add(own);
        id = own;
      } else {
        id = uniqueAnchor(title, used);
      }

      anchors.set(entry, id);
      nodes.push({
        key: id,
        id,
        title,
        children: chunk(descend(entry.entries, depth - 1), id),
      });
    }

    return nodes;
  }

  return {
    nodes: sections.map((section) => ({
      key: section.id,
      id: section.id,
      title: section.title,
      children: chunk(descend(section.entries, OUTLINE_DEPTH), section.id),
    })),
    anchors,
  };
}

/**
 * A long list of rows, broken into runs named by the keys at either end.
 *
 * Runs are as even as they divide, rather than twelves with a remainder — a
 * final run of one reads as a mistake. Anything at or under the threshold is
 * returned untouched, which is all but 121 of the lists in the books.
 */
function chunk(nodes: OutlineNode[], parentKey: string): OutlineNode[] {
  if (nodes.length <= CHUNK_OVER) return nodes;

  const runs = Math.ceil(nodes.length / CHUNK_TARGET);
  const size = Math.ceil(nodes.length / runs);
  const chunked: OutlineNode[] = [];

  for (let start = 0; start < nodes.length; start += size) {
    const run = nodes.slice(start, start + size);
    const first = run[0];
    const last = run[run.length - 1];
    if (!first || !last) continue;

    chunked.push({
      key: `${parentKey}~${chunked.length}`,
      title: `${rowKey(first.title)} – ${rowKey(last.title)}`,
      children: run,
    });
  }

  return chunked;
}

/**
 * What a row is called in a run's name.
 *
 * The map key where a heading opens with one — "6E. Treasury" is known as 6E on
 * the map and in every reference to it — and the whole name otherwise, which is
 * what the alphabetical lists need.
 */
function rowKey(title: string): string {
  return /^([A-Za-z]*\s*\d+[A-Za-z]?)\./.exec(title)?.[1] ?? title;
}
