import { describe, expect, it } from "vitest";
import {
  type CorpusEntity,
  type ModInfo,
  resolveCopies,
  resolveCopy,
} from "./copy";

/** Build a `findParent` over a fixed set of entities. */
const lookup = (...entities: CorpusEntity[]) => ({
  findParent: ({ name, source }: { name: string; source: string }) =>
    entities.find(
      (e) =>
        e.name.toLowerCase() === name.toLowerCase() &&
        e.source.toLowerCase() === source.toLowerCase(),
    ),
});

const goblin: CorpusEntity = {
  name: "Goblin",
  source: "MM",
  page: 166,
  srd: true,
  cr: "1/4",
  str: 8,
  dex: 14,
  size: ["S"],
  senses: ["darkvision 60 ft."],
  trait: [{ name: "Nimble Escape", entries: ["The goblin can Disengage."] }],
  action: [{ name: "Scimitar", entries: ["{@hit 4} to hit, {@dc 12} save."] }],
};

describe("inheritance", () => {
  it("pulls down properties the child does not define", () => {
    const result = resolveCopy(
      { name: "Goblin Boss", source: "XYZ", _copy: { name: "Goblin", source: "MM" } },
      lookup(goblin),
    );
    expect(result.cr).toBe("1/4");
    expect(result.str).toBe(8);
    expect(result._isCopy).toBe(true);
    expect(result._copy).toBeUndefined();
  });

  it("keeps the child's own value over the parent's", () => {
    const result = resolveCopy(
      { name: "Tough Goblin", source: "XYZ", cr: "2", _copy: { name: "Goblin", source: "MM" } },
      lookup(goblin),
    );
    expect(result.cr).toBe("2");
  });

  it("treats an explicit null on the child as suppression", () => {
    const result = resolveCopy(
      { name: "Blind Goblin", source: "XYZ", senses: null, _copy: { name: "Goblin", source: "MM" } },
      lookup(goblin),
    );
    expect("senses" in result).toBe(false);
  });

  /**
   * A copy appears in its own book, not its parent's. Inheriting `srd` would
   * wrongly expose non-SRD content to anonymous users.
   */
  it("does not inherit publication metadata by default", () => {
    const result = resolveCopy(
      { name: "Goblin Boss", source: "XYZ", _copy: { name: "Goblin", source: "MM" } },
      lookup(goblin),
    );
    expect(result.srd).toBeUndefined();
    expect(result.page).toBeUndefined();
  });

  it("inherits publication metadata when _preserve asks for it", () => {
    const result = resolveCopy(
      {
        name: "Goblin Boss",
        source: "XYZ",
        _copy: { name: "Goblin", source: "MM", _preserve: { page: true } },
      },
      lookup(goblin),
    );
    expect(result.page).toBe(166);
    expect(result.srd).toBeUndefined();
  });

  it("reports a missing parent instead of throwing when a collector is given", () => {
    const problems: string[] = [];
    const result = resolveCopy(
      { name: "Orphan", source: "XYZ", _copy: { name: "Nobody", source: "NONE" } },
      { findParent: () => undefined, onProblem: (m) => problems.push(m) },
    );
    expect(problems).toHaveLength(1);
    expect(result._copy).toBeUndefined();
  });

  it("throws on a missing parent when no collector is given", () => {
    expect(() =>
      resolveCopy(
        { name: "Orphan", source: "XYZ", _copy: { name: "Nobody", source: "NONE" } },
        { findParent: () => undefined },
      ),
    ).toThrow(/not found/);
  });
});

describe("array mods", () => {
  const copyWith = (mod: Record<string, ModInfo | ModInfo[]>) =>
    resolveCopy(
      { name: "Variant", source: "XYZ", _copy: { name: "Goblin", source: "MM", _mod: mod } },
      lookup(goblin),
    );

  it("appendArr adds to the end", () => {
    const result = copyWith({
      trait: { mode: "appendArr", items: { name: "Brave", entries: ["Fearless."] } },
    });
    expect((result.trait as { name: string }[]).map((t) => t.name)).toEqual([
      "Nimble Escape",
      "Brave",
    ]);
  });

  it("prependArr adds to the front", () => {
    const result = copyWith({
      trait: { mode: "prependArr", items: { name: "First", entries: ["x"] } },
    });
    expect((result.trait as { name: string }[])[0].name).toBe("First");
  });

  it("removeArr drops a named entry", () => {
    const result = copyWith({ trait: { mode: "removeArr", names: "Nimble Escape" } });
    expect(result.trait).toEqual([]);
  });

  it("removeArr throws for a name that is not present", () => {
    expect(() => copyWith({ trait: { mode: "removeArr", names: "Nope" } })).toThrow(
      /to remove/,
    );
  });

  it("removeArr tolerates a missing name when force is set", () => {
    expect(() =>
      copyWith({ trait: { mode: "removeArr", names: "Nope", force: true } }),
    ).not.toThrow();
  });

  it("replaceArr swaps a named entry in place", () => {
    const result = copyWith({
      trait: {
        mode: "replaceArr",
        replace: "Nimble Escape",
        items: { name: "Clumsy", entries: ["No escape."] },
      },
    });
    expect((result.trait as { name: string }[])[0].name).toBe("Clumsy");
  });

  it("replaceArr throws when the target is absent", () => {
    expect(() =>
      copyWith({ trait: { mode: "replaceArr", replace: "Ghost", items: {} } }),
    ).toThrow(/to replace/);
  });

  it("appendIfNotExistsArr skips structurally equal entries", () => {
    const result = copyWith({
      trait: {
        mode: "appendIfNotExistsArr",
        items: { name: "Nimble Escape", entries: ["The goblin can Disengage."] },
      },
    });
    expect(result.trait).toHaveLength(1);
  });

  it("insertArr places items at the given index", () => {
    const result = copyWith({
      trait: { mode: "insertArr", index: 0, items: { name: "Inserted", entries: [] } },
    });
    expect((result.trait as { name: string }[])[0].name).toBe("Inserted");
  });

  it("renameArr renames a named entry", () => {
    const result = copyWith({
      trait: { mode: "renameArr", renames: { rename: "Nimble Escape", with: "Slippery" } },
    });
    expect((result.trait as { name: string }[])[0].name).toBe("Slippery");
  });
});

