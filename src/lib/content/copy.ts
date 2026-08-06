import { replaceOutsideTags } from "./tags";
import { resolveVariables } from "./variables";
import { deepClone, deepEquals, getPath, setPath, walkStrings } from "./walk";
import {
  abilityModifier,
  crToProficiencyBonus,
  formatModifier,
} from "./dnd";

/**
 * Resolver for the corpus `_copy` inheritance system — 2,113 entities in the
 * 2014 data are stored as a parent reference plus a patch, and are empty
 * shells until those patches are applied.
 *
 * A copy names a parent, optionally lists templates to layer on, and supplies
 * `_mod` operations describing how to transform the inherited content. Example
 * (Waterdeep: Dungeon of the Mad Mage):
 *
 *   { name: "Al'chaia", _copy: { name: "Githyanki Knight", source: "MM",
 *       _mod: { "*": { mode: "replaceTxt", replace: "the githyanki",
 *                      with: "Al'chaia", flags: "i" } } } }
 *
 * Behaviour here is deliberately faithful to the corpus authors' own copy
 * applier, including its quirks — diverging would make our stat blocks
 * silently disagree with the reference implementation, which is far worse to
 * debug than a shared bug.
 */

export interface EntityRef {
  name: string;
  source: string;
}

export interface CopyMeta extends EntityRef {
  _mod?: Record<string, ModInfo | ModInfo[]>;
  _preserve?: Record<string, boolean>;
  _templates?: EntityRef[];
}

export interface CorpusEntity extends Record<string, unknown> {
  name: string;
  source: string;
  _copy?: CopyMeta;
}

export interface MonsterTemplate extends EntityRef {
  apply?: {
    _mod?: Record<string, ModInfo | ModInfo[]>;
    _root?: Record<string, unknown>;
  };
}

export type ModInfo = "remove" | ({ mode: string } & Record<string, unknown>);

/**
 * Properties that describe an entity's *publication*, not its content.
 *
 * A copy must not silently inherit its parent's page number or SRD status —
 * "Animated Statue" appears in WDMM, not in the SRD, even though it copies an
 * SRD archmage. These transfer only when `_preserve` asks for them.
 */
const PUBLICATION_PROPS = new Set([
  "page",
  "otherSources",
  "referenceSources",
  "srd",
  "srd52",
  "basicRules",
  "basicRules2024",
  "reprintedAs",
  "hasFluff",
  "hasFluffImages",
  "hasToken",
  "tokenCredit",
  "tokenCustom",
  "foundryTokenScale",
  "altArt",
  "_versions",
]);

/** What the `"*"` mod key expands to: every stat-block content array. */
const ENTRY_PROPS = [
  "action",
  "bonus",
  "reaction",
  "trait",
  "legendary",
  "mythic",
  "variant",
  "spellcasting",
  "actionHeader",
  "bonusHeader",
  "reactionHeader",
  "legendaryHeader",
  "mythicHeader",
];

/** `"_"` and `"*"` are applied after named properties, in that order. */
const PROP_ORDER_TAIL = ["_", "*"];

export interface ResolveOptions {
  /** Resolve a parent reference. Case-insensitive matching is the caller's job. */
  findParent: (ref: EntityRef) => CorpusEntity | undefined;
  /** Resolve a monster template from `bestiary/template.json`. */
  findTemplate?: (ref: EntityRef) => MonsterTemplate | undefined;
  /**
   * Collect a problem instead of throwing.
   *
   * Ingest runs with a collector so one malformed entity does not abort a
   * 90 MB load; tests run without one so failures are loud.
   */
  onProblem?: (message: string) => void;
}

class CopyError extends Error {}

/**
 * Apply an entity's `_copy` directive, returning the fully-resolved entity.
 *
 * The input is not mutated. Entities without `_copy` are returned unchanged.
 */
