"use client";

import { Box, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LuX, LuZoomIn, LuZoomOut } from "react-icons/lu";
import { ZOOM_ALT, ZOOM_ATTR, ZOOM_H, ZOOM_TITLE, ZOOM_W } from "./zoom";

/**
 * Printed art, at a size it can actually be read at.
 *
 * A chapter's images are laid into a 68ch measure and capped at 420px tall,
 * which is right for the reading but hopeless for a map: Storm King's Thunder
 * prints the North at 3000x1905 and the column shows it at a seventh of that,
 * with every place name too small to make out. The same is true of any plan
 * with room numbers on it, and of a few of the diagrams.
 *
 * Two steps rather than one, because filling the screen is still not full size.
 * The map opens fitted to the viewport — already several times what the column
 * gave it — and zooms from there to its own pixels, which is the point at which
 * the labels are legible and the reason this is not merely a bigger `<img>`.
 *
 * One of these for the whole document, in the frame. There is no state per
 * image and nothing to hydrate beside each one: a chapter can carry thirty, and
 * what they need is a shared window, not thirty of them.
 */

/** Marks the parts of the window a click must not dismiss it from. */
const KEEP_OPEN = "data-keep-open";

interface Opened {
  src: string;
  width: number;
  height: number;
  title: string;
  alt: string;
  preview?: string;
}

