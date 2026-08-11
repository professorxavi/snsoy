import { fieldValue } from "./field";
import {
  formatArmorClass,
  formatHitPoints,
  formatSize,
  formatSpeed,
  type AcEntry,
  type HitPoints,
  type Speeds,
} from "./monsters";

/**
 * Vehicles and the upgrades bolted onto them.
 *
 * A vehicle is a stat block rather than a rules entry: 33 of the 35 carry no
 * `entries` at all and are nothing but their numbers, their components and
 * their action stations. `vehicleType` says which shape those numbers arrive
 * in, and the five shapes disagree about almost every field — a spelljammer has
 * no size and a `{fly}` pace, a ship has a size letter and a bare number, an
 * infernal war machine states its speed in feet, and the two `OBJECT` entries
 * and the one `CREATURE` are stat-blocked like the things they are named after.
 * So every reader here takes the field however it comes.
 */

const EM_DASH = "—";

/**
 * What the books call each shape.
 *
 * `OBJECT` and `CREATURE` name how the entry is stat-blocked, not what it is —
 * the Apparatus of Kwalish is written like an object and the Stahlmaster like a
 * creature, and both are vehicles a party rides. So neither becomes a noun on
 * the page; they fall back to the plain word.
 */
const VEHICLE_TYPES: Record<string, string> = {
  SHIP: "ship",
  SPELLJAMMER: "spelljamming ship",
  INFWAR: "infernal war machine",
};

/** Size arrives as `"G"` from the ships and `["L"]` from the other two shapes. */
export function vehicleSize(value: unknown): string {
  const size = fieldValue(value);
  if (typeof size === "string") return formatSize([size]);
  if (Array.isArray(size)) {
    return formatSize(size.filter((code): code is string => typeof code === "string"));
  }
  return "";
}

export function vehicleKind(value: unknown): string {
  const code = fieldValue(value);
  return typeof code === "string" ? (VEHICLE_TYPES[code] ?? "vehicle") : "vehicle";
}

