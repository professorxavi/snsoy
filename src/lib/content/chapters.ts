/**
 * Shaping a source's chapter list for display.
 *
 * All three rules here exist because a source is not always one book. A source
 * can contain a second, inner work — MOT carries "No Silent Secret" — whose
 * chapters are stored under their own `book_id` and whose ordinals restart at
 * zero. That is what makes grouping and neighbour-finding worth their own
 * functions rather than a few lines inside a page component.
 */

/**
 * Ordered chapters split into the book and any inner work bound in after it.
 *
 * More than one `book_id` does not make more than one book. An adventure
 * printed as a chapter is stored under its own id but reads in its place —
 * Krenko's Way is page 160 of Ravnica's chapter 4 — and an anthology the data
 * ships as several printings has no body under its own id at all. Both are one
 * book, and splitting them would put a heading over every chapter.
 *
 * An inner work is the thing that is genuinely separate: its own title page,
 * bound in after the book's text ends. That is what the trailing run finds, and
 * it is why the chapters are read in the order ingest resolved rather than
 * partitioned — reordering here would undo it.
 */
export function groupByBook<T extends { bookId: string }>(
  chapters: T[],
  sourceId: string,
): { bookId: string; chapters: T[] }[] {
  if (chapters.length === 0) return [];

  // Where the book's own text ends. A source with no body under its own id is
  // all book, so nothing is split off it; otherwise the run of foreign bodies
  // at the very end is what was bound in afterwards.
  const hasOwnBody = chapters.some((chapter) => chapter.bookId === sourceId);
  let split = chapters.length;
  if (hasOwnBody) {
    while (chapters[split - 1]!.bookId !== sourceId) split -= 1;

    // A body that also appears earlier was printed inside the book, so the run
    // of it at the end is its last chapter rather than a work of its own —
    // Theros keeps the credits its inner adventure repeats.
    const inside = new Set(chapters.slice(0, split).map((c) => c.bookId));
    while (split < chapters.length && inside.has(chapters[split]!.bookId)) {
      split += 1;
    }
  }

  const bodies: { bookId: string; chapters: T[] }[] = [
    {
      bookId: hasOwnBody ? sourceId : chapters[0]!.bookId,
      chapters: chapters.slice(0, split),
    },
  ];

  for (const chapter of chapters.slice(split)) {
    const last = bodies[bodies.length - 1]!;
    if (last.bookId === chapter.bookId) last.chapters.push(chapter);
    else bodies.push({ bookId: chapter.bookId, chapters: [chapter] });
  }

  return bodies;
}

/**
 * "Chapter 4", "Appendix B". Front matter and credits carry no ordinal at all
 * and get no label, which is how they print.
 */
export function chapterLabel(chapter: {
  ordinalType: string | null;
  ordinalLabel: string | null;
}): string | null {
  if (!chapter.ordinalLabel) return null;
  const kind = chapter.ordinalType ?? "chapter";
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${chapter.ordinalLabel}`;
}

/**
 * The chapters either side of one, by position in the source's whole ordered
 * list. Positional rather than arithmetic on the ordinal, so stepping off the
 * end of one body lands in the next instead of stopping or skipping.
 */
export function neighbours<T extends { slug: string }>(
  chapters: T[],
  slug: string,
): { previous: T | null; next: T | null } {
  const index = chapters.findIndex((chapter) => chapter.slug === slug);

  // A slug that is not in the list has no position, so it has no neighbours —
  // never the first and last chapters by accident.
  if (index === -1) return { previous: null, next: null };

  return {
    previous: index > 0 ? chapters[index - 1]! : null,
    next: index < chapters.length - 1 ? chapters[index + 1]! : null,
  };
}
