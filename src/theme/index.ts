import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

/**
 * The design system: colours, fonts, radii and layout geometry.
 *
 * Two colour roles that must stay distinguishable: `brand` (purple) for the
 * app's own UI, `reference` (cyan) for inline cross-reference links in body
 * text. They are also separated by treatment — cyan is inline and always
 * underlined, never a filled control — so the distinction survives without
 * colour vision.
 */

const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        /** Literata: designed for long-form screen reading, holds up in dark mode. */
        body: { value: "var(--font-body), Georgia, serif" },
        heading: { value: "var(--font-body), Georgia, serif" },
        /** IBM Plex Sans for UI text. Legible at 11-13px, real tabular figures. */
        ui: { value: "var(--font-ui), system-ui, sans-serif" },
        /**
         * Alfa Slab One. One weight, no italic, heavy lowercase, so use it only
         * at large sizes in short runs: masthead, entity titles.
         */
        display: { value: "var(--font-display), Georgia, serif" },
      },

      colors: {
        /** The app's own UI. Lower chroma than the stock violet. */
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
        /** Inline cross-reference links. */
        reference: {
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
         * One neutral ramp for both modes. Light is a cool near-white, dark a
         * cool charcoal. Deliberately not violet-tinted.
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
        /** Ink extremes. Kept off pure black and pure white. */
        ink: {
          light: { value: "#12171A" },
          dark: { value: "#E3EAEE" },
        },
        /** SRD and licensing badges. Never carries meaning on its own. */
        marque: {
          light: { value: "#8A6410" },
          dark: { value: "#D0A94F" },
        },
      },

      /** Sharp corners throughout; a large radius reads as mush at row height. */
      radii: {
        l1: { value: "2px" },
        l2: { value: "3px" },
        l3: { value: "4px" },
      },

      /**
       * Layout geometry. Kept together because the widths are interdependent:
       * opening the aside is what forces the rail to collapse.
       */
      sizes: {
        /** Top bar. Also the sticky offset for the rail, aside and table head. */
        topbar: { value: "46px" },
        /** Filter rail, expanded. */
        rail: { value: "212px" },
        /** Filter rail once the aside takes the width — icon strip only. */
        railCollapsed: { value: "46px" },
        /** Entity detail aside. Below this the aside becomes a full-height sheet. */
        aside: { value: "400px" },
        /** The reading layout's trailing gutter, which holds the page outline. */
        outline: { value: "13rem" },
        /** Reading measure, in `ch` so it tracks the font. Targets 65-70 characters. */
        measure: { value: "68ch" },
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
          /**
           * Labels, counts, metadata — the quietest readable step.
           *
           * Not `slate.600`, which this used to be. The role carries uppercase
           * labels at 10px, so it is never "large text" and owes the full
           * 4.5:1 — and `slate.600` measured 3.5:1 on the light ground and
           * 4.4:1 on a dark panel. The binding surface is `bg.muted`, not the
           * page ground: table column headers and the ability-score chips both
           * sit on it, and it is the lightest ground in dark mode.
           * `contrast.test.ts` measures every pair.
           */
          subtle: { value: { _light: "#5F6C71", _dark: "#94A3AA" } },
        },

        border: {
          DEFAULT: { value: { _light: "{colors.slate.300}", _dark: "{colors.slate.800}" } },
          emphasized: { value: { _light: "{colors.slate.400}", _dark: "#38454C" } },
        },

        /* ---- the app's own UI ------------------------------------------- */
        brand: {
          DEFAULT: { value: { _light: "{colors.brand.600}", _dark: "{colors.brand.400}" } },
          /** Text and icons sitting on a filled brand surface. */
          contrast: { value: { _light: "#FFFFFF", _dark: "{colors.slate.950}" } },
          /** Tinted backgrounds: active filter pills, selected rows. */
          subtle: { value: { _light: "{colors.brand.50}", _dark: "#242536" } },
          /** Borders on those tinted surfaces. */
          line: { value: { _light: "{colors.brand.200}", _dark: "#44415C" } },
        },

        /* Inline cross-reference links. No `contrast` token on purpose: this
         * colour should never become a filled control. */
        reference: {
          DEFAULT: { value: { _light: "{colors.reference.600}", _dark: "{colors.reference.300}" } },
          subtle: { value: { _light: "{colors.reference.50}", _dark: "#10282F" } },
          line: { value: { _light: "{colors.reference.200}", _dark: "#2A5761" } },
        },

        /**
         * Rollable dice. Interactive but they navigate nowhere, so they get a
         * dotted underline rather than the cross-reference colour.
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
    /** Light text on a dark ground reads heavier, so pull the weight back. */
    ".dark .prose, .dark [data-prose]": {
      fontWeight: 350,
    },
    /** Focus ring. Do not remove without replacing. */
    "*:focus-visible": {
      outline: "2px solid",
      outlineColor: "brand",
      outlineOffset: "2px",
    },
  },
});

export const system = createSystem(defaultConfig, config);
