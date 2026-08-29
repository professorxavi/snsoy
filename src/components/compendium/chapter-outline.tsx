"use client";

import { Box, type BoxProps, Stack, Text } from "@chakra-ui/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { OutlineNode } from "@/lib/content/outline";

/**
 * "In this chapter": the chapter's headings, three levels deep, following the
 * reader down the page.
 *
 * A chapter runs to 372 headings at the extreme, so listing them flat is not an
 * option — but listing only the top level, which is what this replaced, gives
 * seven rows for a chapter with ninety-nine headings in it. So the tree is all
 * there and only the branch being read is open. Measured over every chapter,
 * that is a median of 17 rows on screen and 38 at the ninetieth percentile.
 *
 * Deliberately not `OutlineNav`, which stays as it is: races, classes and
 * monsters have a handful of sections each and want a plain list of anchors,
 * with no JavaScript and no state.
 *
 * Built on `<details>` rather than Chakra's Accordion, which does not respond to
 * clicks anywhere in this app — see the note in `subrace-accordion.tsx`. It also
 * degrades honestly: with no JavaScript the disclosures still open natively and
 * every row is still a working anchor.
 */

/** Where the reading position is taken to be, matching anchors' `scrollMargin`. */
const SPY_OFFSET_REM = 4;

export function ChapterOutline({ items }: { items: OutlineNode[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [spied, setSpied] = useState<string>();

  /**
   * Which row the reader is in, and the rows above it in the tree.
   *
   * Before the first scroll there is nothing to spy, so the chapter opens on its
   * first section — which is also what a reader at the top of the page is in.
   * Rendering that on the server as well keeps hydration quiet and gives a
   * scriptless reader something already open.
   */
  const activeId = spied ?? items[0]?.id;

  const path = ancestry(items, activeId);

  /**
   * A disclosure the reader opened or closed by hand, which outranks the scroll
   * position until the scroll position moves somewhere else.
   *
   * One at a time, and it carries whether it was opened or closed: without the
   * second half there is no way to fold away the section you are standing in.
   * It also carries the row that was current when it was made, which is how it
   * expires — derived rather than cleared in an effect, so a scroll never costs
   * a second render.
   */
  const [override, setOverride] = useState<Override>();
  const live = override?.at === activeId ? override : undefined;

  /*
   * Scroll spy.
   *
   * By measured offsets rather than IntersectionObserver: most of these
   * sections are shorter than the viewport, so several are on screen at once
   * and IO gives no honest answer as to which one is being read. The last
   * heading above the reading line is unambiguous.
   *
   * Re-measured on resize, which also catches the layout settling as images
   * and fonts land.
   */
  useEffect(() => {
    const ids = flatten(items);
    let tops: { id: string; top: number }[] = [];
    let frame = 0;

    const measure = () => {
      tops = ids
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null)
        .map((el) => ({
          id: el.id,
          top: el.getBoundingClientRect().top + window.scrollY,
        }))
        .sort((a, b) => a.top - b.top);
    };

    const update = () => {
      frame = 0;
      const rem = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      const line = window.scrollY + rem * SPY_OFFSET_REM + 1;

      let current = tops[0]?.id;
      for (const heading of tops) {
        if (heading.top > line) break;
        current = heading.id;
      }

      setSpied(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    measure();
    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    const resize = new ResizeObserver(() => {
      measure();
      update();
    });
    resize.observe(document.body);

    return () => {
      window.removeEventListener("scroll", onScroll);
      resize.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  // Keep the row being read in the gutter's own scroll box. `nearest` is what
  // makes this safe: the row is inside a viewport-height sticky panel, so the
  // browser has nothing to scroll but the panel, and the page stays put.
  useEffect(() => {
    if (!activeId) return;

    root.current
      ?.querySelector(`[data-row="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  if (items.length === 0) return null;

  return (
    <Stack ref={root} gap="2">
      <Text
        fontFamily="ui"
        fontSize="2xs"
        fontWeight="semibold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="fg.subtle"
      >
        In this chapter
      </Text>

      <Rows
        nodes={items}
        depth={0}
        activeId={activeId}
        path={path}
        override={live}
        setOverride={setOverride}
      />
    </Stack>
  );
}

/** A disclosure the reader set by hand, and the reading position it outranks. */
interface Override {
  id: string;
  open: boolean;
  at?: string;
}

/** What every row in the tree needs to know, whatever level it sits at. */
interface TreeState {
  depth: number;
  activeId?: string;
  path: string[];
  override?: Override;
  setOverride: (next: Override) => void;
}

function Rows({ nodes, ...rest }: TreeState & { nodes: OutlineNode[] }) {
  return (
    <Stack
      as="ul"
      gap="0"
      pl={rest.depth > 0 ? "3" : "0"}
      css={{ listStyle: "none" }}
    >
      {nodes.map((node) => (
        <Box as="li" key={node.key}>
          <Row node={node} {...rest} />
        </Box>
      ))}
    </Stack>
  );
}

function Row({
  node,
  depth,
  activeId,
  path,
  override,
  setOverride,
}: TreeState & { node: OutlineNode }) {
  const active = node.id !== undefined && node.id === activeId;

  /*
   * Every row reserves the chevron's width whether or not it has one, so a
   * leaf and its neighbouring section start their names at the same place.
   * Without it "Arrival" and "Locations in the City" sit eighteen pixels apart
   * and the level stops reading as a level.
   */
  if (node.children.length === 0) {
    return (
      <Rule depth={depth} active={active}>
        <Box w="4" flexShrink="0" aria-hidden />
        <Label node={node} active={active} />
      </Rule>
    );
  }

  const open =
    override?.id === node.key ? override.open : path.includes(node.key);

  return (
    <Box asChild>
      <details open={open}>
        <Rule
          as="summary"
          depth={depth}
          active={active}
          cursor="pointer"
          /*
           * Both intents live on the summary because both controls have to sit
           * inside it — anything else is disclosure content and disappears when
           * the disclosure closes.
           *
           * The default action is always cancelled: React owns `open` here, and
           * letting the browser toggle it too would put the two out of step. With
           * no JavaScript this handler never runs and the native toggle is
           * exactly the behaviour wanted.
           */
          onClick={(event: React.MouseEvent<HTMLElement>) => {
            event.preventDefault();

            // A run of rows has nowhere of its own to go, so the whole of it
            // is the disclosure control.
            if (
              node.id === undefined ||
              (event.target as Element).closest("[data-toggle]")
            ) {
              setOverride({ id: node.key, open: !open, at: activeId });
              return;
            }

            goTo(node.id);
          }}
        >
          <Chevron open={open} title={node.title} />
          <Label node={node} active={active} />
        </Rule>

        <Rows
          nodes={node.children}
          depth={depth + 1}
          activeId={activeId}
          path={path}
          override={override}
          setOverride={setOverride}
        />
      </details>
    </Box>
  );
}

/**
 * The line a row is drawn against: the tree's guide rule at every level below
 * the first, and the reader's own position wherever they are.
 */
function Rule({
  depth,
  active,
  children,
  ...rest
}: {
  depth: number;
  active: boolean;
  children: ReactNode;
} & BoxProps) {
  return (
    <Box
      display="flex"
      alignItems="start"
      gap="1"
      // Constant, so a row does not shift sideways as it becomes current; only
      // the colour changes. Transparent is the resting state at the top level,
      // where there is no branch to trace.
      borderLeftWidth="1px"
      borderColor={active ? "brand" : depth > 0 ? "border" : "transparent"}
      css={{
        // Suppress the default marker, or it shows alongside the chevron.
        listStyle: "none",
        "&::marker": { content: '""' },
        "&::-webkit-details-marker": { display: "none" },
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

/**
 * The row itself: an anchor wherever there is somewhere to go.
 *
 * A parent's link is handled by the summary around it rather than navigating on
 * its own, but it stays an `<a>` with an `href` so it can be copied, opened in
 * a new tab, and read as a link — and so a scriptless reader can still follow
 * it. A run of rows is not a heading and gets no link, only a name.
 */
function Label({ node, active }: { node: OutlineNode; active: boolean }) {
  return (
    <Box
      asChild
      display="block"
      flex="1"
      minW="0"
      py="1"
      fontFamily="ui"
      fontSize="xs"
      lineHeight="1.35"
      fontWeight={active ? "semibold" : "normal"}
      color={active ? "brand" : node.id ? "fg.muted" : "fg.subtle"}
      textWrap="pretty"
      _hover={{ color: "brand" }}
    >
      {node.id === undefined ? (
        <span>{node.title}</span>
      ) : (
        <a
          href={`#${node.id}`}
          data-row={node.id}
          aria-current={active ? "location" : undefined}
          onClick={(event) => {
            // A leaf handles its own click; inside a summary the parent already
            // cancelled it and this never fires.
            if (event.defaultPrevented) return;
            event.preventDefault();
            goTo(node.id as string);
          }}
        >
          {node.title}
        </a>
      )}
    </Box>
  );
}

/**
 * The disclosure control, separate from the label so that revealing a section's
 * contents and going to it are two different clicks. Clicking the name of the
 * section you are already reading should not fold it away.
 */
function Chevron({ open, title }: { open: boolean; title: string }) {
  return (
    <Box
      asChild
      data-toggle=""
      flexShrink="0"
      mt="1.5"
      p="0.5"
      color="fg.subtle"
      _hover={{ color: "brand" }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} sections in ${title}`}
      >
        <Box
          asChild
          w="2.5"
          h="2.5"
          display="block"
          transition="transform .15s ease"
          transform={open ? "rotate(90deg)" : undefined}
        >
          <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path
              d="M3.5 1.5 L7 5 L3.5 8.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>
      </button>
    </Box>
  );
}

/**
 * Go to a heading, and put it in history the way following the anchor would.
 *
 * `pushState` rather than setting the hash: the same row clicked twice is not a
 * hash change and would scroll nowhere, and nothing on a chapter page is hidden
 * behind a disclosure the way a subrace is, so there is nothing to open first.
 */
function goTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;

  history.pushState(null, "", `#${id}`);
  target.scrollIntoView({ block: "start" });
}

/** Every anchor in the tree, in the order the page prints them. */
function flatten(nodes: OutlineNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.id === undefined ? [] : [node.id]),
    ...flatten(node.children),
  ]);
}

/**
 * The row with this anchor and every row above it, so its branch can be opened.
 *
 * By key rather than anchor, because a run of rows has no anchor and still has
 * to be opened to reveal what is inside it.
 */
function ancestry(nodes: OutlineNode[], id: string | undefined): string[] {
  if (!id) return [];

  for (const node of nodes) {
    if (node.id === id) return [node.key];

    const below = ancestry(node.children, id);
    if (below.length) return [node.key, ...below];
  }

  return [];
}
