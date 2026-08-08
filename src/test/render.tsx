import { ChakraProvider } from "@chakra-ui/react";
import {
  render as renderToDocument,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { system } from "@/theme";

/**
 * Renders a component the way the app does.
 *
 * Every component in this codebase is styled through the design system, and
 * Chakra's factory reads its token map from context — so a bare `render` does
 * not merely lose the styling, it throws `ContextError` on the first styled
 * element. Use this helper rather than `render` from Testing Library directly;
 * that is the whole reason this module exists.
 *
 * `ColorModeProvider` is deliberately absent. It is next-themes, which reads
 * localStorage and settles asynchronously, and nothing here asserts on the
 * colour mode. A test that needs dark mode should wrap for it explicitly and
 * say so.
 */

function Wrapper({ children }: { children: ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}

export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return renderToDocument(ui, { wrapper: Wrapper, ...options });
}

export { screen, within, waitFor, fireEvent } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
