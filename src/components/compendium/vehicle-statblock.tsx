import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { AbilityTable } from "@/components/compendium/ability-table";
import { Entries, Inline, type Entry } from "@/components/entry";
import { formatItemValue, formatWeight } from "@/lib/content/items";
import {
  formatConditionImmunities,
  formatDefences,
  type Ability,
  type DefenceEntry,
} from "@/lib/content/monsters";
import type { ReferenceIndex } from "@/lib/content/references";
import {
  vehicleArmorClass,
  vehicleCargo,
  vehicleDimensions,
  vehicleHitPoints,
  vehiclePace,
  vehicleSpeed,
} from "@/lib/content/vehicles";

/**
 * A vehicle's stat block.
 *
 * 33 of the 35 vehicles carry no `entries` at all, so this is not a supplement
 * to an entry — it is the whole of what a vehicle is. What it prints is decided
 * entry by entry rather than by shape: a spelljammer states a pace and no size,
 * an infernal war machine states ability scores and two damage thresholds, and
 * a rowboat states a cargo capacity and nothing else.
 *
 * The components are the part that has no equivalent in the bestiary. A ship is
 * hit in pieces — helm, sails, ballistas — and each piece has its own armour
 * class and hit points, so each gets its own headed block rather than a line in
 * a table that would be nine columns wide and empty for most of them.
 */
export function VehicleStatblock({
  data,
  refs,
  selfKey,
  context,
}: {
  data: Record<string, unknown>;
  refs: ReferenceIndex;
  selfKey: string;
  context: string;
}) {
  const vehicle = data as VehicleData;
  const ctx = { refs, selfKey, context };

  /*
   * Only what the vehicle has. A rowboat carries a cargo capacity and a crew
   * and nothing else, and a column of em dashes would say nothing about it.
   */
  const stats = [
    { label: "Armor Class", text: vehicleArmorClass(vehicle.ac) },
    { label: "Hit Points", text: vehicleHitPoints(vehicle.hp) },
    { label: "Speed", text: vehicleSpeed(vehicle.speed) },
    { label: "Travel Pace", text: vehiclePace(vehicle.pace) },
    { label: "Dimensions", text: vehicleDimensions(vehicle.dimensions) },
    { label: "Creature Capacity", text: capacity(vehicle) },
    {
      label: "Cargo Capacity",
      text: vehicleCargo(vehicle.capCargo, vehicle.vehicleType),
    },
    { label: "Cost", text: money(vehicle.cost) },
    { label: "Weight", text: vehicle.weight == null ? "" : formatWeight(vehicle.weight) },
  ].filter((row) => row.text);

  const defences = [
    { label: "Damage Immunities", text: formatDefences(vehicle.immune, "immune") },
    { label: "Damage Resistances", text: formatDefences(vehicle.resist, "resist") },
    {
      label: "Condition Immunities",
      text: formatConditionImmunities(vehicle.conditionImmune),
    },
  ].filter((row) => row.text);

  return (
    <Stack gap="3">
      {stats.length ? (
        <Ruled>
          {stats.map((row) => (
            <StatLine key={row.label} label={row.label} value={row.text} ctx={ctx} />
          ))}
        </Ruled>
      ) : null}

      <AbilityTable data={vehicle} />

      {defences.length ? (
        <Ruled>
          {defences.map((row) => (
            <StatLine key={row.label} label={row.label} value={row.text} ctx={ctx} />
          ))}
        </Ruled>
      ) : null}

      {/* Traits are unheaded in print — they are simply what the vehicle is. */}
      <Block entries={vehicle.trait} ctx={ctx} />

      {/*
        The hull is one component rather than a list of them, but it is read the
        same way as the rest and is set the same way.
      */}
      <Components heading="Hull" parts={vehicle.hull ? [vehicle.hull] : undefined} ctx={ctx} />
      <Components heading="Control" parts={vehicle.control} ctx={ctx} />
      <Components heading="Movement" parts={vehicle.movement} ctx={ctx} />
      <Components heading="Weapons" parts={vehicle.weapon} ctx={ctx} />

      {/*
        `actionThresholds` is deliberately not printed. It restates in a map what
        every one of the eight ships carrying it already says in the first line
        of its actions — "it can take only 2 actions if it has fewer than forty
        crew" — and the sentence is the one a reader can act on.
      */}
      <Block heading="Actions" entries={vehicle.action} ctx={ctx} />
      <Block heading="Action Stations" entries={vehicle.actionStation} ctx={ctx} />
      <Block heading="Reactions" entries={vehicle.reaction} ctx={ctx} />
    </Stack>
  );
}

