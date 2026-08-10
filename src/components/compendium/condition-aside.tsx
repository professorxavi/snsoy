import { GenericAside } from "@/components/compendium/generic-aside";
import type { ReferenceIndex } from "@/lib/content/references";
import type { ConditionDetail } from "@/server/db/queries/conditions";

/**
 * A condition in the aside — which is the only place a condition is rendered.
 *
 * The same bargain the skill aside strikes. A condition is a short list of
 * consequences, so the panel prints all of it and there is no page behind it to
 * link on to: reading Grappled should cost nothing more than the glance it
 * takes, least of all the page you met the word on.
 *
 * No subtitle, unlike a skill's ability line — a condition has no second fact
 * about it, and its effects are the whole of what it is.
 */
export function ConditionAside({
  condition,
  refs,
}: {
  condition: ConditionDetail;
  refs: ReferenceIndex;
}) {
  return <GenericAside entity={condition} refs={refs} />;
}
