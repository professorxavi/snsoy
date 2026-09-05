import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import Error from "./error";

/**
 * The 500 page's two obligations: give the reader something to quote, and give
 * away nothing else.
 */
describe("the page a failed render lands on", () => {
  const failure = () =>
    Object.assign(new globalThis.Error("connect ECONNREFUSED 127.0.0.1:5433"), {
      digest: "1a2b3c4d",
    });

  it("shows the digest, which is what ties a report to a server log", () => {
    render(<Error error={failure()} reset={() => {}} />);

    expect(screen.getByText(/1a2b3c4d/)).toBeInTheDocument();
  });

  /**
   * The message is a server stack talking to a stranger. Next already replaces
   * it in production builds; this asserts the page does not put it back.
   */
  it("never shows the error's own message", () => {
    render(<Error error={failure()} reset={() => {}} />);

    expect(screen.queryByText(/ECONNREFUSED/)).toBeNull();
    expect(screen.queryByText(/5433/)).toBeNull();
  });

  it("retries through the boundary's own reset", async () => {
    const reset = vi.fn();
    render(<Error error={failure()} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(reset).toHaveBeenCalledOnce();
  });

  /** A digest is optional — a client-side throw has none, and that is not a gap. */
  it("omits the reference line when there is no digest", () => {
    render(<Error error={new globalThis.Error("boom")} reset={() => {}} />);

    expect(screen.queryByText(/reference/i)).toBeNull();
  });

  it("still offers a way back into the books", () => {
    render(<Error error={failure()} reset={() => {}} />);

    expect(screen.getByRole("link", { name: "Compendium" })).toHaveAttribute(
      "href",
      "/compendium",
    );
    expect(screen.getByRole("link", { name: "Books" })).toHaveAttribute(
      "href",
      "/sources",
    );
  });
});
