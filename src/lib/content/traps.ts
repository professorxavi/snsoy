import { fieldValue } from "./field";

/**
 * Traps and hazards. One module, because the data gives them one field:
 * `trapHazType` carries the kind for both, and no code is used by both.
 *
 * The labels are ours — nothing in `support_data` names these codes — and every
 * one below was read off the entities it covers rather than guessed. `HAUNT` is
 * the four Ravenloft hauntings; `EST` is Tasha's four eldritch storms, which
 * are the only hazards in the data that are not a place, a weather or a plant.
 */

const KIND_LABELS: Record<string, string> = {
  // Traps
  SMPL: "Simple trap",
  MECH: "Mechanical trap",
  CMPX: "Complex trap",
  MAG: "Magic trap",
  HAUNT: "Haunting",
  // Hazards
  WLD: "Wilderness hazard",
  WTH: "Weather",
  EST: "Eldritch storm",
  ENV: "Environmental hazard",
  GEN: "Generic hazard",
};

/**
 * "Simple trap", or an em dash.
 *
 * Seven hazards carry no kind at all — the moulds, the slimes, Webs and Rot
 * Grub, which the books print together as dungeon hazards without naming a
 * category. An em dash is the honest cell for them; inventing one would be
 * putting words in the book's mouth.
 */
export function trapKindLabel(value: unknown): string {
  const code = fieldValue(value);
  if (typeof code !== "string" || code.length === 0) return "—";

  return KIND_LABELS[code] ?? code;
}

interface Rating {
  tier?: number;
  threat?: string;
}

/**
 * "Dangerous (tier 1)" — how bad a trap is, and for whom.
 *
 * 17 of the 29 traps carry one, and it is the DMG's own pairing: a threat level
 * read against the tier of play it was written for, since "deadly" means
 * something different to a 3rd-level party than to a 17th-level one. A trap
 * rated for two tiers names both.
 */
export function trapThreat(value: unknown): string {
  const ratings = fieldValue(value);
  if (!Array.isArray(ratings) || ratings.length === 0) return "—";

  const parts = ratings.flatMap((entry) => {
    const { tier, threat } = entry as Rating;
    if (!threat) return tier ? [`tier ${tier}`] : [];

    const named = threat.charAt(0).toUpperCase() + threat.slice(1);
    return [tier ? `${named} (tier ${tier})` : named];
  });

  return parts.length > 0 ? parts.join(", ") : "—";
}
