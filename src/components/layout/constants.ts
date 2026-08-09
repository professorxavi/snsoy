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

/**
 * A visible, slim scrollbar for a container that scrolls sideways.
 *
 * A wide table stays inside the reading measure and scrolls in its own box, so
 * a column past the right edge is reachable but not obviously there. This is
 * the cue, and it is conditional for free: a browser paints a scrollbar only
 * when the content actually overflows, which needs no measuring and no
 * JavaScript. Overlay scrollbars fade out when idle, hence the explicit
 * colour rather than relying on the default.
 */
export const SIDEWAYS_SCROLLBAR = {
  scrollbarWidth: "thin" as const,
  scrollbarColor: "var(--chakra-colors-border-emphasized) transparent",
};
