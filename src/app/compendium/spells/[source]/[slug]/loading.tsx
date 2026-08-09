import { ReadingSkeleton } from "@/components/layout";

/** A spell page. No outline: a spell has no named sections to list. */
export default function Loading() {
  return <ReadingSkeleton outline={false} />;
}
