import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { ListToolbar, Pager } from "./list-controls";

/**
 * The toolbar above a list and the pager below it.
 *
 * Both are pure URL state, so what is worth asserting is what happens at the
 * ends: page one, the last page, a single page, and a search that has to carry
 * the filters with it without carrying the page number.
 */

const BASE = "/compendium/spells";

describe("the list toolbar", () => {
  describe("the count", () => {
    /** An unfiltered total answers no question the reader asked. */
    it("stays hidden until something is narrowed", () => {
      render(
        <ListToolbar params={{}} matched={525} filtered={false} basePath={BASE} />,
      );

      expect(screen.queryByText(/525/)).not.toBeInTheDocument();
    });

    it("appears once a filter is applied", () => {
      render(
        <ListToolbar
          params={{ level: "0" }}
          matched={42}
          filtered
          basePath={BASE}
        />,
      );

      expect(screen.getByText("42 spells")).toBeInTheDocument();
    });

    it("says spell, not spells, when one matched", () => {
      render(
        <ListToolbar params={{ q: "x" }} matched={1} filtered basePath={BASE} />,
      );

      expect(screen.getByText("1 spell")).toBeInTheDocument();
    });

    it("reports zero rather than going quiet", () => {
      render(
        <ListToolbar params={{ q: "x" }} matched={0} filtered basePath={BASE} />,
      );

      expect(screen.getByText("0 spells")).toBeInTheDocument();
    });
  });

  describe("the search field", () => {
    /** A plain GET form, so searching works before hydration. */
    it("submits to the list route as a GET", () => {
      const { container } = render(
        <ListToolbar params={{}} matched={0} filtered={false} basePath={BASE} />,
      );
      const form = container.querySelector("form")!;

      expect(form).toHaveAttribute("action", BASE);
      expect(form).toHaveAttribute("method", "get");
    });

    it("keeps the current term in the box", () => {
      render(
        <ListToolbar
          params={{ q: "fire" }}
          matched={9}
          filtered
          basePath={BASE}
        />,
      );

      expect(screen.getByRole("searchbox", { name: /Search spells/i })).toHaveValue(
        "fire",
      );
    });

    const hidden = (container: HTMLElement) =>
      Object.fromEntries(
        [...container.querySelectorAll('input[type="hidden"]')].map((input) => [
          input.getAttribute("name"),
          input.getAttribute("value"),
        ]),
      );

    it("carries the filters and sort through a search", () => {
      const { container } = render(
        <ListToolbar
          params={{ level: "3", school: "V", sort: "level" }}
          matched={9}
          filtered
          basePath={BASE}
        />,
      );

      expect(hidden(container)).toEqual({
        level: "3",
        school: "V",
        sort: "level",
      });
    });

    /** The results change, so holding page 7 would land the reader nowhere. */
    it("drops the page number", () => {
      const { container } = render(
        <ListToolbar
          params={{ level: "3", page: "7" }}
          matched={9}
          filtered
          basePath={BASE}
        />,
      );

      expect(hidden(container)).not.toHaveProperty("page");
    });
  });
});

describe("the pager", () => {
  it("stays away entirely when everything fits on one page", () => {
    const { container } = render(
      <Pager params={{}} page={1} pageCount={1} basePath={BASE} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("says where the reader is", () => {
    render(<Pager params={{}} page={3} pageCount={11} basePath={BASE} />);

    expect(screen.getByText("Page 3 of 11")).toBeInTheDocument();
  });

  describe("on the first page", () => {
    it("offers next but not previous", () => {
      render(<Pager params={{}} page={1} pageCount={11} basePath={BASE} />);

      expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute(
        "href",
        `${BASE}?page=2`,
      );
      expect(screen.queryByRole("link", { name: /Previous/ })).toBeNull();
      expect(screen.getByText(/Previous/)).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });
  });

  describe("on the last page", () => {
    it("offers previous but not next", () => {
      render(<Pager params={{}} page={11} pageCount={11} basePath={BASE} />);

      expect(screen.getByRole("link", { name: /Previous/ })).toHaveAttribute(
        "href",
        `${BASE}?page=10`,
      );
      expect(screen.queryByRole("link", { name: /Next/ })).toBeNull();
      expect(screen.getByText(/Next/)).toHaveAttribute("aria-disabled", "true");
    });
  });

  it("keeps the filters on both links", () => {
    render(
      <Pager
        params={{ level: "3", sort: "level" }}
        page={2}
        pageCount={11}
        basePath={BASE}
      />,
    );

    expect(screen.getByRole("link", { name: /Previous/ })).toHaveAttribute(
      "href",
      `${BASE}?level=3&page=1&sort=level`,
    );
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute(
      "href",
      `${BASE}?level=3&page=3&sort=level`,
    );
  });

  it("is a labelled landmark, so it can be jumped to", () => {
    render(<Pager params={{}} page={1} pageCount={2} basePath={BASE} />);

    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toBeInTheDocument();
  });
});
