import type { Metadata } from "next";
import { Alfa_Slab_One, IBM_Plex_Sans, Literata } from "next/font/google";
import { AppFrame } from "@/components/layout";
import { Provider } from "@/components/ui/provider";
import "./globals.css";

const literata = Literata({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/** Display only — mastheads, chapter numerals, entity titles. Single weight. */
const alfaSlab = Alfa_Slab_One({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sword & Sorcery over Yonder",
  description:
    "A compendium and reader for the 2014 ruleset of the world's greatest roleplaying game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
      The font variables go on `html`, not `body`, and they have to.
      Chakra defines its font tokens on `:where(html, .chakra-theme)` as
      `var(--font-ui), …`. A custom property that references an undefined
      custom property is guaranteed-invalid, so with the variables declared on
      `body` — a descendant — every `--chakra-fonts-*` token computed to
      nothing and the whole app silently fell back to the browser's default
      sans. Colours were unaffected, which is what kept it hidden.
    */
    <html
      suppressHydrationWarning
      lang="en"
      className={`${literata.variable} ${plexSans.variable} ${alfaSlab.variable}`}
    >
      <body>
        <Provider>
          <AppFrame>{children}</AppFrame>
        </Provider>
      </body>
    </html>
  );
}
