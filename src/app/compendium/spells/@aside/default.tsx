/**
 * The aside slot with nothing open.
 *
 * Required by the App Router: on a hard load of a spell URL there is no
 * intercepted route to fill this slot, and Next needs something to render.
 */
export default function NoAside() {
  return null;
}
