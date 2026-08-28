import { Box, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { SIDEWAYS_SCROLLBAR, TOPBAR } from "@/components/layout/constants";
import type { TablePresentation } from "@/lib/content/tables";

/**
 * The frame every table is set in.
 *
 * It owns the presentation a table has regardless of what it is a table *of* —
 * the caption, the surface it sits on, the box that scrolls, the anchor a
 * `{@table}` link lands on, and the space before its footnotes. The renderer
 * inside it keeps everything domain-specific: which cells are dice, which are
 * prose, what a class level means.
 *
 * Splitting it this way is what stops the three table renderers drifting apart
 * again. They had each grown their own answer to the same questions, and the
 * differences were not decisions anyone made.
 *
 * Rendered on the server. Overflow is the one thing here that needs a laid-out
 * box, and `TableScrollers` answers it for every table on the page at once.
 */
export function TableFrame({
  presentation,
  caption,
  label,
  anchorId,
  footnotes,
  children,
}: {
  presentation: TablePresentation;
  /** Rendered above the table. */
  caption?: ReactNode;
  /** The name the region takes if it turns out to scroll. Plain text. */
  label?: string;
  /** The id an inbound `{@table}` link addresses. */
  anchorId?: string;
  footnotes?: ReactNode;
  children: ReactNode;
}) {
  const { width, viewport, header, stickyRowHeader, profile } = presentation;

  /*
   * A figure, not a paragraph: a table that breaks out takes the room the
   * reading column published in `--table-room` and centres itself on the
   * measure, reaching symmetrically into the margins either side.
   *
   * `100%` here is the measure, so the negative margin is half the difference
   * and the table stays centred on the text it belongs to. Where the property
   * is undefined — an aside, a stat block, anywhere but the reading column —
   * both lines collapse to the width it already had.
   */
  const breakout =
    width === "breakout"
      ? {
          width: "var(--table-room, 100%)",
          marginInline: "calc((100% - var(--table-room, 100%)) / 2)",
        }
      : undefined;

  /*
   * The frame is what `100cqi` means to the cells inside it, which is how a
   * prose column in the measure knows how much room there is to divide. An
   * element resolves the unit against its nearest *ancestor* container, so the
   * frame's own width above still resolves against the reading column.
   */
  const container = { containerType: "inline-size" as const };

  /*
   * A row identity that stays put while the rest slides past it. Opaque, or the
   * cells would read through it, and above the body but below the head — which
   * crosses it at the corner. Sticky does nothing at all when nothing scrolls,
   * so this needs no measuring to be safe.
   */
  const rowHeaderCss = stickyRowHeader
    ? {
        "& [data-row-header]": {
          position: "sticky",
          insetInlineStart: 0,
          zIndex: 1,
          background: "var(--chakra-colors-bg-panel)",
        },
        "& thead [data-row-header]": {
          zIndex: 3,
          background: "var(--chakra-colors-bg-muted)",
        },
        // A keyline only while there is something hidden behind it.
        "&[data-overflow-start] [data-row-header]": {
          borderInlineEndWidth: "1px",
          borderInlineEndColor: "var(--chakra-colors-border-emphasized)",
        },
      }
    : {};

  /*
   * The whole head sticks, not each row, so several header rows stack in the
   * order they are written without anyone having to know how tall the row above
   * is. Below the top bar's `docked` layer either way.
   */
  const stickyHead = {
    "& thead": {
      position: "sticky",
      insetBlockStart: header === "page-sticky" ? TOPBAR : 0,
      zIndex: 2,
    },
  };

  const table =
    header === "page-sticky" ? (
      /*
       * No scroll wrapper, and it is the sticky heading that rules it out: a
       * box with `overflow-x: auto` scrolls in the block axis too, and a `thead`
       * inside it holds against that box rather than the page. A table this
       * shape stays in the measure and has no sideways travel to wrap.
       */
      children
    ) : (
      <Box
        /*
         * Written out rather than spread from `TABLE_SCROLL_ATTR`. A computed
         * key never reaches the DOM here — the same build-time extraction that
         * drops a `css` key built from a constant drops this one, silently, and
         * the enhancer then finds no tables at all. The constants stay for the
         * selector on the other side, where they are read rather than written.
         */
        data-table-scroll=""
        data-table-label={label}
        /*
         * Only a bounded box can be scrolled downwards. One in normal flow
         * grows to its content, so whatever block overflow it reports is the
         * box measuring itself rather than something a reader could reach.
         */
        data-table-bounded={viewport === "bounded" ? "" : undefined}
        overflowX="auto"
        /*
         * A table read by comparing across both axes gets a viewport of its own
         * rather than running down the page: bounded in height, with its
         * headings and its row identities pinned inside it.
         *
         * Bounding the height is what keeps the horizontal scrollbar reachable.
         * Wilderness Encounters is 4,063px tall, so its only scrollbar used to
         * sit below ninety rows — you had to scroll past the whole table to
         * reach the control that showed you the rest of it.
         *
         * Sized in `dvh` so it never reaches past the visible screen, and
         * capped in `rem` so it does not become a letterbox on a tall monitor.
         */
        maxBlockSize={
          viewport === "bounded"
            ? { base: "min(65dvh, 34rem)", md: "min(70dvh, 42rem)" }
            : undefined
        }
        overflowY={viewport === "bounded" ? "auto" : undefined}
        borderColor="border"
        rounded="l1"
        css={{
          ...SIDEWAYS_SCROLLBAR,
          "&[data-overflow-end]": {
            borderInlineEndColor: "var(--chakra-colors-border-emphasized)",
          },
          "&[data-overflow-start]": {
            borderInlineStartColor: "var(--chakra-colors-border-emphasized)",
          },
          ...(header === "viewport-sticky" ? stickyHead : {}),
          ...rowHeaderCss,
        }}
      >
        {children}
      </Box>
    );

  return (
    <Box
      my="1"
      id={anchorId}
      scrollMarginTop={anchorId ? "4rem" : undefined}
      data-table-profile={profile}
      css={{
        ...container,
        ...breakout,
        ...(header === "page-sticky" ? stickyHead : {}),
      }}
    >
      {caption ? (
        <Text
          fontFamily="ui"
          fontSize="xs"
          fontWeight="medium"
          textTransform="uppercase"
          letterSpacing="wide"
          color="fg.subtle"
          mb="1.5"
        >
          {caption}
        </Text>
      ) : null}

      {table}

      {footnotes}
    </Box>
  );
}
