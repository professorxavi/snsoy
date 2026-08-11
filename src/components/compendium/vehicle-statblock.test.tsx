import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { VehicleStatblock } from "./vehicle-statblock";

/**
 * The stat block a vehicle is, since 33 of the 35 are nothing else.
 *
 * `generic-aside.smoke.test.tsx` sweeps all 35 through this for coverage — it
 * answers whether anything failed to render, not whether the right things did.
 * These are the rules the sweep cannot see.
 */

const ctx = { refs: {}, selfKey: "vehicle|test|xxx", context: "Test" };

describe("VehicleStatblock", () => {
  /** Nightspider, trimmed. A spelljammer has no size and no ability scores. */
  it("prints only the lines the vehicle has", () => {
    render(
      <VehicleStatblock
        data={{
          vehicleType: "SPELLJAMMER",
          pace: { fly: "4½" },
          speed: { fly: 40 },
          capCrew: 25,
          capCargo: 50,
          cost: 5000000,
        }}
        {...ctx}
      />,
    );

    expect(screen.getByText("Travel Pace")).toBeInTheDocument();
    expect(screen.getByText("fly 4½ mph")).toBeInTheDocument();
    expect(screen.getByText("25 crew")).toBeInTheDocument();
    expect(screen.getByText("50 tons")).toBeInTheDocument();
    expect(screen.getByText("50,000 gp")).toBeInTheDocument();

    // Not a column of em dashes for what a rowboat does not have.
    expect(screen.queryByText("Armor Class")).toBeNull();
    expect(screen.queryByText("Weight")).toBeNull();
  });

  /**
   * A ship is hit in pieces, and each piece has its own armour class and hit
   * points. Losing the helm is a different problem from losing the sails, so
   * each is its own block rather than a row in a table nine columns wide.
   */
  it("gives each component its own numbers and its own prose", () => {
    render(
      <VehicleStatblock
        data={{
          vehicleType: "SPELLJAMMER",
          hull: { ac: 19, hp: 300, dt: 15 },
          weapon: [
            {
              name: "Ballistae",
              count: 4,
              ac: 15,
              hp: 50,
              crew: 3,
              costs: [{ cost: 500000, note: "ballista" }],
              entries: ["It takes 1 action to load a ballista."],
              action: [
                { name: "Bolt", entries: ["{@atk rw} {@hit 6} to hit."] },
              ],
            },
          ],
        }}
        {...ctx}
      />,
    );

    expect(screen.getByText("Hull")).toBeInTheDocument();
    expect(
      screen.getByText("AC 19, HP 300 (damage threshold 15)"),
    ).toBeInTheDocument();

    // The count belongs to the name — four ballistae, not one described twice.
    expect(screen.getByText("Ballistae (4).")).toBeInTheDocument();
    expect(
      screen.getByText("AC 15, HP 50, 3 crew, 5,000 gp (ballista)"),
    ).toBeInTheDocument();
    expect(screen.getByText(/It takes 1 action/)).toBeInTheDocument();

    // A weapon's own action goes through the renderer, so its attack line is
    // set the way a creature's is rather than printed as tag text.
    expect(screen.getByText(/Ranged Weapon Attack:/)).toBeInTheDocument();
  });

  /** A crew note may name the creature that makes up the crew. */
  it("resolves a reference inside a stat line", () => {
    render(
      <VehicleStatblock
        data={{
          vehicleType: "SPELLJAMMER",
          capCrew: 5,
          capCrewNote: "(plus the {@creature treant})",
        }}
        refs={{
          "monster|treant|mm": {
            name: "treant",
            entityType: "monster",
            href: "/compendium/monsters/mm/treant",
          },
        }}
        selfKey={ctx.selfKey}
        context={ctx.context}
      />,
    );

    expect(screen.getByRole("link", { name: "treant" })).toHaveAttribute(
      "href",
      "/compendium/monsters/mm/treant",
    );
  });

  /** A trait is `{name, entries}` with no type, which the renderer must be told. */
  it("sets a trait as a run-in item rather than reporting it as unknown", () => {
    render(
      <VehicleStatblock
        data={{
          vehicleType: "INFWAR",
          trait: [
            {
              name: "Crushing Wheels",
              entries: ["It can move through the space of a creature."],
            },
          ],
        }}
        {...ctx}
      />,
    );

    expect(screen.getByText(/Crushing Wheels/)).toBeInTheDocument();
    expect(
      screen.getByText(/move through the space of a creature/),
    ).toBeInTheDocument();
  });
});
