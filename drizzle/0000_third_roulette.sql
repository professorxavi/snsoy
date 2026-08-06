CREATE TYPE "public"."entity_type" AS ENUM('spell', 'monster', 'item', 'baseitem', 'itemGroup', 'magicvariant', 'race', 'subrace', 'background', 'feat', 'class', 'subclass', 'classFeature', 'subclassFeature', 'optionalfeature', 'bookSection', 'action', 'boon', 'card', 'charoption', 'condition', 'cult', 'deck', 'deity', 'disease', 'hazard', 'language', 'object', 'psionic', 'raceFeature', 'recipe', 'reward', 'sense', 'skill', 'status', 'table', 'trap', 'variantrule', 'vehicle', 'vehicleUpgrade');--> statement-breakpoint
CREATE TYPE "public"."granted_via" AS ENUM('provider', 'manual');--> statement-breakpoint
CREATE TYPE "public"."support_kind" AS ENUM('itemProperty', 'itemType', 'itemEntry', 'itemTypeAdditionalEntries', 'legendaryGroup', 'monsterTemplate', 'magicVariant');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "sources" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"group" varchar(32),
	"published" varchar(10),
	"author" text,
	"cover_path" text,
	"is_adventure" boolean DEFAULT false NOT NULL,
	"contents" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"natural_key" text NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"name" text NOT NULL,
	"srd_name" text,
	"source_id" varchar(32) NOT NULL,
	"page" integer,
	"slug" text NOT NULL,
	"is_srd" boolean DEFAULT false NOT NULL,
	"is_basic_rules" boolean DEFAULT false NOT NULL,
	"fluff" jsonb
);
--> statement-breakpoint
CREATE TABLE "entity_links" (
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"tag_type" varchar(32) NOT NULL,
	CONSTRAINT "entity_links_from_id_to_id_tag_type_pk" PRIMARY KEY("from_id","to_id","tag_type")
);
--> statement-breakpoint
CREATE TABLE "search_index" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"source_id" varchar(32) NOT NULL,
	"is_srd" boolean DEFAULT false NOT NULL,
	"body" text,
	"tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(name, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')) STORED
);
--> statement-breakpoint
CREATE TABLE "backgrounds" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"skill_proficiencies" text[],
	"tool_proficiencies" text[],
	"language_count" integer,
	"feature_name" text,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_features" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"class_id" uuid NOT NULL,
	"subclass_id" uuid,
	"level" integer NOT NULL,
	"is_ability_score_improvement" boolean DEFAULT false NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"hit_die" integer,
	"caster_progression" varchar(16),
	"spellcasting_ability" varchar(8),
	"prepares_spells" boolean DEFAULT false NOT NULL,
	"saving_throw_proficiencies" text[],
	"subclass_title" text,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feats" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"prerequisites" jsonb,
	"grants_ability_score_increase" boolean DEFAULT false NOT NULL,
	"ability_increase_options" text[],
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generic_entities" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"rarity" varchar(24),
	"item_type" varchar(16),
	"item_type_name" text,
	"requires_attunement" boolean DEFAULT false NOT NULL,
	"attunement_note" text,
	"value_cp" integer,
	"weight_lb" real,
	"is_magic" boolean DEFAULT false NOT NULL,
	"is_wondrous" boolean DEFAULT false NOT NULL,
	"is_generated_variant" boolean DEFAULT false NOT NULL,
	"base_item_id" uuid,
	"properties" text[],
	"weapon_category" varchar(24),
	"armor_class" integer,
	"strength_requirement" integer,
	"has_stealth_penalty" boolean DEFAULT false NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monsters" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"cr" numeric(6, 3),
	"cr_display" varchar(16),
	"sizes" text[],
	"creature_type" varchar(32),
	"creature_subtypes" text[],
	"alignment" text[],
	"armor_class" integer,
	"hit_points_average" integer,
	"speed_walk" integer,
	"speed_fly" integer,
	"speed_swim" integer,
	"speed_climb" integer,
	"speed_burrow" integer,
	"environments" text[],
	"is_legendary" boolean DEFAULT false NOT NULL,
	"is_spellcaster" boolean DEFAULT false NOT NULL,
	"tags" text[],
	"damage_tags" text[],
	"legendary_group_id" uuid,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "optional_features" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"feature_types" text[],
	"prerequisites" jsonb,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "races" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"parent_race_id" uuid,
	"size" text[],
	"speed_walk" integer,
	"speed_fly" integer,
	"speed_swim" integer,
	"ability_bonuses" jsonb,
	"has_ability_choice" boolean DEFAULT false NOT NULL,
	"trait_tags" text[],
	"language_proficiencies" text[],
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spells" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"level" integer NOT NULL,
	"school" varchar(1) NOT NULL,
	"casting_time_unit" varchar(16) NOT NULL,
	"casting_time_number" integer,
	"is_ritual" boolean DEFAULT false NOT NULL,
	"is_concentration" boolean DEFAULT false NOT NULL,
	"range_type" varchar(24),
	"range_feet" integer,
	"has_verbal" boolean DEFAULT false NOT NULL,
	"has_somatic" boolean DEFAULT false NOT NULL,
	"has_material" boolean DEFAULT false NOT NULL,
	"material_cost_gp" real,
	"is_material_consumed" boolean DEFAULT false NOT NULL,
	"damage_types" text[],
	"saving_throws" text[],
	"conditions_inflicted" text[],
	"classes" text[],
	"subclasses" text[],
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subclasses" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"class_id" uuid NOT NULL,
	"short_name" text,
	"caster_progression" varchar(16),
	"spellcasting_ability" varchar(8),
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_sections" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"book_id" varchar(32) NOT NULL,
	"ordinal" integer NOT NULL,
	"ordinal_type" varchar(16),
	"ordinal_label" varchar(8),
	"headers" text[],
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_data" (
	"kind" "support_kind" NOT NULL,
	"key" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "support_data_kind_key_pk" PRIMARY KEY("kind","key")
);
--> statement-breakpoint
CREATE TABLE "entitlement_syncs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" "sync_status" DEFAULT 'pending' NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error" text,
	"raw_response" jsonb,
	"resolved_source_ids" text[],
	"unmapped_provider_ids" text[]
);
--> statement-breakpoint
CREATE TABLE "provider_source_map" (
	"provider_source_id" varchar(32) PRIMARY KEY NOT NULL,
	"provider_name" text,
	"source_id" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_entitlements" (
	"user_id" integer NOT NULL,
	"source_id" varchar(32) NOT NULL,
	"granted_via" "granted_via" NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_entitlements_user_id_source_id_pk" PRIMARY KEY("user_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_from_id_entities_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_to_id_entities_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_index" ADD CONSTRAINT "search_index_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backgrounds" ADD CONSTRAINT "backgrounds_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_features" ADD CONSTRAINT "class_features_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_features" ADD CONSTRAINT "class_features_class_id_entities_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_features" ADD CONSTRAINT "class_features_subclass_id_entities_id_fk" FOREIGN KEY ("subclass_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feats" ADD CONSTRAINT "feats_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generic_entities" ADD CONSTRAINT "generic_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_base_item_id_entities_id_fk" FOREIGN KEY ("base_item_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_legendary_group_id_entities_id_fk" FOREIGN KEY ("legendary_group_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optional_features" ADD CONSTRAINT "optional_features_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_parent_race_id_entities_id_fk" FOREIGN KEY ("parent_race_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spells" ADD CONSTRAINT "spells_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subclasses" ADD CONSTRAINT "subclasses_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subclasses" ADD CONSTRAINT "subclasses_class_id_entities_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_sections" ADD CONSTRAINT "book_sections_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_syncs" ADD CONSTRAINT "entitlement_syncs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_source_map" ADD CONSTRAINT "provider_source_map_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sources_is_adventure_index" ON "sources" USING btree ("is_adventure");--> statement-breakpoint
CREATE INDEX "sources_group_index" ON "sources" USING btree ("group");--> statement-breakpoint
CREATE UNIQUE INDEX "entities_natural_key_index" ON "entities" USING btree ("natural_key");--> statement-breakpoint
CREATE UNIQUE INDEX "entities_entity_type_source_id_slug_index" ON "entities" USING btree ("entity_type","source_id","slug");--> statement-breakpoint
CREATE INDEX "entities_entity_type_index" ON "entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "entities_source_id_index" ON "entities" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "entities_entity_type_name_index" ON "entities" USING btree ("entity_type","name") WHERE "entities"."is_srd";--> statement-breakpoint
CREATE INDEX "entity_links_to_id_index" ON "entity_links" USING btree ("to_id");--> statement-breakpoint
CREATE INDEX "search_index_tsv_index" ON "search_index" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "search_index_name_trgm_idx" ON "search_index" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "search_index_entity_type_source_id_index" ON "search_index" USING btree ("entity_type","source_id");--> statement-breakpoint
CREATE INDEX "class_features_class_id_level_index" ON "class_features" USING btree ("class_id","level");--> statement-breakpoint
CREATE INDEX "class_features_subclass_id_level_index" ON "class_features" USING btree ("subclass_id","level");--> statement-breakpoint
CREATE INDEX "items_rarity_index" ON "items" USING btree ("rarity");--> statement-breakpoint
CREATE INDEX "items_item_type_index" ON "items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "items_is_magic_index" ON "items" USING btree ("is_magic");--> statement-breakpoint
CREATE INDEX "items_requires_attunement_index" ON "items" USING btree ("requires_attunement");--> statement-breakpoint
CREATE INDEX "monsters_cr_index" ON "monsters" USING btree ("cr");--> statement-breakpoint
CREATE INDEX "monsters_creature_type_index" ON "monsters" USING btree ("creature_type");--> statement-breakpoint
CREATE INDEX "monsters_is_legendary_index" ON "monsters" USING btree ("is_legendary");--> statement-breakpoint
CREATE INDEX "monsters_environments_index" ON "monsters" USING gin ("environments");--> statement-breakpoint
CREATE INDEX "monsters_tags_index" ON "monsters" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "optional_features_feature_types_index" ON "optional_features" USING gin ("feature_types");--> statement-breakpoint
CREATE INDEX "races_parent_race_id_index" ON "races" USING btree ("parent_race_id");--> statement-breakpoint
CREATE INDEX "spells_level_index" ON "spells" USING btree ("level");--> statement-breakpoint
CREATE INDEX "spells_school_index" ON "spells" USING btree ("school");--> statement-breakpoint
CREATE INDEX "spells_is_concentration_index" ON "spells" USING btree ("is_concentration");--> statement-breakpoint
CREATE INDEX "spells_classes_index" ON "spells" USING gin ("classes");--> statement-breakpoint
CREATE INDEX "subclasses_class_id_index" ON "subclasses" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "support_data_kind_index" ON "support_data" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "entitlement_syncs_user_id_synced_at_index" ON "entitlement_syncs" USING btree ("user_id","synced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_source_map_provider_source_id_source_id_index" ON "provider_source_map" USING btree ("provider_source_id","source_id");--> statement-breakpoint
CREATE INDEX "user_entitlements_user_id_index" ON "user_entitlements" USING btree ("user_id");