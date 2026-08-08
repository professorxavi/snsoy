/**
 * Shaping a source's chapter list for display.
 *
 * All three rules here exist because a source is not always one book. A source
 * can contain a second, inner work — MOT carries "No Silent Secret" — whose
 * chapters are stored under their own `book_id` and whose ordinals restart at
 * zero. That is what makes grouping and neighbour-finding worth their own
 * functions rather than a few lines inside a page component.
 */

/** Ordered chapters split by the body they came from, primary body first. */
export function groupByBook<T extends { bookId: string }>(
  chapters: T[],
  sourceId: string,
): { bookId: string; chapters: T[] }[] {
  const bodies: { bookId: string; chapters: T[] }[] = [];

  for (const chapter of chapters) {
    const last = bodies[bodies.length - 1];
    if (last && last.bookId === chapter.bookId) {
      last.chapters.push(chapter);
      continue;
    }
    bodies.push({ bookId: chapter.bookId, chapters: [chapter] });
  }

  // Partitioned rather than sorted: a comparator that only knows which side is
  // primary is not a total order, so its result depends on the sort algorithm.
  return [
    ...bodies.filter((body) => body.bookId === sourceId),
    ...bodies.filter((body) => body.bookId !== sourceId),
  ];
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
