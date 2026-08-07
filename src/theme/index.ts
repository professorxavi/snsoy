import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

/**
 * The design system.
 *
 * Two ideas drive every token here, and both come from what this product
 * actually is rather than from taste:
 *
 * 1. **Two voices, two hues.** Purple is the *app* speaking — nav, active
 *    state, primary action, focus. Cyan is the *corpus* speaking — the inline
 *    cross-reference tags the renderer emits. Body text holds roughly 118,000
 *    of those tags, so a reader has to tell a compendium link from a UI control
 *    instantly. The hues are close at small sizes, so they are separated by
 *    treatment as well: purple fills and sits in chrome, cyan is inline-only
 *    and always underlined, never a filled button. That keeps the distinction
 *    alive without colour vision (WCAG 1.4.1).
 *
 * 2. **Long-form reading is the hard case.** 1,006 book chapters, the largest
 *    555 KB. Everything below favours sustained reading over first impression:
 *    no pure white or pure black ground, a body face built for screen, and a
 *    lighter body weight in dark mode.
 */

const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        /**
         * Literata for both. Built for Play Books — i.e. exactly our
         * long-chapter case — with a low-contrast slabby build that survives
         * dark mode where a Didone would thin out, and a real italic, which 5e
         * prose leans on constantly.
         */
        body: { value: "var(--font-body), Georgia, serif" },
        heading: { value: "var(--font-body), Georgia, serif" },
        /**
         * IBM Plex Sans for chrome. Chosen over Inter deliberately — Inter
         * would make the UI read as generic SaaS. Strong at 11–13px, which is
         * where filter rails and table headers live, and it has real tabular
         * figures.
         */
        ui: { value: "var(--font-ui), system-ui, sans-serif" },
        /**
         * Alfa Slab One. Fat Clarendon with poster energy, one weight, no
         * italic, and a heavy lowercase — so it is only ever correct in small
         * doses at large sizes: masthead, chapter numeral eyebrows, entity
         * titles. On a chapter opener the slab carries the *numeral*
         * ("CHAPTER 9") and Literata carries the *name*; long adventure chapter
         * titles must never be set in it.
         */
        display: { value: "var(--font-display), Georgia, serif" },
      },

      colors: {
        /** The app's voice. Deliberately lower chroma than the stock violet. */
        brand: {
          50: { value: "#F3F1FA" },
          100: { value: "#E6E1F4" },
          200: { value: "#CBC1E9" },
          300: { value: "#AE9FDB" },
          400: { value: "#9E8ACC" },
          500: { value: "#7B62C4" },
          600: { value: "#5B3FBF" },
          700: { value: "#4A2FA3" },
          800: { value: "#3A2680" },
          900: { value: "#2B1D5E" },
          950: { value: "#1C133C" },
        },
        /** The corpus's voice. */
        corpus: {
          50: { value: "#E9F6F9" },
          100: { value: "#CFEBF1" },
          200: { value: "#A5DAE5" },
          300: { value: "#5FC9DE" },
          400: { value: "#35A9C2" },
          500: { value: "#1789A3" },
          600: { value: "#07697D" },
          700: { value: "#0A5566" },
          800: { value: "#0C4451" },
          900: { value: "#0B343D" },
          950: { value: "#072229" },
        },
        /**
         * One neutral ramp serving both modes. Light is a cool near-white with
         * a faint cyan bias; dark is "Slate", a cool neutral charcoal.
         *
         * Dark is explicitly *not* a violet-tinted near-black. Near-black plus
         * a bright lavender is the stock look every AI-generated dark theme
         * lands on, and it was rejected on sight. The rule that replaced it:
         * keep the ground off violet and the accent's chroma low.
         */
        slate: {
          50: { value: "#F6F9FA" },
          100: { value: "#EDF3F4" },
          200: { value: "#E4ECEE" },
          300: { value: "#D8E3E5" },
          400: { value: "#C3D2D5" },
          500: { value: "#9FAEB6" },
          600: { value: "#79878C" },
          700: { value: "#4A575C" },
          800: { value: "#2A343A" },
          900: { value: "#1B2126" },
          950: { value: "#14181B" },
        },
        /** Ink extremes, kept off pure black and pure white on purpose. */
        ink: {
          light: { value: "#12171A" },
          dark: { value: "#E3EAEE" },
        },
        /** SRD / licensing badges. Not an accent — it never carries meaning alone. */
        marque: {
          light: { value: "#8A6410" },
          dark: { value: "#D0A94F" },
        },
      },

      /**
       * Sharp corners throughout. The aesthetic is mid-century pulp print, not
       * a rounded app shell — and at a 33px table row a 6px radius reads as
       * mush rather than softness.
       */
      radii: {
        l1: { value: "2px" },
        l2: { value: "3px" },
        l3: { value: "4px" },
      },
    },

    semanticTokens: {
      colors: {
        /* ---- grounds ---------------------------------------------------- */
        bg: {
          DEFAULT: { value: { _light: "{colors.slate.50}", _dark: "{colors.slate.950}" } },
          /** Cards, rails, table bodies — the layer that sits on the ground. */
          panel: { value: { _light: "#FFFFFF", _dark: "{colors.slate.900}" } },
          /** Table headers, hover rows, insets. */
          muted: { value: { _light: "{colors.slate.100}", _dark: "{colors.slate.800}" } },
          /** Ability-score cells and other recessed chips. */
          sunken: { value: { _light: "{colors.slate.200}", _dark: "#0E1114" } },
        },

        /* ---- text ------------------------------------------------------- */
        fg: {
          DEFAULT: { value: { _light: "{colors.ink.light}", _dark: "{colors.ink.dark}" } },
          /** Secondary prose, table cell text. */
          muted: { value: { _light: "{colors.slate.700}", _dark: "{colors.slate.500}" } },
          /** Labels, counts, metadata — the quietest readable step. */
          subtle: { value: { _light: "{colors.slate.600}", _dark: "{colors.slate.600}" } },
        },

        border: {
          DEFAULT: { value: { _light: "{colors.slate.300}", _dark: "{colors.slate.800}" } },
          emphasized: { value: { _light: "{colors.slate.400}", _dark: "#38454C" } },
        },

        /* ---- the app's voice -------------------------------------------- */
        brand: {
          DEFAULT: { value: { _light: "{colors.brand.600}", _dark: "{colors.brand.400}" } },
          /** Text/icon colour when sitting *on* a filled brand surface. */
          contrast: { value: { _light: "#FFFFFF", _dark: "{colors.slate.950}" } },
          /** Tinted backgrounds: active filter pills, selected rows. */
          subtle: { value: { _light: "{colors.brand.50}", _dark: "#242536" } },
          /** Borders on those tinted surfaces. */
          line: { value: { _light: "{colors.brand.200}", _dark: "#44415C" } },
        },

        /* ---- the corpus's voice ------------------------------------------
         * Only ever inline text, always underlined. There is deliberately no
         * `contrast` token here: cyan must never become a filled button, or it
         * stops meaning "this goes somewhere". */
        corpus: {
          DEFAULT: { value: { _light: "{colors.corpus.600}", _dark: "{colors.corpus.300}" } },
          subtle: { value: { _light: "{colors.corpus.50}", _dark: "#10282F" } },
          line: { value: { _light: "{colors.corpus.200}", _dark: "#2A5761" } },
        },

        /**
         * Rollable dice — `{@damage 8d6}`, `{@hit +4}`, `{@scaledamage}`.
         *
         * A third treatment, and a necessary one: these are interactive but
         * they navigate nowhere, so rendering them in cyan would promise a
         * destination that does not exist. They stay ink-coloured and take a
         * dotted underline, which reads as "actionable" without competing with
         * the cross-references beside them.
         */
        roll: {
          DEFAULT: { value: { _light: "{colors.ink.light}", _dark: "{colors.ink.dark}" } },
          line: { value: { _light: "{colors.slate.600}", _dark: "{colors.slate.600}" } },
        },

        marque: {
          DEFAULT: { value: { _light: "{colors.marque.light}", _dark: "{colors.marque.dark}" } },
        },
      },
    },
  },

  globalCss: {
    html: {
      colorScheme: "light dark",
    },
    body: {
      bg: "bg",
      color: "fg",
      fontFamily: "ui",
    },
    /**
     * Body weight drops in dark mode. Light text on a dark ground blooms
     * optically and reads heavier than the same weight does on white, so
     * Literata's variable axis is pulled back from 400 to 350 to match the
     * apparent weight across the two modes.
     */
    ".dark .prose, .dark [data-prose]": {
      fontWeight: 350,
    },
    /** Never remove a focus ring without replacing it. */
    "*:focus-visible": {
      outline: "2px solid",
      outlineColor: "brand",
      outlineOffset: "2px",
    },
  },
});

export const system = createSystem(defaultConfig, config);
