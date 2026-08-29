import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@/test/render";
import { ImageViewer } from "./image-viewer";

/**
 * The link a chapter's image is wrapped in, as `Zoomable` renders it. Planted
 * rather than imported: the viewer listens to the document and knows nothing
 * about the renderer, which is the whole point of the arrangement.
 */
function plantMap({ title = "Map 3.1: The North" } = {}) {
  const link = document.createElement("a");
  link.href = "/api/media/adventure/SKT/027-skt03-thenorth.webp";
  link.setAttribute("data-zoom", "");
  link.setAttribute("data-zoom-w", "3000");
  link.setAttribute("data-zoom-h", "1905");
  link.setAttribute("data-zoom-title", title);
  link.setAttribute("data-zoom-alt", title);
  link.append(document.createElement("img"));
  document.body.append(link);
  return link;
}

const dialog = () => document.querySelector("dialog");

/** The picture in the window, as distinct from the one on the page behind it. */
const shown = () => within(dialog() as HTMLElement).queryByRole("img");

/**
 * Report that the picture is being shown smaller than it is, which is what the
 * viewer measures to decide whether zooming would show anything more. jsdom
 * lays nothing out, so both numbers are zero until they are said out loud.
 */
function shrunkTo(width: number, natural = 3000) {
  const picture = shown() as HTMLImageElement;
  Object.defineProperty(picture, "naturalWidth", {
    value: natural,
    configurable: true,
  });
  Object.defineProperty(picture, "clientWidth", {
    value: width,
    configurable: true,
  });
  fireEvent.load(picture);
}

afterEach(() => {
  document.querySelectorAll("body > a").forEach((el) => el.remove());
  document.body.style.overflow = "";
});

describe("ImageViewer", () => {
  it("stays shut until something is opened", () => {
    render(<ImageViewer />);

    expect(dialog()?.open).toBe(false);
    expect(shown()).toBeNull();
  });

  it("opens the image a marked link points at", () => {
    render(<ImageViewer />);

    fireEvent.click(plantMap());

    expect(dialog()?.open).toBe(true);
    expect(shown()).toHaveAttribute(
      "src",
      "/api/media/adventure/SKT/027-skt03-thenorth.webp",
    );
    expect(screen.getByText("Map 3.1: The North")).toBeInTheDocument();
  });

  /** Otherwise the link navigates away from the chapter being read. */
  it("keeps the browser from following the link", () => {
    render(<ImageViewer />);

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    plantMap().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  /** The link is real, so opening it in a tab has to keep working. */
  it("leaves a modified click to the browser", () => {
    render(<ImageViewer />);

    fireEvent.click(plantMap(), { metaKey: true });

    expect(dialog()?.open).toBe(false);
  });

  it("ignores a link that is not an image", () => {
    render(<ImageViewer />);
    const other = document.createElement("a");
    other.href = "/compendium/monsters/mm/tarrasque";
    document.body.append(other);

    fireEvent.click(other);

    expect(dialog()?.open).toBe(false);
    other.remove();
  });

  /**
   * Filling the screen is still not full size — a 3000px map fitted to a laptop
   * is half its own pixels, which is where the labels stop being legible.
   */
  it("zooms from fitted to the image's own pixels", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());
    shrunkTo(1310);

    fireEvent.click(screen.getByRole("button", { name: "Zoom to full size" }));

    expect(shown()).toHaveStyle({ width: "3000px" });
    expect(
      screen.getByRole("button", { name: "Fit to screen" }),
    ).toBeInTheDocument();
  });

  it("opens fitted again the next time, whatever was left set", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());
    shrunkTo(1310);
    fireEvent.click(screen.getByRole("button", { name: "Zoom to full size" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(plantMap({ title: "Map 3.2: Beorunna's Well" }));
    shrunkTo(1310);

    expect(
      screen.getByRole("button", { name: "Zoom to full size" }),
    ).toBeInTheDocument();
  });

  it("closes on the close button", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(dialog()?.open).toBe(false);
  });

  /** Escape is the dialog's own, so state has to follow the element. */
  it("follows the element when the browser closes it", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());

    dialog()?.close();

    expect(shown()).toBeNull();
  });

  it("holds the page still while it is open, and lets go after", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(document.body.style.overflow).toBe("");
  });

  /** A great many images in the books carry no title at all. */
  it("names an untitled image by what it shows", () => {
    render(<ImageViewer />);
    const link = plantMap({ title: "" });
    link.setAttribute("data-zoom-alt", "The Savage Frontier");

    fireEvent.click(link);

    expect(screen.getByText("The Savage Frontier")).toBeInTheDocument();
  });

  /**
   * Most of the art in the books is smaller than the screen it is read on.
   * Offering to zoom it offers to shove it around its own frame to no purpose.
   */
  it("offers no zoom for a picture already shown whole", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());

    shrunkTo(1000, 1000);

    expect(
      screen.queryByRole("button", { name: "Zoom to full size" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  /**
   * A zoomed map is bigger than the window and has to be panned, and a region
   * that scrolls is only operable if something can focus it.
   */
  it("hands the keyboard the region it has to pan", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());
    shrunkTo(1310);

    fireEvent.click(screen.getByRole("button", { name: "Zoom to full size" }));

    const region = shown()?.parentElement as HTMLElement;
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveAccessibleName(/Map 3\.1: The North, zoomed/);
    expect(document.activeElement).toBe(region);
  });

  /** The region it belonged to no longer exists to hold it. */
  it("gives focus back to the control on the way out of zoom", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());
    shrunkTo(1310);
    fireEvent.click(screen.getByRole("button", { name: "Zoom to full size" }));

    fireEvent.click(screen.getByRole("button", { name: "Fit to screen" }));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Zoom to full size" }),
    );
  });

  it("leaves the fitted picture out of the tab order", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());
    shrunkTo(1310);

    expect(shown()?.parentElement).not.toHaveAttribute("tabindex");
  });

  it("paints the copy the page already has while the full one loads", () => {
    render(<ImageViewer />);
    const link = plantMap();
    const onPage = link.querySelector("img") as HTMLImageElement;
    Object.defineProperty(onPage, "currentSrc", {
      value: "/_next/image?url=map&w=640",
      configurable: true,
    });

    fireEvent.click(link);

    // On the picture's own box, not the room around it: `contain` against the
    // window turns a picture smaller than the window into a second, blurred
    // one behind the first.
    expect(shown()).toHaveStyle({
      backgroundImage: "url(/_next/image?url=map&w=640)",
    });
  });
});

/** jsdom implements `<dialog>`; this is the one thing worth confirming. */
it("uses a modal dialog rather than a div pretending to be one", () => {
  vi.spyOn(HTMLDialogElement.prototype, "showModal");
  render(<ImageViewer />);

  fireEvent.click(plantMap());

  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
});

describe("dismissing", () => {
  /**
   * The layout fills the dialog, so nothing ever lands on the element itself —
   * which is what an earlier version compared against, and why clicking beside
   * the picture did nothing at all.
   */
  it("closes on a click in the room around the picture", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());
    const surround = shown()?.parentElement as HTMLElement;

    fireEvent.click(surround);

    expect(dialog()?.open).toBe(false);
  });

  it("stays open when the picture itself is clicked", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());

    fireEvent.click(shown() as HTMLElement);

    expect(dialog()?.open).toBe(true);
  });

  it("stays open when a control is clicked", () => {
    render(<ImageViewer />);
    fireEvent.click(plantMap());
    shrunkTo(1310);

    fireEvent.click(screen.getByRole("button", { name: "Zoom to full size" }));

    expect(dialog()?.open).toBe(true);
  });
});
