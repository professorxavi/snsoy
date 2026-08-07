/**
 * What the renderer met and could not render.
 *
 * The phase plan makes coverage measured rather than guessed: the corpus has a
 * long tail of entry types and tags, and building it speculatively wastes work
 * on shapes no slice uses. So an unhandled shape does two things — renders a
 * fallback a reader can see, and records itself here. This record is the input
 * to "what should the renderer support next".
 *
 * Deliberately process-local and unpersisted. It is a development instrument,
 * not product telemetry, and it must never become a number shown to a user.
 */

export type GapKind = "entry" | "tag";

export interface CoverageGap {
  kind: GapKind;
  /** The unhandled `type` value or tag name. */
  name: string;
  /** Times seen since the process started. */
  count: number;
  /** Where it was first met — an entity name, when the renderer knows one. */
  firstSeenIn?: string;
}

const gaps = new Map<string, CoverageGap>();

export function reportGap(kind: GapKind, name: string, context?: string): void {
  const id = `${kind}:${name}`;
  const existing = gaps.get(id);

  if (existing) {
    existing.count++;
    return;
  }

  gaps.set(id, { kind, name, count: 1, firstSeenIn: context });

  // Warn once per distinct gap. Per-occurrence logging would bury the signal:
  // a single unhandled tag can appear hundreds of times in one chapter.
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[renderer] unsupported ${kind} "${name}"${context ? ` (in ${context})` : ""}`,
    );
  }
}

/** Everything unhandled so far, most frequent first. */
export function coverageReport(): CoverageGap[] {
  return [...gaps.values()].sort((a, b) => b.count - a.count);
}

export function resetCoverage(): void {
  gaps.clear();
}
