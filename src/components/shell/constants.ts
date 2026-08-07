/**
 * The top bar's height, as a raw CSS variable reference.
 *
 * Needed because Chakra resolves positional props (`top`, `left`, `insetY`…)
 * against the **spacing** scale, not `sizes` — so `top="topbar"` silently emits
 * the literal string `top: topbar`, which is invalid CSS and leaves a sticky
 * element pinned to the viewport top, sliding under the bar. Referencing the
 * generated variable keeps one source of truth in `src/theme` while sidestepping
 * the scale mismatch.
 */
export const TOPBAR = "var(--chakra-sizes-topbar)";

/** Viewport height below the top bar — the scroll box for sticky side regions. */
export const BELOW_TOPBAR = `calc(100dvh - ${TOPBAR})`;
