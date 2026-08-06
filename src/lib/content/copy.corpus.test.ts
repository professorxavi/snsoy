import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type CorpusEntity,
  type MonsterTemplate,
  refKey,
  resolveCopies,
} from "./copy";

/**
 * Integration test: run the resolver over every real `_copy` in the corpus.
 *
 * Unit tests prove each operator in isolation; this proves the resolver
 * survives 2,113 hand-authored directives written over a decade, including the
 * ones nobody would think to invent. It is the check that actually catches
 * regressions.
 *
 * Skipped when CONTENT_SOURCE_DIR is unset so the suite still runs on a
 * machine without the corpus.
 */

const CONTENT_DIR = process.env.CONTENT_SOURCE_DIR;
const describeCorpus = CONTENT_DIR ? describe : describe.skip;

/** Read every `bestiary-*.json` and collect monsters plus templates. */
function loadBestiary(dir: string) {
  const monsters: CorpusEntity[] = [];

  for (const file of readdirSync(join(dir, "bestiary"))) {
    if (!file.startsWith("bestiary-") || !file.endsWith(".json")) continue;
    const parsed = JSON.parse(
      readFileSync(join(dir, "bestiary", file), "utf8"),
    ) as { monster?: CorpusEntity[] };
    if (parsed.monster) monsters.push(...parsed.monster);
  }

  const templateFile = JSON.parse(
    readFileSync(join(dir, "bestiary", "template.json"), "utf8"),
  ) as { monsterTemplate?: MonsterTemplate[] };

  const templates = new Map<string, MonsterTemplate>();
  for (const template of templateFile.monsterTemplate ?? []) {
    templates.set(refKey(template), template);
  }

  return { monsters, templates };
}

describeCorpus("copy resolver against the real corpus", () => {
  let monsters: CorpusEntity[];
  let resolved: CorpusEntity[];
  let problems: string[];

  // Loaded lazily: `describe.skip` still executes this callback, so reading the
  // filesystem at describe-scope would crash collection on a machine without
  // the corpus rather than skipping cleanly.
  beforeAll(() => {
    const loaded = loadBestiary(CONTENT_DIR!);
    monsters = loaded.monsters;
    problems = [];
    resolved = resolveCopies(monsters, {
      findTemplate: (ref) => loaded.templates.get(refKey(ref)),
      onProblem: (message) => problems.push(message),
    });
  });

  it("loads the expected corpus size", () => {
    expect(monsters.length).toBe(3808);
    expect(monsters.filter((m) => m._copy).length).toBeGreaterThan(900);
  });

  it("resolves every _copy without a single problem", () => {
    expect(problems).toEqual([]);
  });

  it("leaves no unresolved _copy directive behind", () => {
    expect(resolved.filter((m) => m._copy)).toEqual([]);
  });

  /**
   * The point of resolution: a copied monster is an empty shell until its
   * parent's stat block is merged in. Every resolved copy must end up with the
   * fields a stat block cannot render without.
   */
  it("gives every resolved copy a complete stat block", () => {
    const incomplete = resolved
      .filter((m) => m._isCopy)
      .filter(
        (m) =>
          m.size === undefined ||
          m.type === undefined ||
          m.ac === undefined ||
          m.hp === undefined ||
          m.str === undefined,
      )
      .map((m) => `${m.name}|${m.source}`);

    expect(incomplete).toEqual([]);
  });

  it("does not leak SRD status from parents to copies", () => {
    // "Animated Statue" (WDMM) copies the SRD archmage but is not itself SRD.
    const statue = resolved.find(
      (m) => m.name === "Animated Statue" && m.source === "WDMM",
    );
    expect(statue).toBeDefined();
    expect(statue!.srd).toBeUndefined();
    expect(statue!.trait).toBeDefined();
  });

  it("applies replaceTxt without corrupting cross-reference tags", () => {
    const tagPattern = /\{@(\w+)\s+([^|}]+)/g;
    const broken: string[] = [];

    for (const monster of resolved.filter((m) => m._isCopy)) {
      for (const match of JSON.stringify(monster).matchAll(tagPattern)) {
        // A tag whose name got rewritten into nonsense shows up as an empty
        // or whitespace-only lookup key.
        if (!match[2].trim()) broken.push(`${monster.name}|${monster.source}`);
      }
    }

    expect([...new Set(broken)]).toEqual([]);
  });

  it("resolves the Al'chaia replaceTxt case from WDMM", () => {
    const alchaia = resolved.find(
      (m) => m.name === "Al'chaia" && m.source === "WDMM",
    );
    expect(alchaia).toBeDefined();
    // Inherits the githyanki knight's stat block...
    expect(alchaia!.str).toBeDefined();
    // ...with its own HP override preserved.
    expect(alchaia!.hp).toMatchObject({ average: 140 });
    // ...and "the githyanki" rewritten throughout the prose.
    expect(JSON.stringify(alchaia!.action)).not.toMatch(/the githyanki/i);
  });
});
