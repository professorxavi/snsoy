"use client";

import { Box } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { LuArrowUp } from "react-icons/lu";
import { OUTLINE } from "./constants";

/**
 * Back to the top of a reading page.
 *
 * Chapters here run to 555 KB and a class page to several screens of features,
 * and the way out of one has been the browser's own scrollbar or the End key.
 * The chapter bar with its contents link is at the very top, which is precisely
 * where a reader deep in a chapter cannot reach.
 *
 * Appears after a full screen of scrolling, so it is never in the way of
 * someone who has not gone anywhere yet.
 */
export function BackToTop({
  /**
   * Whether this page has an outline in the trailing gutter, which the button
   * has to clear — otherwise it sits over the last rows of it.
   */
  clearsOutline,
}: {
  clearsOutline: boolean;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      // A screenful, so the threshold is the reader's own screen rather than a
      // number that means one thing on a phone and another on a desktop.
      setShown(window.scrollY > window.innerHeight);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <Box
      asChild
      position="fixed"
      bottom="5"
      insetInlineEnd={{
        base: "5",
        lg: clearsOutline ? `calc(${OUTLINE} + {spacing.5})` : "5",
      }}
      /*
       * Under the aside, which is `modal`. Opening an entity covers this on a
       * phone and tucks it behind the drawer on a desktop, which is right
       * either way: the panel is what the reader is looking at, and the page
       * underneath has not moved.
       */
      zIndex="docked"
      display={shown ? "inline-flex" : "none"}
      alignItems="center"
      justifyContent="center"
      w="10"
      h="10"
      rounded="full"
      bg="bg.panel"
      color="fg.muted"
      borderWidth="1px"
      borderColor="border"
      boxShadow="lg"
      transition="color .12s, border-color .12s"
      _hover={{ color: "brand", borderColor: "brand" }}
    >
      <button type="button" onClick={toTop} aria-label="Back to top">
        <LuArrowUp aria-hidden />
      </button>
    </Box>
  );
}

/**
 * Up to the top, and put the keyboard there too.
 *
 * Focus is the half that is easy to forget: without it a reader who pressed
 * this with the keyboard is looking at the top of the chapter while the next
 * Tab carries on from the foot of it. `main` takes focus rather than the
 * document, which is also where the skip link lands.
 */
function toTop() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  document.getElementById("main")?.focus({ preventScroll: true });
}