/** "space", or "land and sea" for the amphibious few. */
export function vehicleTerrain(value: unknown): string {
  const terrain = fieldValue(value);
  if (!Array.isArray(terrain)) return "";

  const names = terrain.filter((name): name is string => typeof name === "string");
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;

  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * "Gargantuan spelljamming ship (space)" — the line under the name.
 *
 * Built from whatever the entry has. The spelljammers carry no size and the two
 * objects carry no terrain, so a fixed template would print a stray word or an
 * empty pair of brackets on a third of the type.
 */
export function vehicleLine(data: Record<string, unknown>): string {
  const size = vehicleSize(data["size"]);
  const terrain = vehicleTerrain(data["terrain"]);

  const head = [size, vehicleKind(data["vehicleType"])].filter(Boolean).join(" ");
  return terrain ? `${head} (${terrain})` : head;
}

/** "175 ft. × 50 ft.", as the books give a hull's length and beam. */
export function vehicleDimensions(value: unknown): string {
  const dimensions = fieldValue(value);
  if (!Array.isArray(dimensions)) return "";

  const parts = dimensions.filter((part): part is string => typeof part === "string");
  return parts.join(" × ");
}

/**
 * Travel pace, in miles per hour.
 *
 * A ship states one number; a spelljammer states one per movement mode, and
 * writes the halves as vulgar fractions ("4½") rather than as decimals — which
 * is why this never does arithmetic on the value.
 */
export function vehiclePace(value: unknown): string {
  const pace = fieldValue(value);

  if (typeof pace === "number" || typeof pace === "string") {
    return `${pace} mph`;
  }

  if (pace && typeof pace === "object") {
    const parts = Object.entries(pace as Record<string, unknown>)
      .filter(([, amount]) => amount != null)
      .map(([mode, amount]) => `${mode} ${amount} mph`);
    if (parts.length) return parts.join(", ");
  }

  return "";
}

/**
 * "fly 40 ft.", or "100 ft." where the entry gives a bare number.
 *
 * The object and creature shapes store the creature `Speeds` map, so those go
 * through the bestiary's own formatter rather than a second implementation of
 * the same sentence.
 */
export function vehicleSpeed(value: unknown): string {
  const speed = fieldValue(value);

  if (typeof speed === "number") return `${speed} ft.`;
  if (speed && typeof speed === "object") {
    const formatted = formatSpeed(speed as Speeds);
    return formatted === EM_DASH ? "" : formatted;
  }

  return "";
}

/** An armour class given as a bare number, or as the creature shape's array. */
export function vehicleArmorClass(value: unknown): string {
  const ac = fieldValue(value);
  if (typeof ac === "number") return String(ac);
  if (Array.isArray(ac)) {
    const line = formatArmorClass(ac as AcEntry[]);
    return line === EM_DASH ? "" : line;
  }
  return "";
}

/**
 * Hit points, and the two thresholds an infernal war machine carries with them.
 *
 * Damage threshold is how much a single blow must do to mark the hull at all;
 * mishap threshold is where the driver starts losing control. Both belong on
 * this line rather than on one of their own — they qualify the number they
 * follow, and the books print them the same way.
 */
export function vehicleHitPoints(value: unknown): string {
  const hp = fieldValue(value);
  if (typeof hp === "number") return String(hp);
  if (!hp || typeof hp !== "object") return "";

  const record = hp as Record<string, unknown>;

  // The bestiary shape: an average and the dice that produced it.
  if (record["average"] != null || record["special"] != null) {
    const line = formatHitPoints(hp as HitPoints);
    return line === EM_DASH ? "" : line;
  }

  if (typeof record["hp"] !== "number") return "";

  const notes = [
    typeof record["dt"] === "number" ? `damage threshold ${record["dt"]}` : "",
    typeof record["mt"] === "number" ? `mishap threshold ${record["mt"]}` : "",
  ].filter(Boolean);

  return notes.length
    ? `${record["hp"]} (${notes.join(", ")})`
    : String(record["hp"]);
}

/**
 * Cargo capacity, whose unit follows the shape of the vehicle: a ship carries
 * tons and an infernal war machine carries pounds. Two of the ships state it as
 * a sentence instead — the mechanical beholder holds "crew and passengers'
 * normal gear" — which is printed as written.
 */
export function vehicleCargo(value: unknown, vehicleType: unknown): string {
  const cargo = fieldValue(value);
  if (typeof cargo === "string") return cargo;
  if (typeof cargo !== "number") return "";

  if (fieldValue(vehicleType) === "INFWAR") {
    return `${cargo.toLocaleString("en-US")} lb.`;
  }

  return `${cargo} ${cargo === 1 ? "ton" : "tons"}`;
}

/**
 * The eight upgrade categories, read off the entities rather than guessed from
 * the codes.
 *
 * Two families share one list and neither prefix means anything alone, so both
 * are spelled out: `SHP:M` covers the oars and the sails, `IWM:G` the smoke
 * screen and the teleporter — which BGDIA calls magical gadgets.
 */
const UPGRADE_TYPES: Record<string, string> = {
  "SHP:H": "Ship Hull",
  "SHP:M": "Ship Movement",
  "SHP:W": "Ship Weapon",
  "SHP:F": "Ship Figurehead",
  "SHP:O": "Ship Miscellaneous",
  "IWM:A": "War Machine Armor",
  "IWM:W": "War Machine Weapon",
  "IWM:G": "War Machine Gadget",
};

/** Every upgrade carries exactly one code, in a one-element array. */
export function upgradeKind(value: unknown): string {
  const codes = fieldValue(value);
  const code = Array.isArray(codes) ? codes[0] : codes;
  if (typeof code !== "string") return EM_DASH;

  return UPGRADE_TYPES[code] ?? code;
}

/** The rail's options, in the order a reader would expect to meet them. */
export const UPGRADE_KIND_CODES = Object.keys(UPGRADE_TYPES);
