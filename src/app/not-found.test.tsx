import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import NotFound from "./not-found";

/**
 * The 404, and the one thing it does beyond apologising.
 *
 * The page is static; the hint is not, because the address is the only thing
 * that distinguishes a typo from a middle-clicked creature. So every test here
 * is really about `usePathname` reaching the signpost — `dead-end.test.ts` owns
 * whether the address is read correctly.
 */

let pathname = "/";

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

describe("the not-found page", () => {
  it("says so, and offers a way out", () => {
    pathname = "/nonsense";
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: /not all roads lead somewhere/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compendium" })).toHaveAttribute(
      "href",
      "/compendium",
    );
    expect(screen.getByRole("link", { name: "Books" })).toHaveAttribute(
      "href",
      "/sources",
    );
  });

  /**
   * The case worth building for: the address was fine, the entity is real, and
   * it has no page because nothing of its type does.
   */
  it("names the type and points at its list", () => {
    pathname = "/compendium/conditions/phb/prone";
    render(<NotFound />);

    expect(
      screen.getByText(/Conditions have no page of their own/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Browse Conditions/ }),
    ).toHaveAttribute("href", "/compendium/conditions");
  });

  /**
   * The mirror of the case above, and the reason this page was parked: four
   * types do have a page, so a 404 on one is a mistyped slug. Naming the type
   * there would tell a reader who fumbled a creature's name that creatures have
   * no page — which stopped being true when the monster page landed.
   */
  it("adds no signpost for a type that has a page", () => {
    pathname = "/compendium/monsters/mm/gobln";
    render(<NotFound />);

    expect(screen.queryByText(/have no page of their own/)).toBeNull();
    expect(screen.queryByRole("link", { name: /^Browse/ })).toBeNull();
  });

  it("falls back to the index for a type with no list", () => {
    pathname = "/compendium/cards/cos/abjurer";
    render(<NotFound />);

    expect(screen.getByText(/wherever the books cite them/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Browse the compendium/ }),
    ).toHaveAttribute("href", "/compendium");
  });

  /** A typo gets the plain page — a signpost pointing nowhere is worse than none. */
  it("adds no signpost for an address that named nothing", () => {
    pathname = "/compendium/goblins/mm/goblin";
    render(<NotFound />);

    expect(screen.queryByText(/have no page of their own/)).toBeNull();
    expect(screen.queryByRole("link", { name: /^Browse/ })).toBeNull();
  });
});
