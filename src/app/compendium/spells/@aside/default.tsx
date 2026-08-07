/**
 * The aside slot with nothing open.
 *
 * Required by the App Router: on a hard load of a spell's canonical URL there
 * is no intercepted route to fill this slot, and without a default Next has
 * nothing to render for it. Returning null is what makes the canonical page a
 * plain full-width page rather than a list with an aside stuck open.
 */
export default function NoAside() {
  return null;
}
