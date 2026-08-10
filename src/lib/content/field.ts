/**
 * One value from a `generic_entities` blob, whichever side it arrived from.
 *
 * A list row reads its fields through `listGeneric`'s field map, which projects
 * `jsonb ->> key` — so an array arrives as `'["L"]'`, a number as `'18'` and a
 * nested object as its own JSON. The aside has the parsed blob and gets the
 * real thing. Everything that formats one of these fields is called from both
 * places, and a formatter that handled only one of them would leave either
 * every table cell or every subtitle blank with nothing else failing.
 *
 * Text that is not JSON comes back unchanged, which is what a plain string
 * field wants: `trapHazType` is `"SMPL"`, not JSON, and parsing it must not
 * cost the value.
 */
export function fieldValue(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
