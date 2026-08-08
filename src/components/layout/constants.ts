/**
 * The top bar's height, as a raw CSS variable reference.
 *
 * Chakra resolves positional props (`top`, `insetY`…) against the spacing scale
 * rather than `sizes`, so `top="topbar"` emits invalid CSS and silently leaves
 * sticky elements sliding under the bar. Referencing the generated variable
 * keeps `src/theme` as the single source of truth.
 */
export const TOPBAR = "var(--chakra-sizes-topbar)";

/** Viewport height below the top bar — the scroll box for sticky side regions. */
export const BELOW_TOPBAR = `calc(100dvh - ${TOPBAR})`;
