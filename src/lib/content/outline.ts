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
