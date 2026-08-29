"use client";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { ChakraProvider } from "@chakra-ui/react";
import { useServerInsertedHTML } from "next/navigation";
import { useState, type ReactNode } from "react";
import { system } from "@/theme";
import { ColorModeProvider, type ColorModeProviderProps } from "./color-mode";

export function Provider(props: ColorModeProviderProps) {
  return (
    <StyleRegistry>
      <ChakraProvider value={system}>
        <ColorModeProvider {...props} />
      </ChakraProvider>
    </StyleRegistry>
  );
}

/**
 * Emotion's stylesheet, put in the head rather than left in the middle of the
 * page.
 *
 * Chakra styles through Emotion, which on the server emits a `<style>` for each
 * rule the moment the element using it is rendered — inline, right where that
 * element sits. The browser then hydrates a tree in which those `<style>` tags
 * do not exist, because on the client Emotion inserts through the CSSOM
 * instead, and React finds a `<style>` where it expected the element: "Hydration
 * failed… the server rendered HTML didn't match", followed by the whole page
 * being thrown away and re-rendered.
 *
 * It only bit some pages, which is what made it look like a component bug. It
 * is not: it depends on whether a chapter happens to introduce a new rule
 * inside the streamed body rather than in the shell, so a chapter with a
 * `ChapterBar` fell over and one three sections longer did not.
 *
 * `useServerInsertedHTML` is Next's answer to this. Emotion collects what it
 * inserted during the render, and Next flushes it into the document head at the
 * right moment in the stream, which is where a stylesheet belongs and where
 * hydration will not trip over it.
 */
function StyleRegistry({ children }: { children: ReactNode }) {
  const [registry] = useState(() => {
    // `css`, matching the key Emotion uses by default, so the class names in the
    // markup are the ones every existing test and `:has()` rule already expects.
    const cache = createCache({ key: "css" });

    // Emotion needs to be told it is being read back rather than re-inserted;
    // without it the client re-inserts every rule it finds in the head.
    cache.compat = true;

    const inserted: string[] = [];
    const insert = cache.insert.bind(cache);

    cache.insert = (...args: Parameters<typeof insert>) => {
      const [, serialized] = args;
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return insert(...args);
    };

    return { cache, take: () => inserted.splice(0, inserted.length) };
  });

  useServerInsertedHTML(() => {
    const names = registry.take();
    if (names.length === 0) return null;

    let rules = "";
    for (const name of names) {
      const rule = registry.cache.inserted[name];
      if (typeof rule === "string") rules += rule;
    }

    return (
      <style
        // The names go on the tag so Emotion recognises its own work on the
        // client and does not insert all of it a second time.
        data-emotion={`${registry.cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: rules }}
      />
    );
  });

  return <CacheProvider value={registry.cache}>{children}</CacheProvider>;
}
