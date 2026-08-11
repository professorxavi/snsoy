import { describe, expect, it } from "vitest";
import {
  upgradeKind,
  vehicleArmorClass,
  vehicleCargo,
  vehicleDimensions,
  vehicleHitPoints,
  vehicleLine,
  vehiclePace,
  vehicleSize,
  vehicleSpeed,
  vehicleTerrain,
} from "./vehicles";

/**
 * Every value here is one of the five shapes `vehicleType` produces, taken from
 * the entity named in the comment. They disagree about almost every field, and
 * a formatter that handled only the shape someone happened to open would leave
 * two thirds of the type blank with nothing else failing.
 */

describe("vehicleLine", () => {
  /** Astral Brig: a size letter, a terrain, and the code's own word. */
  it("reads the ship shape", () => {
    expect(vehicleLine({ size: "G", vehicleType: "SHIP", terrain: ["air"] })).toBe(
      "Gargantuan ship (air)",
    );
  });

  /** Nightspider: no size at all — a spelljammer states its dimensions instead. */
  it("omits a size the entry does not give", () => {
    expect(
      vehicleLine({ vehicleType: "SPELLJAMMER", terrain: ["space"] }),
    ).toBe("spelljamming ship (space)");
  });

  /** Apparatus of Kwalish: stat-blocked like an object, and no terrain. */
  it("omits the brackets where there is no terrain", () => {
    expect(vehicleLine({ size: ["L"], vehicleType: "OBJECT" })).toBe(
      "Large vehicle",
    );
  });

  /**
   * `OBJECT` and `CREATURE` say how the entry is stat-blocked, not what it is.
   * The Stahlmaster is a walking machine a party pilots, and calling it a
   * creature on the strength of the code would be the data misread aloud.
   */
  it("does not turn a stat-block shape into a noun", () => {
    expect(vehicleLine({ size: ["L"], vehicleType: "CREATURE" })).toBe(
      "Large vehicle",
    );
  });

  /** Turtle Ship: amphibious, so both terrains are named. */
  it("joins two terrains", () => {
    expect(vehicleTerrain(["sea", "space"])).toBe("sea and space");
  });
});

describe("vehicleSize", () => {
  it("reads a bare letter and an array alike", () => {
    expect(vehicleSize("G")).toBe("Gargantuan");
    expect(vehicleSize(["L"])).toBe("Large");
    expect(vehicleSize(undefined)).toBe("");
  });

  /** A list row reads the field as the JSON text `->>` produced. */
  it("reads the field as JSON text too", () => {
    expect(vehicleSize('["L"]')).toBe("Large");
  });
});

describe("vehiclePace and vehicleSpeed", () => {
  /** Galley: one number, in miles per hour. */
  it("reads a ship's single pace", () => {
    expect(vehiclePace(4)).toBe("4 mph");
  });

  /**
   * Flying Fish Ship: a pace per mode, with the halves written as vulgar
   * fractions. Nothing here does arithmetic on the value for that reason.
   */
  it("reads a spelljammer's pace per mode", () => {
    expect(vehiclePace({ fly: "4½" })).toBe("fly 4½ mph");
  });

  it("reads a speed given in feet or as the creature map", () => {
    expect(vehicleSpeed(100)).toBe("100 ft.");
    expect(vehicleSpeed({ fly: 40 })).toBe("fly 40 ft.");
    expect(vehicleSpeed({ walk: 30, swim: 30 })).toBe("30 ft., swim 30 ft.");
  });
});

describe("vehicleArmorClass and vehicleHitPoints", () => {
  it("reads an armour class given as a number or as the creature array", () => {
    expect(vehicleArmorClass(18)).toBe("18");
    expect(vehicleArmorClass([{ ac: 16, from: ["natural armor"] }])).toBe(
      "16 (natural armor)",
    );
    expect(vehicleArmorClass(undefined)).toBe("");
  });

  /**
   * Demon Grinder. Damage threshold is how hard a blow must land to mark the
   * hull; mishap threshold is where the driver starts losing control. Both
   * qualify the number they follow, so both go on its line.
   */
  it("carries an infernal war machine's two thresholds", () => {
    expect(vehicleHitPoints({ hp: 200, dt: 10, mt: 20 })).toBe(
      "200 (damage threshold 10, mishap threshold 20)",
    );
  });

  /** Stahlmaster: stat-blocked like a creature, dice and all. */
  it("reads the creature shape", () => {
    expect(vehicleHitPoints({ average: 67, formula: "9d10 + 18" })).toBe(
      "67 (9d10 + 18)",
    );
  });
});

describe("vehicleCargo", () => {
  /** A ship carries tons; an infernal war machine carries pounds. */
  it("takes its unit from the shape of the vehicle", () => {
    expect(vehicleCargo(150, "SHIP")).toBe("150 tons");
    expect(vehicleCargo(1, "SHIP")).toBe("1 ton");
    expect(vehicleCargo(2000, "INFWAR")).toBe("2,000 lb.");
  });

  /** Mechanical Beholder states a sentence rather than a number. */
  it("prints a stated capacity as written", () => {
    expect(vehicleCargo("crew and passengers' normal gear", "SHIP")).toBe(
      "crew and passengers' normal gear",
    );
  });
});

describe("vehicleDimensions", () => {
  it("reads a hull's length and beam", () => {
    expect(vehicleDimensions(["175 ft.", "50 ft."])).toBe("175 ft. × 50 ft.");
    expect(vehicleDimensions(undefined)).toBe("");
  });
});

/**
 * The eight codes, read off the entities they cover rather than guessed from
 * the letters: `SHP:M` is the oars and the sails, `SHP:O` is what is left over,
 * and `IWM:G` is what BGDIA calls magical gadgets.
 */
describe("upgradeKind", () => {
  it("spells out both families", () => {
    expect(upgradeKind(["SHP:M"])).toBe("Ship Movement");
    expect(upgradeKind(["SHP:O"])).toBe("Ship Miscellaneous");
    expect(upgradeKind(["IWM:G"])).toBe("War Machine Gadget");
  });

  it("reads the field as JSON text too", () => {
    expect(upgradeKind('["IWM:A"]')).toBe("War Machine Armor");
  });

  it("prints an unknown code rather than inventing a category for it", () => {
    expect(upgradeKind(["SHP:Z"])).toBe("SHP:Z");
    expect(upgradeKind(undefined)).toBe("—");
  });
});
