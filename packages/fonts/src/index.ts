/**
 * Bundled open-licence fonts (Fontsource, SIL OFL) for PDF rendering. Served to Chromium from node_modules via an
 * intercepted origin, so rendering never depends on the network and Arabic/Urdu/Hindi/CJK glyphs are always present.
 * Fontsource splits big fonts by unicode-range, so Chromium only loads (and embeds) subsets actually used.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
export const FONT_ORIGIN = "https://fonts.gars.local";

/** [package, css files] — families must match the stacks in @gars/template-engine render.ts. */
const FONTS: [string, string[]][] = [
  ["@fontsource/inter", ["400.css", "600.css", "700.css"]],
  ["@fontsource/source-serif-4", ["400.css", "700.css"]],
  ["@fontsource/source-sans-3", ["400.css", "700.css"]],
  ["@fontsource/noto-sans-arabic", ["400.css", "700.css"]],
  ["@fontsource/noto-nastaliq-urdu", ["400.css", "700.css"]],
  ["@fontsource/noto-sans-devanagari", ["400.css", "700.css"]],
  ["@fontsource/noto-sans-sc", ["400.css", "700.css"]],
  ["@fontsource/noto-sans-jp", ["400.css", "700.css"]],
];

const pkgDir = (pkg: string) => dirname(require.resolve(`${pkg}/package.json`));

const cssCache = new Map<string, string>();
/** All @font-face rules with URLs rewritten to `origin` (FONT_ORIGIN for the PDF renderer, "/fonts" for the web preview). */
export function fontFaceCss(origin: string = FONT_ORIGIN): string {
  const hit = cssCache.get(origin);
  if (hit) return hit;
  const out: string[] = [];
  for (const [pkg, files] of FONTS) {
    const short = pkg.split("/")[1]!;
    for (const f of files) {
      const css = readFileSync(join(pkgDir(pkg), f), "utf8")
        .replace(/,\s*url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g, "")
        .replace(/url\(\.\/files\//g, `url(${origin}/${short}/files/`)
        .replace(/font-display:\s*swap;/g, "font-display: block;");
      out.push(css);
    }
  }
  const css = out.join("\n");
  cssCache.set(origin, css);
  return css;
}

/** Bytes for one bundled font file; strict allow-list (no path traversal). */
export function fontFile(shortPkg: string, file: string): Buffer | null {
  if (!/^[a-z0-9-]+$/.test(shortPkg) || !/^[a-z0-9-]+\.woff2$/.test(file)) return null;
  const pkg = FONTS.find(([p]) => p === `@fontsource/${shortPkg}`)?.[0];
  if (!pkg) return null;
  try { return readFileSync(join(pkgDir(pkg), "files", file)); } catch { return null; }
}

/** Resolve an intercepted PDF-renderer font URL to bytes, or null if it is not one of our bundled files. */
export function fontBytes(url: string): Buffer | null {
  const m = url.match(/^https:\/\/fonts\.gars\.local\/([a-z0-9-]+)\/files\/([a-z0-9-]+\.woff2)$/);
  return m ? fontFile(m[1]!, m[2]!) : null;
}
