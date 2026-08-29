import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";

/**
 * The words at the top of a compendium page.
 *
 * A page header is a title and one sentence under it, and the sentence is the
 * only place the product speaks in its own voice rather than the books'. It is
 * also the easiest thing in the app to change by accident, because it is a bare
 * string in the middle of a layout — so the copy audit's decisions are pinned
 * here rather than left to a reviewer noticing.
 *
 * Held as a table because the point is the set: every revised line in one
 * place, next to the title it sits under. Lines the audit chose to keep are
 * here too, and are the more valuable half — a line nobody decided to change is
 * exactly the one a later edit will quietly reword.
 *
 * Rendered with empty lists on purpose. This asserts what the page says, not
 * what it found, and an empty list is the fastest way to reach the header.
 */

vi.mock("@/server/db/queries/generic", () => ({ listGeneric: vi.fn(async () => []) }));
vi.mock("@/server/db/queries/races", () => ({ listRacesBySource: vi.fn(async () => []) }));
vi.mock("@/server/db/queries/classes", () => ({ listSidekicks: vi.fn(async () => []) }));
vi.mock("@/server/db/queries/skills", () => ({ listSkills: vi.fn(async () => []) }));

const HEADERS = [
  {
    route: "/compendium",
    title: "Compendium",
    line: "Browse rules, creatures, equipment and character options.",
    load: () => import("./page"),
  },
  {
    route: "/compendium/actions",
    title: "Actions",
    line: "What you can do on your turn, and what it costs.",
    load: () => import("./actions/page"),
  },
  {
    route: "/compendium/races",
    title: "Races",
    line: "The traits, movement and abilities your character starts with.",
    load: () => import("./races/page"),
  },
  {
    route: "/compendium/sidekicks",
    title: "Sidekicks",
    line: "Companions that join a small party and level up alongside it.",
    load: () => import("./sidekicks/page"),
  },
  {
    route: "/compendium/skills",
    title: "Skills",
    line: "What each skill covers, and the ability behind it.",
    load: () => import("./skills/page"),
  },
  /*
   * Kept by the audit, not revised. Variant Rules especially: it is the
   * clearest statement of the product's position that a table chooses its own
   * rules, and the audit asked for it to be preserved exactly.
   */
  {
    route: "/compendium/variant-rules",
    title: "Variant Rules",
    line: "Rules a table can choose to adopt, replace or ignore.",
    load: () => import("./variant-rules/page"),
  },
  {
    route: "/compendium/conditions",
    title: "Conditions",
    line: "What being blinded, grappled or frightened actually does to you.",
    load: () => import("./conditions/page"),
  },
] as const;

describe("a compendium page header", () => {
  it.each(HEADERS)("says what $route is for", async ({ title, line, load }) => {
    const Page = (await load()).default;
    render(await Page({ searchParams: Promise.resolve({}) } as never));

    expect(screen.getByRole("heading", { name: title, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(line)).toBeInTheDocument();
  });

  /** One `h1`, or the page has two titles and a reader has none. */
  it.each(HEADERS)("gives $route exactly one title", async ({ load }) => {
    const Page = (await load()).default;
    render(await Page({ searchParams: Promise.resolve({}) } as never));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
