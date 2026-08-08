/**
 * Records entry types and tags the renderer could not handle, so coverage is
 * measured rather than guessed.
 *
 * Process-local and unpersisted. A development instrument, not telemetry, and
 * never shown to a user.
 */

export type GapKind = "entry" | "tag";

export interface CoverageGap {
  kind: GapKind;
  /** The unhandled `type` value or tag name. */
  name: string;
  /** Times seen since the process started. */
  count: number;
  /** Entity it was first seen in, when known. */
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

  // Once per distinct gap; a single tag can appear hundreds of times.
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