describe("replaceTxt", () => {
  it("rewrites prose across every entry property", () => {
    const result = resolveCopy(
      {
        name: "Hobgoblin",
        source: "XYZ",
        _copy: {
          name: "Goblin",
          source: "MM",
          _mod: { "*": { mode: "replaceTxt", replace: "goblin", with: "hobgoblin", flags: "i" } },
        },
      },
      lookup(goblin),
    );
    expect((result.trait as { entries: string[] }[])[0].entries[0]).toBe(
      "The hobgoblin can Disengage.",
    );
  });

  /** Tag arguments are lookup keys — rewriting them breaks cross-references. */
  it("does not rewrite inside tags", () => {
    const parent: CorpusEntity = {
      name: "Base",
      source: "MM",
      action: [{ name: "Cast", entries: ["the goblin casts {@spell goblin bolt|MM}"] }],
    };
    const result = resolveCopy(
      {
        name: "Derived",
        source: "XYZ",
        _copy: {
          name: "Base",
          source: "MM",
          _mod: { "*": { mode: "replaceTxt", replace: "goblin", with: "orc" } },
        },
      },
      lookup(parent),
    );
    expect((result.action as { entries: string[] }[])[0].entries[0]).toBe(
      "the orc casts {@spell goblin bolt|MM}",
    );
  });
});

describe("numeric mods", () => {
  it("scalarAddHit shifts attack bonuses inside tags", () => {
    const result = resolveCopy(
      {
        name: "Stronger",
        source: "XYZ",
        _copy: {
          name: "Goblin",
          source: "MM",
          _mod: { action: { mode: "scalarAddHit", scalar: 2 } },
        },
      },
      lookup(goblin),
    );
    expect((result.action as { entries: string[] }[])[0].entries[0]).toContain("{@hit 6}");
  });

  it("scalarAddDc shifts save DCs inside tags", () => {
    const result = resolveCopy(
      {
        name: "Harder",
        source: "XYZ",
        _copy: {
          name: "Goblin",
          source: "MM",
          _mod: { action: { mode: "scalarAddDc", scalar: 3 } },
        },
      },
      lookup(goblin),
    );
    expect((result.action as { entries: string[] }[])[0].entries[0]).toContain("{@dc 15}");
  });

  it("addSenses adds a sense the creature lacks", () => {
    const result = resolveCopy(
      {
        name: "Seer",
        source: "XYZ",
        _copy: {
          name: "Goblin",
          source: "MM",
          _mod: { _: { mode: "addSenses", senses: { type: "truesight", range: 30 } } },
        },
      },
      lookup(goblin),
    );
    expect(result.senses).toContain("truesight 30 ft.");
  });

  it("addSenses never downgrades an existing sense", () => {
    const result = resolveCopy(
      {
        name: "Dim",
        source: "XYZ",
        _copy: {
          name: "Goblin",
          source: "MM",
          _mod: { _: { mode: "addSenses", senses: { type: "darkvision", range: 30 } } },
        },
      },
      lookup(goblin),
    );
    expect(result.senses).toEqual(["darkvision 60 ft."]);
  });

  it("addSkills derives the bonus from CR and the governing ability", () => {
    const result = resolveCopy(
      {
        name: "Sneak",
        source: "XYZ",
        _copy: {
          name: "Goblin",
          source: "MM",
          _mod: { _: { mode: "addSkills", skills: { stealth: 2 } } },
        },
      },
      lookup(goblin),
    );
    // CR 1/4 -> proficiency 2, expertise doubles it, DEX 14 -> +2. Total +6.
    expect((result.skill as Record<string, string>).stealth).toBe("+6");
  });
});

