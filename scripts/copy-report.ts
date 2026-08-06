import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  type CorpusEntity,
  type MonsterTemplate,
  refKey,
  resolveCopies,
} from "../src/lib/content/copy";

/**
 * Diagnostic for the `_copy` resolver: reports what it actually did across the
 * whole bestiary. Not a test — a thing to eyeball when something looks wrong.
 *
 *   pnpm tsx scripts/copy-report.ts
 */

const dir = process.env.CONTENT_SOURCE_DIR;
if (!dir) throw new Error("CONTENT_SOURCE_DIR is not set");

const monsters: CorpusEntity[] = [];
for (const file of readdirSync(join(dir, "bestiary"))) {
  if (!file.startsWith("bestiary-") || !file.endsWith(".json")) continue;
  const parsed = JSON.parse(readFileSync(join(dir, "bestiary", file), "utf8"));
  if (parsed.monster) monsters.push(...parsed.monster);
}

const templateFile = JSON.parse(
  readFileSync(join(dir, "bestiary", "template.json"), "utf8"),
) as { monsterTemplate?: MonsterTemplate[] };
const templates = new Map(
  (templateFile.monsterTemplate ?? []).map((t) => [refKey(t), t]),
);

const problems: string[] = [];
const started = Date.now();
const resolved = resolveCopies(monsters, {
  findTemplate: (ref) => templates.get(refKey(ref)),
  onProblem: (m) => problems.push(m),
});
const elapsed = Date.now() - started;

const withCopy = monsters.filter((m) => m._copy).length;
const marked = resolved.filter((m) => m._isCopy).length;
const templated = resolved.filter((m) => m._copyTemplates).length;
const leftover = resolved.filter((m) => m._copy).length;

console.log(`monsters loaded      ${monsters.length}`);
console.log(`had _copy            ${withCopy}`);
console.log(`resolved (_isCopy)   ${marked}`);
console.log(`used templates       ${templated}`);
console.log(`unresolved _copy     ${leftover}`);
console.log(`problems             ${problems.length}`);
console.log(`elapsed              ${elapsed}ms`);

if (problems.length) {
  console.log("\nfirst 10 problems:");
  for (const problem of problems.slice(0, 10)) console.log(`  - ${problem}`);
}
