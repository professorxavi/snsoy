import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { entities } from "./entities";

/**
 * Detail tables follow one shape: a `uid` foreign key into the registry,
 * typed columns for the facets that drive filtering and sorting, and `data`
 * holding the complete original object.
 *
 * The typed columns exist for querying, not for display — the renderer always
 * reads `data`, so column modelling never costs fidelity. When a filter needs
 * a facet we did not project, add a column and re-run ingest.
 */
const entityRef = () =>
  uuid()
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" });

/** A nullable reference to another entity. */
const optionalRef = () => uuid().references(() => entities.id, { onDelete: "set null" });

/** A required reference to another entity. */
const requiredRef = () =>
  uuid()
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" });

export const spells = pgTable(
  "spells",
  {
    entityId: entityRef(),
    /** 0 = cantrip. */
    level: integer().notNull(),
    /** Single-letter school code: V, A, C, D, E, I, N, T. */
    school: varchar({ length: 1 }).notNull(),
    /** "action", "bonus", "reaction", "minute", "hour". */
    castingTimeUnit: varchar({ length: 16 }).notNull(),
    castingTimeNumber: integer(),
    isRitual: boolean().notNull().default(false),
    isConcentration: boolean().notNull().default(false),
    /** "point", "radius", "self", "touch", "sight", "unlimited"... */
    rangeType: varchar({ length: 24 }),
    /** Normalised to feet so range sorting works across mixed units. */
    rangeFeet: integer(),
    hasVerbal: boolean().notNull().default(false),
    hasSomatic: boolean().notNull().default(false),
    hasMaterial: boolean().notNull().default(false),
    /** Material components with a stated gp cost gate spell availability. */
    materialCostGp: real(),
    isMaterialConsumed: boolean().notNull().default(false),
    damageTypes: text().array(),
    savingThrows: text().array(),
    conditionsInflicted: text().array(),
    /**
     * Classes able to cast this spell, Title-cased — "Cleric", not "cleric".
     *
     * Derived from `generated/gendata-spell-source-lookup.json`, not from the
     * spell object itself — the 2014 corpus stores this mapping externally.
     *
     * Merges the lookup's `class` and `classVariant` grants. `classVariant` is
     * how the corpus records a later book adding a spell to an earlier class's
     * list, and it is the only grant 119 spells have — reading `class` alone
     * left every XGE spell with an empty list and invisible to the class
     * filter. The "added later" distinction is deliberately not preserved.
     *
     * Empty is meaningful and rare: 16 spells are subclass-only (the EGW
     * Chronurgy and Graviturgy wizard lists, plus GGR's Encode Thoughts) and
     * genuinely belong to no class list.
     */
    classes: text().array(),
    subclasses: text().array(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    index().on(table.level),
    index().on(table.school),
    index().on(table.isConcentration),
    index().using("gin", table.classes),
  ],
);

export const monsters = pgTable(
  "monsters",
  {
    entityId: entityRef(),
    /**
     * Challenge rating as a number so ranges sort and filter correctly —
     * fractional CRs become 0.125/0.25/0.5. Null where the corpus gives no
     * usable CR (some templates and NPC stat blocks).
     */
    cr: numeric({ precision: 6, scale: 3, mode: "number" }),
    /** Original CR string ("1/8", "13", "Unknown") for display. */
    crDisplay: varchar({ length: 16 }),
    /** T, S, M, L, H, G — an array because a few creatures span sizes. */
    sizes: text().array(),
    creatureType: varchar({ length: 32 }),
    creatureSubtypes: text().array(),
    alignment: text().array(),
    /** Lowest printed AC; variants live in `data`. */
    armorClass: integer(),
    hitPointsAverage: integer(),
    speedWalk: integer(),
    speedFly: integer(),
    speedSwim: integer(),
    speedClimb: integer(),
    speedBurrow: integer(),
    environments: text().array(),
    isLegendary: boolean().notNull().default(false),
    isSpellcaster: boolean().notNull().default(false),
    /** Corpus `traitTags` + `actionTags`, flattened for facet filtering. */
    tags: text().array(),
    damageTags: text().array(),
    /** Lair actions and regional effects live on a shared legendary group. */
    legendaryGroupId: optionalRef(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    index().on(table.cr),
    index().on(table.creatureType),
    index().on(table.isLegendary),
    index().using("gin", table.environments),
    index().using("gin", table.tags),
  ],
);

export const items = pgTable(
  "items",
  {
    entityId: entityRef(),
    /** "common".."legendary", "artifact", "varies", "none"/"unknown". */
    rarity: varchar({ length: 24 }),
    /** Corpus type abbreviation: "M" melee, "HA" heavy armor, "SCF"... */
    itemType: varchar({ length: 16 }),
    /** Resolved human-readable type, for display and grouping. */
    itemTypeName: text(),
    requiresAttunement: boolean().notNull().default(false),
    /** e.g. "by a spellcaster" — null when attunement is unconditional. */
    attunementNote: text(),
    /** Normalised to copper so mixed-denomination values sort correctly. */
    valueCp: integer(),
    weightLb: real(),
    isMagic: boolean().notNull().default(false),
    isWondrous: boolean().notNull().default(false),
    /**
     * True for the ~1,900 items generated by applying a magic-variant template
     * to a base item (e.g. "+1 Longsword"). The corpus stores these as
     * templates and expects the consumer to expand them.
     */
    isGeneratedVariant: boolean().notNull().default(false),
    /** For generated variants, the base item this was built from. */
    baseItemId: optionalRef(),
    properties: text().array(),
    weaponCategory: varchar({ length: 24 }),
    armorClass: integer(),
    strengthRequirement: integer(),
    hasStealthPenalty: boolean().notNull().default(false),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    index().on(table.rarity),
    index().on(table.itemType),
    index().on(table.isMagic),
    index().on(table.requiresAttunement),
  ],
);

export const classes = pgTable("classes", {
  entityId: entityRef(),
  /** Hit die faces: 6, 8, 10, 12. */
  hitDie: integer(),
  /** "full", "1/2", "1/3", "pact", or null for non-casters. */
  casterProgression: varchar({ length: 16 }),
  spellcastingAbility: varchar({ length: 8 }),
  /** Prepared vs known casting changes the whole builder flow. */
  preparesSpells: boolean().notNull().default(false),
  savingThrowProficiencies: text().array(),
  /** "Archetype", "Divine Domain", "Otherworldly Patron"... */
  subclassTitle: text(),
  data: jsonb().$type<Record<string, unknown>>().notNull(),
});

export const subclasses = pgTable(
  "subclasses",
  {
    entityId: entityRef(),
    classId: requiredRef(),
    /** Short label used by cross-reference tags, e.g. "Evocation". */
    shortName: text(),
    casterProgression: varchar({ length: 16 }),
    spellcastingAbility: varchar({ length: 8 }),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (table) => [index().on(table.classId)],
);

/**
 * Class and subclass features share a table — they have identical shape and
 * the builder walks them as one level-ordered list.
 */
export const classFeatures = pgTable(
  "class_features",
  {
    entityId: entityRef(),
    classId: requiredRef(),
    /** Null for base class features. */
    subclassId: optionalRef(),
    level: integer().notNull(),
    /** Feature grants an ability score improvement / feat choice. */
    isAbilityScoreImprovement: boolean().notNull().default(false),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    index().on(table.classId, table.level),
    index().on(table.subclassId, table.level),
  ],
);

export const races = pgTable(
  "races",
  {
    entityId: entityRef(),
    /** Null for base races; set for subraces. */
    parentRaceId: optionalRef(),
    size: text().array(),
    speedWalk: integer(),
    speedFly: integer(),
    speedSwim: integer(),
    /** Flattened `{str: 2, dex: 1}` into filterable pairs. */
    abilityBonuses: jsonb().$type<Record<string, number>>(),
    /** Race grants a free ability-score choice (Tasha's-style). */
    hasAbilityChoice: boolean().notNull().default(false),
    traitTags: text().array(),
    languageProficiencies: text().array(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (table) => [index().on(table.parentRaceId)],
);

export const backgrounds = pgTable("backgrounds", {
  entityId: entityRef(),
  skillProficiencies: text().array(),
  toolProficiencies: text().array(),
  languageCount: integer(),
  /** "Feature: Shelter of the Faithful" — the background's granted feature. */
  featureName: text(),
  data: jsonb().$type<Record<string, unknown>>().notNull(),
});

export const feats = pgTable("feats", {
  entityId: entityRef(),
  /** Ability minimums, race gates, spellcasting gates. */
  prerequisites: jsonb().$type<unknown[]>(),
  /** Feat includes an ability score increase. */
  grantsAbilityScoreIncrease: boolean().notNull().default(false),
  abilityIncreaseOptions: text().array(),
  data: jsonb().$type<Record<string, unknown>>().notNull(),
});

/**
 * Invocations, fighting styles, metamagic, maneuvers, artificer infusions,
 * pact boons — anything the corpus models as a class-granted option list.
 */
export const optionalFeatures = pgTable(
  "optional_features",
  {
    entityId: entityRef(),
    /** "EI" eldritch invocation, "FS:F" fighting style (fighter), "MM"... */
    featureTypes: text().array(),
    prerequisites: jsonb().$type<unknown[]>(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (table) => [index().using("gin", table.featureTypes)],
);

/**
 * The long tail — deities, conditions, languages, actions, variant rules,
 * traps, vehicles, objects, rewards, psionics, tables and friends.
 *
 * These are browsed and cross-referenced but never filtered on type-specific
 * facets, so a shared table beats twenty near-empty ones. Promote a type out
 * of here the moment it needs real filtering.
 */
export const genericEntities = pgTable("generic_entities", {
  entityId: entityRef(),
  data: jsonb().$type<Record<string, unknown>>().notNull(),
});

/* Every detail table joins back to the registry on its entity id. */

export const spellsRelations = relations(spells, ({ one }) => ({
  entity: one(entities, { fields: [spells.entityId], references: [entities.id] }),
}));

export const monstersRelations = relations(monsters, ({ one }) => ({
  entity: one(entities, {
    fields: [monsters.entityId],
    references: [entities.id],
  }),
  legendaryGroup: one(entities, {
    fields: [monsters.legendaryGroupId],
    references: [entities.id],
    relationName: "legendaryGroup",
  }),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  entity: one(entities, { fields: [items.entityId], references: [entities.id] }),
  baseItem: one(items, {
    fields: [items.baseItemId],
    references: [items.entityId],
    relationName: "baseItem",
  }),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  entity: one(entities, {
    fields: [classes.entityId],
    references: [entities.id],
  }),
  subclasses: many(subclasses),
  features: many(classFeatures),
}));

export const subclassesRelations = relations(subclasses, ({ one, many }) => ({
  entity: one(entities, {
    fields: [subclasses.entityId],
    references: [entities.id],
  }),
  class: one(classes, {
    fields: [subclasses.classId],
    references: [classes.entityId],
  }),
  features: many(classFeatures),
}));

export const classFeaturesRelations = relations(classFeatures, ({ one }) => ({
  entity: one(entities, {
    fields: [classFeatures.entityId],
    references: [entities.id],
  }),
  class: one(classes, {
    fields: [classFeatures.classId],
    references: [classes.entityId],
  }),
  subclass: one(subclasses, {
    fields: [classFeatures.subclassId],
    references: [subclasses.entityId],
  }),
}));

export const racesRelations = relations(races, ({ one, many }) => ({
  entity: one(entities, { fields: [races.entityId], references: [entities.id] }),
  parentRace: one(races, {
    fields: [races.parentRaceId],
    references: [races.entityId],
    relationName: "subraces",
  }),
  subraces: many(races, { relationName: "subraces" }),
}));

export const backgroundsRelations = relations(backgrounds, ({ one }) => ({
  entity: one(entities, {
    fields: [backgrounds.entityId],
    references: [entities.id],
  }),
}));

export const featsRelations = relations(feats, ({ one }) => ({
  entity: one(entities, { fields: [feats.entityId], references: [entities.id] }),
}));

export const optionalFeaturesRelations = relations(
  optionalFeatures,
  ({ one }) => ({
    entity: one(entities, {
      fields: [optionalFeatures.entityId],
      references: [entities.id],
    }),
  }),
);

export const genericEntitiesRelations = relations(
  genericEntities,
  ({ one }) => ({
    entity: one(entities, {
      fields: [genericEntities.entityId],
      references: [entities.id],
    }),
  }),
);

export type Spell = typeof spells.$inferSelect;
export type Monster = typeof monsters.$inferSelect;
export type Item = typeof items.$inferSelect;