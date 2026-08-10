import { GenericAside } from "@/components/compendium/generic-aside";
import type { ReferenceIndex } from "@/lib/content/references";
import { checkName } from "@/lib/content/skills";
import type { SkillDetail } from "@/server/db/queries/skills";

/**
 * A skill in the aside — which is the only place a skill is ever rendered.
 *
 * The class and race asides summarise, because their pages carry more than a
 * 400px column can hold. This one does not: a skill is two paragraphs at the
 * longest, so the panel prints the whole of it and there is nowhere else to go.
 * That is also why there is no "open full page" link and no skill page behind
 * it — a document this short would be a page with one paragraph on it, reached
 * by leaving whatever the reader was actually reading.
 */
export function SkillAside({
  skill,
  refs,
}: {
  skill: SkillDetail;
  refs: ReferenceIndex;
}) {
  return <GenericAside entity={skill} refs={refs} subtitle={checkName(skill.ability, skill.name)} />;
}
