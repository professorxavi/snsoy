import type { Metadata } from "next";
import { Alfa_Slab_One, IBM_Plex_Sans, Literata } from "next/font/google";
import { AppFrame } from "@/components/shell";
import { Provider } from "@/components/ui/provider";
import "./globals.css";

/**
 * Three faces, each doing one job. See `src/theme` for why these and not
 * others. All latin-only — the corpus is English and the saving is worth it
 * against a variable face this large.
 */

/** Body and headings. Variable, so dark mode can pull the weight back to 350. */
const literata = Literata({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

/** Chrome: nav, tables, filters, labels. */
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
    "A compendium and character toolset for 2014 fifth edition D&D.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning lang="en">
      <body
        className={`${literata.variable} ${plexSans.variable} ${alfaSlab.variable}`}
      >
        <Provider>
          <AppFrame>{children}</AppFrame>
        </Provider>
      </body>
    </html>
  );
}
