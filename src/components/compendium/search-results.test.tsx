import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { MATCH_END, MATCH_START } from "@/lib/content/search";
import type { SearchResult } from "@/server/db/queries/search";
import { render, screen, within } from "@/test/render";
import { AsideProvider } from "./aside-context";
import { SearchResults } from "./search-results";

/**
 * The results list.
 *
 * What is worth asserting here is how a row behaves when the entity behind it
 * is awkward, because search is the one view where every awkward case in the
 * corpus arrives in the same list. Three of them decide whether a row is usable
 * at all: a fragment whose name means nothing without its parent, a type with
 * no renderer that must navigate rather than open, and a type with no page at
 * all that must not pretend to be a link.
 *
 * The ranking itself is not testable here and is not tested here — it is a
 * claim about 12,851 real rows, and it lives in `search.smoke.test.ts`.
 */

/**
 * Stands in for `openEntityAside`. The real one is a server function whose
 * module opens a database connection at import time — which is why the list
 * takes it as a prop rather than importing it.
 */
const open = () => vi.fn(async () => null);

const renderList = (ui: ReactElement) =>
  render(<AsideProvider>{ui}</AsideProvider>);

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Fireball",
    entityType: "spell",
    sourceId: "PHB",
    slug: "fireball",
    tier: 3,
    snippet: null,
    href: "/compendium/spells/phb/fireball",
    parentName: null,
    ...overrides,
  };
}

describe("SearchResults", () => {
  it("prints a result with its kind and source", () => {
    renderList(
      <SearchResults rows={[result()]} query="fireball" open={open()} />,
    );

    const row = within(screen.getByRole("listitem"));
    expect(row.getByRole("link", { name: "Fireball" })).toHaveAttribute(
      "href",
      "/compendium/spells/phb/fireball",
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("Spell");
    expect(screen.getByRole("listitem")).toHaveTextContent("PHB");
  });

  /** The corpus's word is `monster`; the rules' word — and the badge — is Creature. */
  it("badges a type in the player's vocabulary", () => {
    renderList(
      <SearchResults
        rows={[result({ entityType: "monster", name: "Beholder" })]}
        query="beholder"
        open={open()}
      />,
    );

    expect(screen.getByRole("listitem")).toHaveTextContent("Creature");
  });

  /**
   * A fragment's name is meaningless alone — 847 subclass features and 69
   * subraces are called things like "Extra Attack" and "Fire". Without the
   * parent the top result for "sneak attack" is a bare word.
   */
  it("qualifies a fragment with its parent", () => {
    renderList(
      <SearchResults
        rows={[
          result({
            name: "Sneak Attack",
            entityType: "classFeature",
            parentName: "Rogue",
            href: "/compendium/classes/phb/rogue#sneak-attack",
          }),
        ]}
        query="sneak attack"
        open={open()}
      />,
    );

    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Sneak Attack — Rogue",
    );
  });

  describe("how a name behaves", () => {
    /** A type the aside renders opens in place, and says so to the aside. */
    it("opens a renderable type in the aside", () => {
      renderList(
        <SearchResults rows={[result()]} query="fireball" open={open()} />,
      );

      expect(screen.getByRole("link", { name: "Fireball" })).toHaveAttribute(
        "data-aside-open",
      );
    });

    /**
     * A chapter has a page but no aside renderer, so it must navigate. The
     * marker attribute is what the progress bar reads to tell the two apart.
     */
    it("navigates for a type the aside cannot render", () => {
      renderList(
        <SearchResults
          rows={[
            result({
              name: "Combat",
              entityType: "bookSection",
              href: "/sources/phb/combat",
            }),
          ]}
          query="combat"
          open={open()}
        />,
      );

      const link = screen.getByRole("link", { name: "Combat" });
      expect(link).toHaveAttribute("href", "/sources/phb/combat");
      expect(link).not.toHaveAttribute("data-aside-open");
    });

    /**
     * Much of the corpus still has no page and no renderer. Those rows print as
     * text rather than as a link that would 404 — the same rule the reader's
     * cross-references follow.
     */
    it("prints a result with nowhere to go as plain text", () => {
      renderList(
        <SearchResults
          rows={[
            result({ name: "Bahamut", entityType: "deity", href: null }),
          ]}
          query="bahamut"
          open={open()}
        />,
      );

      expect(screen.getByRole("listitem")).toHaveTextContent("Bahamut");
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  describe("snippets", () => {
    it("marks the words the query matched", () => {
      renderList(
        <SearchResults
          rows={[
            result({
              tier: 0,
              snippet: `you can make an ${MATCH_START}opportunity${MATCH_END} ${MATCH_START}attack${MATCH_END} when`,
            }),
          ]}
          query="opportunity attack"
          open={open()}
        />,
      );

      const marks = screen
        .getByRole("listitem")
        .querySelectorAll("mark");

      expect([...marks].map((mark) => mark.textContent)).toEqual([
        "opportunity",
        "attack",
      ]);
    });

    /**
     * Whether a row has earned a second line is decided in the query — a name
     * match explains itself, and the indexed body opens with a metadata
     * preamble that would be all a headline ever showed for one. Here that
     * arrives simply as a null snippet.
     */
    it("prints one line when there is no snippet", () => {
      renderList(
        <SearchResults
          rows={[result({ tier: 3, snippet: null })]}
          query="fireball"
          open={open()}
        />,
      );

      expect(screen.getByRole("listitem").textContent).toBe("FireballSpellPHB");
    });

    /** Nothing the database returns is ever inserted as markup. */
    it("prints angle brackets from the corpus as text", () => {
      renderList(
        <SearchResults
          rows={[result({ tier: 1, snippet: "a <b>bold</b> claim" })]}
          query="bold"
          open={open()}
        />,
      );

      const row = screen.getByRole("listitem");
      expect(row).toHaveTextContent("a <b>bold</b> claim");
      expect(row.querySelector("b")).toBeNull();
    });
  });

  it("says what found nothing, rather than showing an empty list", () => {
    renderList(<SearchResults rows={[]} query="xyzzy" open={open()} />);

    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.getByText(/xyzzy/)).toBeInTheDocument();
  });
});
