"use client";

import { Box, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { SuggestResponse } from "@/app/api/search/suggest/route";
import {
  normalizeQuery,
  resultsHref,
  suggestionHref,
  typeLabel,
} from "@/lib/content/search";
import type { Suggestion } from "@/server/db/queries/search";

/**
 * The top bar's search field, with a typeahead list under it.
 *
 * **It is a real GET form first and a combobox second.** Without JavaScript, or
 * before hydration, or when the suggestion request fails, Enter still lands on
 * `/search?q=…` exactly as it did before this component existed — the dropdown
 * is an accelerator over the top of a form that already worked, never a
 * replacement for it. Submitting with nothing highlighted does not even call
 * `preventDefault`; the browser performs the same GET it always did.
 *
 * The one thing here that is genuinely new for this app is client-side data
 * fetching. Everything else reads its data on the server, so the three failure
 * modes that come with a network round trip on every keystroke are all handled
 * in one place rather than becoming a pattern:
 *
 * - **Too many requests.** Debounced, so a burst of typing costs one.
 * - **Replies arriving out of order.** Every reply echoes the query it answers,
 *   and one that does not match what is in the field is dropped. An
 *   `AbortController` cancels the previous request as well, but abort is a
 *   request to stop rather than a guarantee, so the echo is what actually makes
 *   this correct.
 * - **A reply arriving after the component is gone.** The same in-flight ref is
 *   cleared on unmount.
 */

/** Long enough that ordinary typing costs one request per word, not per letter. */
const DEBOUNCE_MS = 150;

/** One shared empty array, so "no suggestions" is a stable reference. */
const EMPTY: Suggestion[] = [];

export function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;

  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  /** Which row the keyboard is on. -1 is the field itself, nothing highlighted. */
  const [active, setActive] = useState(-1);

  /**
   * The last reply, stored with the query it answered.
   *
   * Kept together so the list can be *derived* rather than cleared. Clearing it
   * would mean setting state from the effect body the moment someone deletes a
   * character, which is both a cascading render and the thing
   * `react-hooks/set-state-in-effect` exists to stop. Holding the pair instead
   * makes "these suggestions are for what is currently typed" a comparison at
   * render time, and there is no stale state to clean up.
   */
  const [reply, setReply] = useState<{ q: string; items: Suggestion[] }>({
    q: "",
    items: EMPTY,
  });

  const normalized = normalizeQuery(query);
  const suggestions = normalized !== null && reply.q === normalized ? reply.items : EMPTY;

  /** The query whose reply we are still willing to accept. */
  const inFlight = useRef<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);

  /* ---------------------------------------------------------------- *
   * Fetching
   * ---------------------------------------------------------------- */

  useEffect(() => {
    if (!normalized) {
      inFlight.current = null;
      return;
    }

    const controller = new AbortController();
    inFlight.current = normalized;

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;

        const payload = (await response.json()) as SuggestResponse;

        // The echo, not the abort, is what makes this correct — see above.
        if (inFlight.current !== payload.q) return;

        setReply({ q: payload.q, items: payload.suggestions });
        setActive(-1);

        // Only if the reader is still in the field. Without this a reply that
        // lands after Escape reopens the list they just dismissed.
        if (
          payload.suggestions.length > 0 &&
          document.activeElement === inputRef.current
        ) {
          setOpen(true);
        }
      } catch {
        // An aborted request is the normal case here, and a failed one is not
        // worth interrupting anyone over: the form underneath still works.
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalized]);

  /** A reply must not land on a component that has gone away. */
  useEffect(() => {
    return () => {
      inFlight.current = null;
    };
  }, []);

  /* ---------------------------------------------------------------- *
   * Closing
   * ---------------------------------------------------------------- */

  useEffect(() => {
    if (!open) return;

    // Pointer down rather than click, so the list is gone before whatever was
    // clicked underneath it receives the event.
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  /* ---------------------------------------------------------------- *
   * Choosing
   * ---------------------------------------------------------------- */

  const choose = useCallback(
    (suggestion: Suggestion) => {
      close();
      inputRef.current?.blur();
      router.push(suggestionHref(suggestion));
    },
    [close, router],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const chosen = suggestions[active];
    if (!chosen) return; // Let the form do what it has always done.

    event.preventDefault();
    choose(chosen);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      // Does not clear the field. Escape here means "put the list away", and a
      // reader who wanted the words gone can select them.
      close();
      return;
    }

    if (event.key === "Tab") {
      close();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (suggestions.length === 0) return;

    event.preventDefault();

    if (!open) {
      setOpen(true);
      return;
    }

    // Wraps through -1, so arrowing off either end returns to the field with
    // what was typed rather than sticking at the last row.
    const size = suggestions.length + 1;
    const step = event.key === "ArrowDown" ? 1 : -1;
    setActive(((active + 1 + step + size) % size) - 1);
  };

  const showList = open && suggestions.length > 0;

  return (
    <Box ref={rootRef} position="relative" ml="auto">
      <form action="/search" method="get" onSubmit={onSubmit} role="search">
        {/* A ruled field rather than a filled chip: one hairline under it, the
            way a form is ruled on paper. The focus ring is the theme's global
            one, so the border change here is an addition to it and not a
            replacement. */}
        <Box
          asChild
          fontFamily="ui"
          fontSize="xs"
          px="1"
          py="1"
          w={{ base: "32", sm: "44" }}
          bg="transparent"
          color="fg"
          borderBottomWidth="1px"
          borderColor="border.emphasized"
          _placeholder={{ color: "fg.subtle" }}
          _focusVisible={{ borderColor: "brand" }}
        >
          <input
            ref={inputRef}
            type="search"
            name="q"
            placeholder="Search…"
            aria-label="Search the compendium"
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              showList && active >= 0 ? optionId(active) : undefined
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
        </Box>
      </form>

      {/* Rendered only when populated: an empty listbox is announced as one,
          and `aria-expanded` would be claiming a list that is not there. */}
      {showList ? (
        <SuggestionList
          id={listId}
          optionId={optionId}
          suggestions={suggestions}
          active={active}
          query={query}
          onChoose={choose}
        />
      ) : null}
    </Box>
  );
}

function SuggestionList({
  id,
  optionId,
  suggestions,
  active,
  query,
  onChoose,
}: {
  id: string;
  optionId: (index: number) => string;
  suggestions: Suggestion[];
  active: number;
  query: string;
  onChoose: (suggestion: Suggestion) => void;
}) {
  return (
    <Box
      position="absolute"
      top="calc(100% + 6px)"
      right="0"
      w={{ base: "80", sm: "96" }}
      maxW="calc(100vw - 1.5rem)"
      zIndex="dropdown"
      bg="bg.panel"
      color="fg"
      borderWidth="1px"
      borderColor="border"
      rounded="l2"
      boxShadow="lg"
      overflow="hidden"
    >
      <Box as="ul" id={id} role="listbox" aria-label="Suggestions">
        {suggestions.map((suggestion, index) => (
          <Box
            as="li"
            key={suggestion.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            display="flex"
            alignItems="baseline"
            justifyContent="space-between"
            gap="3"
            px="3"
            py="1.5"
            cursor="pointer"
            bg={index === active ? "brand.subtle" : "transparent"}
            _hover={{ bg: "bg.muted" }}
            /*
             * Mouse down, not click: the field is focused, and letting the
             * default action run would blur it and close the list out from
             * under the click that was meant to choose a row.
             */
            onMouseDown={(event) => {
              event.preventDefault();
              onChoose(suggestion);
            }}
          >
            <Text fontFamily="ui" fontSize="xs" truncate>
              {suggestion.name}
              {suggestion.parentName ? (
                <Text as="span" color="fg.subtle">
                  {" — "}
                  {suggestion.parentName}
                </Text>
              ) : null}
            </Text>
            <Text
              fontFamily="ui"
              fontSize="2xs"
              letterSpacing="wide"
              textTransform="uppercase"
              color="fg.subtle"
              whiteSpace="nowrap"
              flexShrink="0"
            >
              {typeLabel(suggestion.entityType)}
            </Text>
          </Box>
        ))}
      </Box>

      {/*
        Outside the listbox on purpose. It is not one of the options — arrowing
        onto it would make "the last suggestion" and "give up on the
        suggestions" the same keystroke — and it is the ordinary Enter target,
        since submitting with nothing highlighted goes to the same place.
      */}
      <Box
        asChild
        display="block"
        px="3"
        py="1.5"
        borderTopWidth="1px"
        borderColor="border"
        fontFamily="ui"
        fontSize="2xs"
        letterSpacing="wide"
        textTransform="uppercase"
        color="brand"
        _hover={{ bg: "bg.muted" }}
      >
        <NextLink href={resultsHref(query)}>
          See all results for “{query.trim()}”
        </NextLink>
      </Box>
    </Box>
  );
}
