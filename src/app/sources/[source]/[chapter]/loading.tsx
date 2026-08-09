import { ReadingSkeleton } from "@/components/layout";

/**
 * The chapter fallback.
 *
 * Worth more here than anywhere else in the app: a chapter resolves every
 * reference in its body in one go — the densest such set the site builds, at
 * 37,000 creature tags across the corpus — and the longest chapter is 555 KB.
 * Without this the router holds the previous page still for all of it.
 */
export default function Loading() {
  return <ReadingSkeleton />;
}