/** What the stat block reads off the vehicle's stored data. */
interface VehicleData extends Partial<Record<Ability, number>> {
  vehicleType?: string;
  ac?: unknown;
  hp?: unknown;
  speed?: unknown;
  pace?: unknown;
  dimensions?: unknown;
  capCrew?: number | string;
  capCrewNote?: string;
  capPassenger?: number | string;
  capCreature?: number | string;
  capCargo?: unknown;
  cost?: number;
  weight?: number;
  immune?: DefenceEntry[];
  resist?: DefenceEntry[];
  conditionImmune?: string[];
  trait?: Entry[];
  action?: Entry[];
  actionStation?: Entry[];
  reaction?: Entry[];
  hull?: Component;
  control?: Component[];
  movement?: Component[];
  weapon?: Component[];
}

/**
 * One part of a vehicle that can be attacked on its own.
 *
 * Every field is optional because the four shapes fill in different ones: a
 * movement component carries a speed per mode, a weapon carries a crew and a
 * price per shot, and a hull carries only its own numbers.
 */
interface Component {
  name?: string;
  count?: number;
  ac?: number;
  hp?: number;
  dt?: number;
  hpNote?: string;
  crew?: number;
  costs?: { cost?: number; note?: string }[];
  speed?: { mode?: string; entries?: Entry[] }[];
  entries?: Entry[];
  action?: Entry[];
}

interface RenderContext {
  refs: ReferenceIndex;
  selfKey: string;
  context: string;
}

/** "5,000 gp". Vehicle prices are stored in copper, exactly as an item's is. */
function money(cost: number | undefined): string {
  return cost == null ? "" : formatItemValue(cost);
}

/**
 * "25 crew, 60 passengers" — everything the vehicle can hold.
 *
 * Three separate fields, because the books count them separately: a ship
 * distinguishes the crew it needs from the passengers it can carry, while an
 * infernal war machine simply seats eight.
 */