export function resolveCopy(
  entity: CorpusEntity,
  options: ResolveOptions,
): CorpusEntity {
  if (!entity._copy) return entity;

  const target = deepClone(entity);
  const meta = target._copy as CopyMeta;
  const label = `${entity.name} (${entity.source})`;

  const parent = options.findParent({ name: meta.name, source: meta.source });
  if (!parent) {
    const message = `Cannot resolve _copy for ${label}: parent "${meta.name}|${meta.source}" not found`;
    if (!options.onProblem) throw new CopyError(message);
    options.onProblem(message);
    delete target._copy;
    return target;
  }

  const source = deepClone(parent);
  const mods = normaliseMods(meta._mod);

  applyTemplates({ target, meta, mods, options, label });
  inheritProperties(target, source, meta);
  applyMods({ target, mods, label, options });

  target._isCopy = true;
  delete target._copy;
  return target;
}

/**
 * Resolve a whole collection, following chains where a copy's parent is itself
 * a copy.
 *
 * Memoised, so a heavily-inherited base (the Monster Manual archmage has
 * dozens of descendants) resolves once. Cycles are reported rather than
 * overflowing the stack.
 */
export function resolveCopies(
  entities: CorpusEntity[],
  options: Omit<ResolveOptions, "findParent"> & {
    findParent?: (ref: EntityRef) => CorpusEntity | undefined;
  } = {},
): CorpusEntity[] {
  const byKey = new Map<string, CorpusEntity>();
  for (const entity of entities) {
    byKey.set(refKey(entity), entity);
  }

  const resolved = new Map<string, CorpusEntity>();
  const inProgress = new Set<string>();

  const lookup = (ref: EntityRef): CorpusEntity | undefined => {
    const key = refKey(ref);
    if (resolved.has(key)) return resolved.get(key);

    const raw = byKey.get(key) ?? options.findParent?.(ref);
    if (!raw) return undefined;
    if (!raw._copy) return raw;

    if (inProgress.has(key)) {
      const message = `Circular _copy chain involving "${key}"`;
      if (!options.onProblem) throw new CopyError(message);
      options.onProblem(message);
      return raw;
    }

    inProgress.add(key);
    const out = resolveCopy(raw, { ...options, findParent: lookup });
    inProgress.delete(key);

    resolved.set(key, out);
    return out;
  };

  return entities.map((entity) => {
    if (!entity._copy) return entity;
    const key = refKey(entity);
    return resolved.get(key) ?? lookup(entity) ?? entity;
  });
}

export function refKey(ref: EntityRef): string {
  return `${ref.name.toLowerCase().trim()}|${ref.source.toLowerCase().trim()}`;
}

/* -------------------------------------------------------------------------- */
/* Stages                                                                     */
/* -------------------------------------------------------------------------- */

function normaliseMods(
  mods: Record<string, ModInfo | ModInfo[]> | undefined,
): Record<string, ModInfo[]> {
  if (!mods) return {};
  return Object.fromEntries(
    Object.entries(mods).map(([key, value]) => [
      key,
      Array.isArray(value) ? value : [value],
    ]),
  );
}

/**
 * Merge template mods into the entity's own.
 *
 * Templates append to existing mods rather than replacing them, so an entity
 * can be both templated and hand-patched.
 */
function applyTemplates({
  target,
  meta,
  mods,
  options,
  label,
}: {
  target: CorpusEntity;
  meta: CopyMeta;
  mods: Record<string, ModInfo[]>;
  options: ResolveOptions;
  label: string;
}): void {
  if (!meta._templates?.length) return;

  const rootPropsBefore = new Set(Object.keys(target));
  const templates: MonsterTemplate[] = [];

  for (const ref of meta._templates) {
    const template = options.findTemplate?.(ref);
    if (!template) {
      const message = `Cannot resolve _copy for ${label}: template "${ref.name}|${ref.source}" not found`;
      if (!options.onProblem) throw new CopyError(message);
      options.onProblem(message);
      continue;
    }
    templates.push(template);
  }

  for (const template of templates) {
    const templateMods = normaliseMods(template.apply?._mod);
    for (const [key, value] of Object.entries(templateMods)) {
      mods[key] = mods[key] ? mods[key].concat(value) : value;
    }
  }

  // Root props apply after the base copy, and never clobber the entity's own.
  for (const template of templates) {
    for (const [key, value] of Object.entries(template.apply?._root ?? {})) {
      if (!rootPropsBefore.has(key)) target[key] = value;
    }
  }

  target._copyTemplates = meta._templates.map(({ name, source }) => ({
    name,
    source,
  }));
}

