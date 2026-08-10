/**
 * The shape of a filter rail's options, shared by every browse view.
 *
 * Extracted from the spell queries when the monsters list became the second
 * caller. Nothing here touches the database — it is the step between a facet
 * count and what the rail renders, and both views need it to behave the same
 * way or their rails behave differently for no reason a reader could name.
 */

export interface FacetOption<T> {
  value: T;
  /** How many rows this option would leave, given the *other* filters. */
  count: number;
  selected: boolean;
  /** Nothing to show. Rendered inert rather than removed. */
  disabled: boolean;
}

/**
 * Turn raw counts into rail options.
 *
 * The full domain is always returned, so options never appear or disappear as
 * you filter — they only become unavailable. A rail that rearranges itself
 * under the cursor is unusable, and it hides the fact that an option exists
 * at all.
 */
export function toOptions<T extends string | number>(
  rows: { value: T; n: number }[],
  selected: readonly T[],
  order: (a: T, b: T) => number,
): FacetOption<T>[] {
  return rows
    .filter((row) => row.value != null)
    .sort((a, b) => order(a.value, b.value))
    .map((row) => {
      const isSelected = selected.includes(row.value);
      return {
        value: row.value,
        count: row.n,
        selected: isSelected,
        // A selected option stays clickable even at zero, or a filter that
        // narrows to nothing could never be undone from the rail.
        disabled: row.n === 0 && !isSelected,
      };
    });
}

/** A boolean facet has one value: the count of rows that have it. */
export function flagOption<T extends string>(
  value: T,
  count: number,
  selected: boolean,
): FacetOption<T> {
  return { value, count, selected, disabled: count === 0 && !selected };
}