function capacity(vehicle: VehicleData): string {
  const note = vehicle.capCrewNote ? ` ${vehicle.capCrewNote}` : "";

  return [
    vehicle.capCrew == null ? "" : `${vehicle.capCrew} crew${note}`,
    vehicle.capPassenger == null ? "" : `${vehicle.capPassenger} passengers`,
    vehicle.capCreature == null ? "" : `${vehicle.capCreature} creatures`,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * A group of stat lines between two rules, as print sets them. The rules are
 * what make a stat block scannable, so they are structural rather than
 * decorative.
 */
function Ruled({ children }: { children: ReactNode }) {
  return (
    <Stack
      gap="0.5"
      borderTopWidth="1px"
      borderBottomWidth="1px"
      borderColor="border"
      py="2"
    >
      {children}
    </Stack>
  );
}

/**
 * "**Creature Capacity** 25 crew (plus the treant)".
 *
 * Run-in rather than in a label column, and through `Inline` rather than as
 * plain text: a crew note may cite the creature that makes up the crew, and
 * that is a live cross-reference like any other.
 */
function StatLine({
  label,
  value,
  ctx,
}: {
  label: string;
  value: string;
  ctx: RenderContext;
}) {
  return (
    <Text fontFamily="body" fontSize="sm" lineHeight="1.55">
      <Text as="span" fontWeight="semibold">
        {label}
      </Text>{" "}
      <Inline text={value} refs={ctx.refs} selfKey={ctx.selfKey} context={ctx.context} />
    </Text>
  );
}

/**
 * The components of one kind, each with its own numbers and its own prose.
 *
 * A component's statistics are a run-in line under its name rather than a
 * heading of their own, because a ballista's armour class is only meaningful
 * beside the ballista.
 */
function Components({
  heading,
  parts,
  ctx,
}: {
  heading: string;
  parts?: Component[];
  ctx: RenderContext;
}) {
  if (!parts?.length) return null;

  return (
    <Box>
      <Heading>{heading}</Heading>

      <Stack gap="2">
        {parts.map((part, index) => (
          <Box key={part.name ?? index}>
            <Text fontFamily="body" fontSize="sm" lineHeight="1.55">
              {part.name ? (
                <Text as="span" fontWeight="semibold" fontStyle="italic">
                  {part.count && part.count > 1
                    ? `${part.name} (${part.count}). `
                    : `${part.name}. `}
                </Text>
              ) : null}
              {componentStats(part)}
            </Text>

            {part.speed?.map((speed, speedIndex) => (
              <Box key={speed.mode ?? speedIndex} pt="1">
                <Entries
                  entries={[{ type: "item", name: speed.mode, entries: speed.entries }]}
                  {...ctx}
                />
              </Box>
            ))}

            {part.entries?.length ? (
              <Box pt="1">
                <Entries entries={part.entries} {...ctx} />
              </Box>
            ) : null}

            {part.action?.length ? (
              <Box pt="1">
                <Entries entries={part.action.map(asItem)} {...ctx} />
              </Box>
            ) : null}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

/** "AC 15, HP 50, 3 crew, 5,000 gp (ballista), 500 gp (bolt)". */
function componentStats(part: Component): string {
  const hp = [
    part.hp == null ? "" : `HP ${part.hp}`,
    part.dt == null ? "" : `(damage threshold ${part.dt})`,
    part.hpNote ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const costs = (part.costs ?? [])
    .map((cost) => {
      const price = cost.cost == null ? "" : formatItemValue(cost.cost);
      if (!price) return "";
      return cost.note ? `${price} (${cost.note})` : price;
    })
    .filter(Boolean);

  return [
    part.ac == null ? "" : `AC ${part.ac}`,
    hp,
    part.crew == null ? "" : `${part.crew} crew`,
    ...costs,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * One headed group of things the vehicle can do. Renders nothing when it has
 * none, which is what keeps the caller free to list every group.
 */
function Block({
  heading,
  entries,
  ctx,
}: {
  heading?: string;
  entries?: Entry[];
  ctx: RenderContext;
}) {
  if (!entries?.length) return null;

  return (
    <Box>
      {heading ? <Heading>{heading}</Heading> : null}
      <Entries entries={entries.map(asItem)} {...ctx} />
    </Box>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <Text
      as="h2"
      fontFamily="display"
      fontSize="md"
      letterSpacing="tight"
      borderBottomWidth="1px"
      borderColor="border.emphasized"
      pb="0.5"
      mb="2"
    >
      {children}
    </Text>
  );
}

/**
 * A trait or an action station as the renderer's run-in `item`.
 *
 * `{name, entries}` with no `type` reaches the renderer as an unknown block and
 * reports a coverage gap, so the shape is stated here. Anything that already
 * declares a type is left alone — a vehicle's actions open with a bare
 * paragraph and a `list`, both of which the renderer already knows.
 */
function asItem(entry: Entry): Entry {
  if (typeof entry !== "object" || entry === null) return entry;
  if ("type" in entry && entry.type) return entry;

  const named = entry as { name?: string; entries?: Entry[] };
  return { type: "item", name: named.name, entries: named.entries };
}