/**
 * Pull the parent's properties down onto the child.
 *
 * Three cases: an explicit `null` on the child suppresses inheritance of that
 * property; a value already present on the child wins; anything else is
 * inherited, unless it is publication metadata that was not preserved.
 */
function inheritProperties(
  target: CorpusEntity,
  source: CorpusEntity,
  meta: CopyMeta,
): void {
  const preserve = meta._preserve ?? {};

  for (const key of Object.keys(source)) {
    if (target[key] === null) {
      delete target[key];
      continue;
    }
    if (target[key] != null) continue;

    if (PUBLICATION_PROPS.has(key)) {
      if (preserve["*"] || preserve[key]) target[key] = source[key];
      continue;
    }

    target[key] = source[key];
  }
}

function applyMods({
  target,
  mods,
  label,
  options,
}: {
  target: CorpusEntity;
  mods: Record<string, ModInfo[]>;
  label: string;
  options: ResolveOptions;
}): void {
  const keys = Object.keys(mods);
  if (!keys.length) return;

  // Placeholders resolve against the merged entity, so this must run after
  // inheritance — `<$short_name$>` means the child's name, not the parent's.
  for (const key of keys) {
    mods[key] = resolveVariables(mods[key], target);
  }

  const ordered = keys.sort(
    (a, b) => PROP_ORDER_TAIL.indexOf(a) - PROP_ORDER_TAIL.indexOf(b),
  );

  for (const key of ordered) {
    const modInfos = mods[key];
    const props =
      key === "*" ? ENTRY_PROPS : key === "_" ? [null] : [key];

    for (const prop of props) {
      for (const modInfo of modInfos) {
        try {
          applyMod({ target, modInfo, prop, label });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (!options.onProblem) throw error;
          options.onProblem(message);
        }
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Mod operations                                                             */
/* -------------------------------------------------------------------------- */

function applyMod({
  target,
  modInfo,
  prop,
  label,
}: {
  target: CorpusEntity;
  modInfo: ModInfo;
  prop: string | null;
  label: string;
}): void {
  const failed = `Failed to apply _copy to ${label}.`;

  if (typeof modInfo === "string") {
    if (modInfo === "remove") {
      if (prop) delete target[prop];
      return;
    }
    throw new CopyError(`${failed} Unhandled mode: ${modInfo}`);
  }

  const path = prop ? prop.split(".") : null;
  const readArray = (): unknown[] | undefined => {
    const value = path ? getPath(target, path) : undefined;
    return Array.isArray(value) ? value : undefined;
  };
  const write = (value: unknown) => {
    if (path) setPath(target, path, value);
  };
  const items = (): unknown[] => {
    const raw = modInfo.items;
    return Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  };

  switch (modInfo.mode) {
    /* ---- text ---------------------------------------------------------- */

    case "replaceTxt": {
      if (!path) return;
      const entries = getPath(target, path);
      if (!Array.isArray(entries)) return;

      const pattern = new RegExp(
        String(modInfo.replace),
        `g${(modInfo.flags as string) ?? ""}`,
      );
      const replacement = String(modInfo.with ?? "");
      const tagInsensitive = Boolean(modInfo.tagInsensitive);

      const rewrite = (str: string) =>
        tagInsensitive
          ? str.replace(pattern, replacement)
          : replaceOutsideTags(str, (text) => text.replace(pattern, replacement));

      const targetProps = (modInfo.props as (string | null)[] | undefined) ?? [
        null,
        "entries",
        "headerEntries",
        "footerEntries",
      ];
      if (!targetProps.length) return;

      let next = entries;

      // `null` in props means "this array holds bare strings", as with
      // legendaryHeader.
      if (targetProps.includes(null)) {
        next = next.map((item) =>
          typeof item === "string" ? walkStrings(item, rewrite) : item,
        );
      }

      next = next.map((item) => {
        if (!item || typeof item !== "object") return item;
        const entry = { ...(item as Record<string, unknown>) };
        for (const key of targetProps) {
          if (key == null) continue;
          if (entry[key] != null) entry[key] = walkStrings(entry[key], rewrite);
        }
        return entry;
      });

      write(next);
      return;
    }

    case "replaceName": {
      const entries = readArray();
      if (!entries) return;
      const pattern = new RegExp(
        String(modInfo.replace),
        `g${(modInfo.flags as string) ?? ""}`,
      );
      write(
        entries.map((item) => {
          if (!item || typeof item !== "object") return item;
          const entry = item as Record<string, unknown>;
          if (typeof entry.name !== "string") return entry;
          return {
            ...entry,
            name: entry.name.replace(pattern, String(modInfo.with ?? "")),
          };
        }),
      );
      return;
    }

    case "appendStr": {
      if (!path) return;
      const existing = getPath(target, path);
      write(
        existing
          ? `${existing}${modInfo.joiner ?? ""}${modInfo.str}`
          : modInfo.str,
      );
      return;
    }

    case "prefixSuffixStringProp": {
      const propPath = buildPropPath(modInfo, path);
      const existing = getPath(target, propPath);
      if (typeof existing !== "string") return;
      setPath(
        target,
        propPath,
        `${modInfo.prefix ?? ""}${existing}${modInfo.suffix ?? ""}`,
      );
      return;
    }

    /* ---- arrays -------------------------------------------------------- */

    case "prependArr": {
      const existing = readArray();
      write(existing ? items().concat(existing) : items());
      return;
    }

    case "appendArr": {
      const existing = readArray();
      write(existing ? existing.concat(items()) : items());
      return;
    }

    case "appendIfNotExistsArr": {
      const existing = readArray();
      if (!existing) return write(items());
      write(
        existing.concat(
          items().filter((item) => !existing.some((x) => deepEquals(item, x))),
        ),
      );
      return;
    }

    case "replaceArr":
    case "replaceOrAppendArr": {
      const existing = readArray();
      const lenient = modInfo.mode === "replaceOrAppendArr";

      if (!existing) {
        if (lenient) return write(items());
        throw new CopyError(`${failed} Could not find "${prop}" array`);
      }

      const index = findReplaceIndex(existing, modInfo.replace);
      if (index >= 0) {
        existing.splice(index, 1, ...items());
        write(existing);
        return;
      }

      if (lenient) return write(existing.concat(items()));
      throw new CopyError(
        `${failed} Could not find "${prop}" item "${JSON.stringify(modInfo.replace)}" to replace`,
      );
    }

    case "insertArr": {
      const existing = readArray();
      if (!existing) throw new CopyError(`${failed} Could not find "${prop}" array`);
      const at = typeof modInfo.index === "number" && modInfo.index !== -1
        ? modInfo.index
        : existing.length;
      existing.splice(at, 0, ...items());
      write(existing);
      return;
    }

    case "removeArr": {
      const existing = readArray();
      if (!existing) return;

      if (modInfo.names !== undefined) {
        const names = Array.isArray(modInfo.names) ? modInfo.names : [modInfo.names];
        for (const name of names) {
          const index = existing.findIndex(
            (item) => (item as { name?: string })?.name === name,
          );
          if (index >= 0) existing.splice(index, 1);
          else if (!modInfo.force) {
            throw new CopyError(
              `${failed} Could not find "${prop}" item named "${name}" to remove`,
            );
          }
        }
        write(existing);
        return;
      }

      if (modInfo.items !== undefined) {
        for (const item of items()) {
          const index = existing.findIndex((x) => deepEquals(x, item));
          if (index >= 0) existing.splice(index, 1);
          else {
            throw new CopyError(
              `${failed} Could not find "${prop}" item ${JSON.stringify(item)} to remove`,
            );
          }
        }
        write(existing);
        return;
      }

      throw new CopyError(`${failed} removeArr needs "names" or "items"`);
    }

    case "renameArr": {
      const existing = readArray();
      if (!existing) return;
      const renames = Array.isArray(modInfo.renames)
        ? modInfo.renames
        : [modInfo.renames];

      for (const rename of renames as { rename: string; with: string }[]) {
        const entry = existing.find(
          (item) => (item as { name?: string })?.name === rename.rename,
        ) as Record<string, unknown> | undefined;
        if (!entry) {
          throw new CopyError(
            `${failed} Could not find "${prop}" item named "${rename.rename}" to rename`,
          );
        }
        entry.name = rename.with;
      }
      write(existing);
      return;
    }

    /* ---- scalar props -------------------------------------------------- */

    case "setProp": {
      setPath(target, buildPropPath(modInfo, path), deepClone(modInfo.value));
      return;
    }

    case "scalarAddProp":
    case "scalarMultProp": {
      const container = path ? getPath(target, path) : target;
      if (!container || typeof container !== "object") return;

      const record = container as Record<string, unknown>;
      const scalar = Number(modInfo.scalar);
      const keys =
        modInfo.prop === "*" ? Object.keys(record) : [String(modInfo.prop)];

      for (const key of keys) {
        const wasString = typeof record[key] === "string";
        let next =
          modInfo.mode === "scalarAddProp"
            ? Number(record[key]) + scalar
            : Number(record[key]) * scalar;
        if (modInfo.floor) next = Math.floor(next);
        record[key] = wasString ? formatModifier(next) : next;
      }
      return;
    }

    /* ---- bestiary-specific --------------------------------------------- */

    case "addSenses": {
      const senses = Array.isArray(modInfo.senses)
        ? modInfo.senses
        : [modInfo.senses];
      const existing = Array.isArray(target.senses)
        ? [...(target.senses as string[])]
        : [];

      for (const sense of senses as { type: string; range: number }[]) {
        const index = existing.findIndex((entry) =>
          new RegExp(`${sense.type} (\\d+)`, "i").test(entry),
        );
        if (index === -1) {
          existing.push(`${sense.type} ${sense.range} ft.`);
          continue;
        }
        // Never downgrade a sense the creature already has.
        const current = Number(
          new RegExp(`${sense.type} (\\d+)`, "i").exec(existing[index])?.[1],
        );
        if (current < sense.range) {
          existing[index] = `${sense.type} ${sense.range} ft.`;
        }
      }
      target.senses = existing;
      return;
    }

    case "addSaves":
    case "addAllSaves": {
      const proficiency = crToProficiencyBonus(target.cr);
      const saves = (target.save ?? {}) as Record<string, string>;
      const entries: [string, number][] =
        modInfo.mode === "addAllSaves"
          ? ["str", "dex", "con", "int", "wis", "cha"].map((abbrev) => [
              abbrev,
              Number(modInfo.saves ?? 1),
            ])
          : Object.entries(
              (modInfo.saves ?? {}) as Record<string, number>,
            ).map(([abbrev, mode]) => [abbrev, Number(mode)]);

      for (const [abbrev, mode] of entries) {
        const total = mode * proficiency + abilityModifier(target[abbrev]);
        // Only ever raise an existing save.
        if (saves[abbrev] != null && Number(saves[abbrev]) >= total) continue;
        saves[abbrev] = formatModifier(total);
      }
      target.save = saves;
      return;
    }

    case "addSkills":
    case "addAllSkills": {
      const proficiency = crToProficiencyBonus(target.cr);
      const skills = (target.skill ?? {}) as Record<string, string>;
      const entries = Object.entries(
        (modInfo.skills ?? {}) as Record<string, number>,
      );

      for (const [skill, mode] of entries) {
        const ability = SKILL_ABILITY[skill.toLowerCase()] ?? "dex";
        const total =
          Number(mode) * proficiency + abilityModifier(target[ability]);
        if (skills[skill] != null && Number(skills[skill]) >= total) continue;
        skills[skill] = formatModifier(total);
      }
      target.skill = skills;
      return;
    }

    case "addSpells":
    case "replaceSpells":
    case "removeSpells": {
      applySpellMod(target, modInfo);
      return;
    }

    case "scalarAddHit": {
      if (!path) return;
      write(
        walkStrings(getPath(target, path), (str) =>
          str.replace(/{@hit ([-+]?\d+)}/g, (_match, value: string) =>
            `{@hit ${Number(value) + Number(modInfo.scalar)}}`,
          ),
        ),
      );
      return;
    }

    case "scalarAddDc": {
      if (!path) return;
      write(
        walkStrings(getPath(target, path), (str) =>
          str.replace(/{@dc (\d+)}/g, (_match, value: string) =>
            `{@dc ${Number(value) + Number(modInfo.scalar)}}`,
          ),
        ),
      );
      return;
    }

    case "maxSize": {
      const order = ["T", "S", "M", "L", "H", "G"];
      const cap = order.indexOf(String(modInfo.max));
      if (cap === -1 || !Array.isArray(target.size)) return;
      target.size = (target.size as string[]).filter(
        (size) => order.indexOf(size) <= cap,
      );
      if (!(target.size as string[]).length) target.size = [String(modInfo.max)];
      return;
    }

    case "scalarMultXp": {
      const cr = target.cr;
      if (cr && typeof cr === "object") {
        const record = cr as Record<string, unknown>;
        if (record.xp != null) {
          record.xp = Math.floor(Number(record.xp) * Number(modInfo.scalar));
        }
      }
      return;
    }

    default:
      throw new CopyError(`${failed} Unhandled mode: ${modInfo.mode}`);
  }
}

/** Skill -> governing ability, for `addSkills`. */
const SKILL_ABILITY: Record<string, string> = {
  athletics: "str",
  acrobatics: "dex",
  "sleight of hand": "dex",
  stealth: "dex",
  arcana: "int",
  history: "int",
  investigation: "int",
  nature: "int",
  religion: "int",
  "animal handling": "wis",
  insight: "wis",
  medicine: "wis",
  perception: "wis",
  survival: "wis",
  deception: "cha",
  intimidation: "cha",
  performance: "cha",
  persuasion: "cha",
};

function buildPropPath(
  modInfo: Exclude<ModInfo, string>,
  path: string[] | null,
): string[] {
  const own = modInfo.prop ? String(modInfo.prop).split(".") : [];
  if (path && !(path.length === 1 && path[0] === "*")) return [...path, ...own];
  return own;
}

/**
 * Locate the array element a `replaceArr` targets. The `replace` field is
 * either a literal name, an explicit index, or a regex.
 */
function findReplaceIndex(existing: unknown[], replace: unknown): number {
  if (replace && typeof replace === "object") {
    const spec = replace as { regex?: string; flags?: string; index?: number };
    if (spec.index != null) return spec.index;
    if (spec.regex) {
      const pattern = new RegExp(spec.regex, spec.flags ?? "");
      return existing.findIndex((item) => {
        const name = (item as { name?: string })?.name;
        if (typeof name === "string") return pattern.test(name);
        return typeof item === "string" ? pattern.test(item) : false;
      });
    }
  }

  return existing.findIndex((item) => {
    const name = (item as { name?: string })?.name;
    return name !== undefined ? name === replace : item === replace;
  });
}

/**
 * Add, replace, or remove entries in a creature's spellcasting block.
 *
 * The block is an array of casting traits, each holding spell lists keyed by
 * level ("0" for cantrips) plus optional `will`/`daily` groupings.
 */
function applySpellMod(
  target: CorpusEntity,
  modInfo: Exclude<ModInfo, string>,
): void {
  const blocks = target.spellcasting;
  if (!Array.isArray(blocks) || !blocks.length) return;

  const block = blocks[0] as Record<string, unknown>;

  if (modInfo.mode === "addSpells" || modInfo.mode === "replaceSpells") {
    const spellsByLevel = (modInfo.spells ?? {}) as Record<string, unknown>;

    for (const [level, payload] of Object.entries(spellsByLevel)) {
      const slot = (block.spells ?? {}) as Record<string, { spells?: string[] }>;
      const bucket = slot[level] ?? { spells: [] };
      bucket.spells ??= [];

      if (modInfo.mode === "addSpells") {
        const additions = Array.isArray(payload)
          ? (payload as string[])
          : ((payload as { spells?: string[] })?.spells ?? []);
        bucket.spells = bucket.spells.concat(additions);
      } else {
        for (const swap of payload as { replace: string; with: string }[]) {
          const index = bucket.spells.indexOf(swap.replace);
          if (index >= 0) bucket.spells[index] = swap.with;
        }
      }

      slot[level] = bucket;
      block.spells = slot;
    }
    return;
  }

  // removeSpells
  const removals = (modInfo.spells ?? {}) as Record<string, string[]>;
  for (const [level, toRemove] of Object.entries(removals)) {
    const slot = (block.spells ?? {}) as Record<string, { spells?: string[] }>;
    const bucket = slot[level];
    if (!bucket?.spells) continue;
    bucket.spells = bucket.spells.filter((spell) => !toRemove.includes(spell));
  }
}