export function ImageViewer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const pan = useRef<HTMLDivElement>(null);
  const zoomButton = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [zoomed, setZoomed] = useState(false);

  /**
   * Whether this image has more to show than the window is already showing.
   *
   * Measured rather than assumed. Most of the art in the books is smaller than
   * the screen it is being read on, and offering to zoom it means offering to
   * shove it around its own frame to no purpose — the picture moves and nothing
   * gets bigger. Only the large maps have anything behind the fit.
   */
  const [zoomable, setZoomable] = useState(false);

  const close = useCallback(() => setOpened(null), []);

  const measure = useCallback(() => {
    const element = picture.current;
    // A pixel of slack: a fitted image lands on fractional widths.
    setZoomable(!!element && element.naturalWidth > element.clientWidth + 1);
  }, []);

  // While fitted, since the answer changes with the window. Not while zoomed,
  // where the image is at its own size and would measure itself out of the
  // control that gets it back.
  useEffect(() => {
    if (!opened || zoomed) return;

    // After the frame that lays it out, which is also what re-measures on the
    // way back from zoom — the element is the same one and neither `load` nor
    // the ref fires again.
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [opened, zoomed, measure]);

  /*
   * Delegated, and on `click` rather than on each image: keyboard activation of
   * the button arrives here as a click too, so this is the whole of the
   * interaction — pointer and keyboard both — in one listener.
   */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Anything but a plain left click belongs to the browser.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const trigger = (event.target as Element | null)?.closest?.(
        `[${ZOOM_ATTR}]`,
      );
      // The link's own target is the full-size file, so there is one source of
      // truth for what opens whether the script ran or not.
      const src = trigger?.getAttribute("href");
      if (!src) return;

      event.preventDefault();
      setZoomed(false);
      setOpened({
        src,
        width: Number(trigger?.getAttribute(ZOOM_W)) || 0,
        height: Number(trigger?.getAttribute(ZOOM_H)) || 0,
        title: trigger?.getAttribute(ZOOM_TITLE) ?? "",
        alt: trigger?.getAttribute(ZOOM_ALT) ?? "",
        // Whatever `next/image` actually settled on for the column, which is
        // downloaded and decoded already.
        preview: trigger?.querySelector("img")?.currentSrc || undefined,
      });
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  /*
   * `showModal` rather than an `open` attribute, which is what buys the focus
   * trap, the Escape key, the inert page behind and the top layer — none of
   * which this would be right to reimplement. The page's own scrolling is the
   * one thing it does not stop.
   */
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    if (opened && !element.open) element.showModal();
    if (!opened && element.open) element.close();

    document.body.style.overflow = opened ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [opened]);

  // Shown while zoomed too, since it is the way back to the fitted view.
  const canZoom = zoomable || zoomed;

  /*
   * Hand the keyboard whichever of the two is now the thing being used.
   *
   * A zoomed map is bigger than the window and has to be panned; the region
   * holding it scrolls, and a scrolling region is only operable if something
   * can focus it — the same rule, and the same `tabindex`/`role`/`aria-label`,
   * that `TableScrollers` applies to a table too wide for its column. Focusing
   * it here means the arrow keys work on arrival rather than after a Tab.
   *
   * Coming back out, focus returns to the control that was pressed, which no
   * longer belongs to a region that exists.
   */
  useEffect(() => {
    if (!opened) return;
    (zoomed ? pan.current : zoomButton.current)?.focus();
  }, [opened, zoomed]);

  return (
    <Box
      asChild
      p="0"
      m="0"
      w="100vw"
      maxW="100vw"
      h="100dvh"
      maxH="100dvh"
      bg="transparent"
      borderWidth="0"
      css={{
        /*
         * Translucent, so the chapter is plainly still there underneath and
         * this reads as a window over the page rather than a page of its own.
         *
         * Blurred with it, which is what makes that affordable: a good deal of
         * the art has a real alpha channel — the plates fade to nothing at
         * their edges — and against a merely dimmed page you end up reading
         * paragraphs through the picture. Out of focus, what shows through is
         * the shape and colour of what you were reading and none of its words.
         */
        "&::backdrop": {
          background: "rgba(8, 9, 12, 0.82)",
          backdropFilter: "blur(8px)",
        },
        // The dialog is the backdrop's own click target, so it has to fill the
        // screen for a click beside the picture to land on something.
        "&:not([open])": { display: "none" },
      }}
    >
      <dialog
        ref={dialog}
        aria-label={opened?.title || opened?.alt || "Image"}
        // Escape and the close button both arrive here, so state follows the
        // element rather than the other way round.
        onClose={close}
        onClick={(event) => {
          // Anywhere but the picture and the controls, which is the backdrop
          // and the room around the image — the two places a click means "put
          // this away". Marked rather than compared against the dialog itself:
          // the layout fills the element, so nothing ever lands on it directly.
          if ((event.target as Element).closest(`[${KEEP_OPEN}]`)) return;
          close();
        }}
      >
        {opened ? (
          <Box display="flex" flexDirection="column" h="100%">
            <Box
              {...{ [KEEP_OPEN]: "" }}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap="3"
              px="4"
              py="2"
              color="white"
            >
              <Text
                fontFamily="ui"
                fontSize="xs"
                letterSpacing="wide"
                truncate
                // Dimmed rather than hidden when the image has no title of its
                // own; a great many of them do not.
                opacity={opened.title ? 1 : 0.6}
              >
                {opened.title || opened.alt}
              </Text>

              <Box display="flex" alignItems="center" gap="1" flexShrink="0">
                {canZoom ? (
                  <Control
                    buttonRef={zoomButton}
                    onClick={() => setZoomed((was) => !was)}
                    label={zoomed ? "Fit to screen" : "Zoom to full size"}
                  >
                    {zoomed ? (
                      <LuZoomOut aria-hidden />
                    ) : (
                      <LuZoomIn aria-hidden />
                    )}
                  </Control>
                ) : null}
                <Control onClick={close} label="Close">
                  <LuX aria-hidden />
                </Control>
              </Box>
            </Box>

            <Box
              ref={pan}
              {...(zoomed
                ? {
                    tabIndex: 0,
                    role: "region",
                    "aria-label": `${opened.title || opened.alt}, zoomed. Use the arrow keys to move around it.`,
                  }
                : {})}
              flex="1"
              minH="0"
              display={zoomed ? "block" : "flex"}
              alignItems="center"
              justifyContent="center"
              overflow={zoomed ? "auto" : "hidden"}
              px={zoomed ? "0" : "4"}
              pb="4"
            >
              {/*
                A plain `img` on purpose. `next/image` serves a variant sized
                for the box it is given, which is exactly what makes the map
                unreadable in the column — and at full size there is nothing to
                optimise anyway, since these are already webp and the whole
                point is the original pixels.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                {...{ [KEEP_OPEN]: "" }}
                src={opened.src}
                alt={opened.alt}
                width={opened.width || undefined}
                height={opened.height || undefined}
                // A second way to the same toggle the header button offers, for
                // the hand already on the picture. The button is what makes it
                // reachable from the keyboard, so this needs no role of its own.
                ref={picture}
                onLoad={measure}
                onClick={() => {
                  if (canZoom) setZoomed((was) => !was);
                }}
                /*
                 * The small copy, painted on the picture's own box rather than
                 * on the room around it — `contain` against the whole window
                 * blows a picture smaller than the window up into a second,
                 * blurred one behind the first.
                 *
                 * It shows only until the full-size file arrives, which then
                 * covers it exactly: same element, same rectangle, so the map
                 * sharpens rather than appearing. Dropped once zoomed, where
                 * the two no longer agree on a size.
                 */
                style={
                  zoomed
                    ? {
                        display: "block",
                        width: `${opened.width}px`,
                        maxWidth: "none",
                        cursor: "zoom-out",
                      }
                    : {
                        // `auto` with the printed ratio, so the box is the
                        // picture. Left to the width and height attributes the
                        // element keeps its full width while `object-fit`
                        // centres the image inside it, which puts the preview
                        // and the picture in two different places — and makes
                        // the box far wider than anything is drawn in.
                        width: "auto",
                        height: "auto",
                        aspectRatio: `${opened.width} / ${opened.height}`,
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                        cursor: zoomable ? "zoom-in" : "default",
                        backgroundImage: opened.preview
                          ? `url(${opened.preview})`
                          : undefined,
                        backgroundSize: "contain",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                      }
                }
              />
            </Box>
          </Box>
        ) : null}
      </dialog>
    </Box>
  );
}

function Control({
  onClick,
  label,
  buttonRef,
  children,
}: {
  onClick: () => void;
  label: string;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}) {
  return (
    <Box
      asChild
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      w="9"
      h="9"
      rounded="full"
      color="white"
      opacity={0.75}
      transition="opacity .12s, background .12s"
      _hover={{ opacity: 1, bg: "rgba(255,255,255,0.12)" }}
    >
      <button
        type="button"
        ref={buttonRef}
        onClick={onClick}
        aria-label={label}
      >
        {children}
      </button>
    </Box>
  );
}
