/**
 * How the sources page bands its shelf, and who belongs on the main one.
 *
 * Here rather than in the page because the homepage shows the front of the
 * same shelf and has to agree about what is on it — a promotional one-shot or
 * the Sage Advice Compendium turning up among the first twelve covers would
 * misrepresent the collection the page is there to show.
 */

export const BANDS: {
  heading: string | null;
  groups: readonly string[] | null;
}[] = [
  { heading: null, groups: null },
  { heading: "Odds and Ends", groups: ["supplement-alt"] },
  { heading: "Errata and Rulings", groups: ["errata"] },
];

const BANDED_GROUPS = new Set<string>(
  BANDS.flatMap((band) => band.groups ?? []),
);

/** Whether a source belongs on the main shelf rather than a band below it. */
export function onMainShelf(group: string | null): boolean {
  return !BANDED_GROUPS.has(group ?? "");
}

/** The sources one band holds, in the order they were given. */
export function inBand<T extends { group: string | null }>(
  sources: T[],
  groups: readonly string[] | null,
): T[] {
  return sources.filter((source) =>
    groups ? groups.includes(source.group ?? "") : onMainShelf(source.group),
  );
}
