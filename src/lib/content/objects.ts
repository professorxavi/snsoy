import { fieldValue } from "./field";
import { formatSize } from "./monsters";

/**
 * Objects: siege weapons, and the handful of things an adventure gives hit
 * points so a party can break them.
 *
 * The nearest thing in the data to a stat block without being one — size,
 * armour class and hit points, and nothing else worth a column. Size reuses the
 * creature formatter, since an eldritch cannon is "Tiny or Small" for exactly
 * the reason a creature spanning two sizes is.
 */

/**
 * "Large", or "Tiny or Small" for the three eldritch cannons.
 *
 * `V` is the generic object entry, which stands for every object the books did
 * not write down and is therefore no size in particular. The creature formatter
 * has no such code — nothing in the bestiary varies that way — so it is
 * translated here rather than reaching the page as the letter V.
 */
export function objectSize(value: unknown): string {
  const sizes = fieldValue(value);
  if (!Array.isArray(sizes)) return "—";

  const codes = sizes.filter((code): code is string => typeof code === "string");
  if (codes.includes("V")) return "Varies";

  return formatSize(codes) || "—";
}

/**
 * An armour class or a hit point total, either of which the books sometimes
 * decline to give as a number.
 *
 * An eldritch cannon has hit points "equal to five times your artificer level"
 * and the generic object entry varies by definition, so the field holds a
 * sentence instead. Printing the sentence is right in the aside and too long
 * for a table cell, which is why the cell asks for the short form.
 */
export function objectStat(value: unknown, { short = false } = {}): string {
  const stat = fieldValue(value);

  if (typeof stat === "number") return String(stat);
  if (typeof stat === "string" && stat.length > 0) return stat;

  const special = (stat as { special?: unknown } | null)?.special;
  if (typeof special !== "string") return "—";

  return short ? "Varies" : special;
}

/** "Large object · AC 17 · 50 hp", for the line under the name. */
export function objectSummary(data: Record<string, unknown>): string {
  const parts = [`${objectSize(data["size"])} object`];

  const ac = objectStat(data["ac"], { short: true });
  const hp = objectStat(data["hp"], { short: true });

  if (ac !== "—") parts.push(`AC ${ac}`);
  if (hp !== "—") parts.push(`${hp} hp`);

  return parts.join(" · ");
}