/**
 * `<$variable$>` placeholders are resolved in exactly one place: the payloads
 * of `_mod` operations, evaluated against the merged child entity.
 *
 * This mirrors the reference implementation, which resolves variables only on
 * the `_mod` payload. It matters because monster templates in
 * `bestiary/template.json` inject generic text like "DC <$dc__con$>" that must
 * pick up the *recipient's* stats. All 66 placeholders reachable from the copy
 * path live in that file.
 */
describe("variable resolution in mod payloads", () => {
  const parent: CorpusEntity = {
    name: "Base",
    source: "MM",
    cr: "5",
    con: 16,
    dex: 14,
    trait: [{ name: "Existing", entries: ["untouched"] }],
  };

  it("computes a save DC from the merged entity's stats", () => {
    const result = resolveCopy(
      {
        name: "Derived",
        source: "XYZ",
        _copy: {
          name: "Base",
          source: "MM",
          _mod: {
            trait: {
              mode: "appendArr",
              items: { name: "Breath", entries: ["DC <$dc__con$> Constitution save."] },
            },
          },
        },
      },
      lookup(parent),
    );
    // 8 + CON mod (+3) + proficiency for CR 5 (+3) = 14.
    expect((result.trait as { entries: string[] }[])[1].entries[0]).toBe(
      "DC 14 Constitution save.",
    );
  });

  it("resolves <$title_short_name$> against the child, not the parent", () => {
    const result = resolveCopy(
      {
        name: "Animated Statue",
        source: "XYZ",
        _copy: {
          name: "Base",
          source: "MM",
          _mod: {
            trait: {
              mode: "appendArr",
              items: { name: "Resistance", entries: ["<$title_short_name$> has advantage."] },
            },
          },
        },
      },
      lookup(parent),
    );
    expect((result.trait as { entries: string[] }[])[1].entries[0]).toBe(
      "The animated statue has advantage.",
    );
  });

  it("computes an attack bonus from CR and ability score", () => {
    const result = resolveCopy(
      {
        name: "Derived",
        source: "XYZ",
        _copy: {
          name: "Base",
          source: "MM",
          _mod: {
            trait: { mode: "appendArr", items: { name: "Claw", entries: ["<$to_hit__dex$> to hit"] } },
          },
        },
      },
      lookup(parent),
    );
    // proficiency for CR 5 (+3) + DEX mod (+2) = +5.
    expect((result.trait as { entries: string[] }[])[1].entries[0]).toBe("+5 to hit");
  });

  /**
   * Inherited content is copied verbatim. Placeholders in parent entries are
   * resolved at render time, not here — doing it at ingest would bake in
   * values that the renderer expects to compute.
   */
  it("leaves placeholders in inherited content untouched", () => {
    const templated: CorpusEntity = {
      name: "Templated",
      source: "MM",
      cr: "5",
      con: 16,
      trait: [{ name: "Aura", entries: ["DC <$dc__con$> save."] }],
    };
    const result = resolveCopy(
      { name: "Child", source: "XYZ", _copy: { name: "Templated", source: "MM" } },
      lookup(templated),
    );
    expect((result.trait as { entries: string[] }[])[0].entries[0]).toBe(
      "DC <$dc__con$> save.",
    );
  });

  /**
   * `<$level$>` and `<$int_mod$>` appear in class files (`preparedSpells`) and
   * belong to character building, not creature copying. An unknown mode must
   * pass through untouched rather than resolving to something wrong.
   */
  it("passes through variables it has no resolver for", () => {
    const result = resolveCopy(
      {
        name: "Derived",
        source: "XYZ",
        _copy: {
          name: "Base",
          source: "MM",
          _mod: {
            trait: { mode: "appendArr", items: { name: "X", entries: ["<$level$> + <$int_mod$>"] } },
          },
        },
      },
      lookup(parent),
    );
    expect((result.trait as { entries: string[] }[])[1].entries[0]).toBe(
      "<$level$> + <$int_mod$>",
    );
  });
});

describe("resolveCopies", () => {
  it("resolves a chain where a copy's parent is itself a copy", () => {
    const entities: CorpusEntity[] = [
      goblin,
      { name: "Goblin Boss", source: "MM", cr: "1", _copy: { name: "Goblin", source: "MM" } },
      { name: "Goblin King", source: "XYZ", _copy: { name: "Goblin Boss", source: "MM" } },
    ];
    const [, , king] = resolveCopies(entities);
    expect(king.cr).toBe("1");
    expect(king.dex).toBe(14);
  });

  it("reports a cycle rather than overflowing the stack", () => {
    const problems: string[] = [];
    resolveCopies(
      [
        { name: "A", source: "X", _copy: { name: "B", source: "X" } },
        { name: "B", source: "X", _copy: { name: "A", source: "X" } },
      ],
      { onProblem: (m) => problems.push(m) },
    );
    expect(problems.some((p) => /Circular/.test(p))).toBe(true);
  });

  it("leaves entities without _copy untouched", () => {
    const [result] = resolveCopies([goblin]);
    expect(result).toBe(goblin);
  });
});
