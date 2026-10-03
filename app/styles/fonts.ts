/**
 * Self-hosted web fonts: Hanken Grotesk for UI text, IBM Plex Mono for
 * numerals and times. Only the Latin subset is served, which covers the
 * app's text including Finnish and German letters.
 *
 * `font-display: optional` means a font that is not ready for the first
 * paint is not swapped in later, so text never shifts on font load. The
 * files are preloaded from the document head, which makes them ready in time
 * on almost every load; the next navigation uses them from cache.
 */
import hankenGrotesk from "@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2?url";
import plexMono400 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url";
import plexMono500 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url";

/** Latin and Latin-1 Supplement, plus common punctuation and symbols. */
const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

interface FontFace {
  family: string;
  url: string;
  weight: string;
}

export const FONT_FACES: readonly FontFace[] = [
  { family: "Hanken Grotesk", url: hankenGrotesk, weight: "100 900" },
  { family: "IBM Plex Mono", url: plexMono400, weight: "400" },
  { family: "IBM Plex Mono", url: plexMono500, weight: "500" },
];

/** The `@font-face` rules, rendered into the document head. */
export const fontFaceCss = FONT_FACES.map(
  (face) =>
    `@font-face{font-family:"${face.family}";font-style:normal;font-weight:${face.weight};` +
    `font-display:optional;src:url("${face.url}") format("woff2");unicode-range:${LATIN};}`
).join("");

/** Preload links for the route `links` export. */
export const fontPreloadLinks = FONT_FACES.map((face) => ({
  rel: "preload",
  href: face.url,
  as: "font",
  type: "font/woff2",
  crossOrigin: "anonymous" as const,
}));
