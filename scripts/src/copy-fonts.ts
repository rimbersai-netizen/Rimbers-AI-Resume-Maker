/**
 * Copies the bundled fonts used by the PDF renderer into apps/web/public/fonts so the live preview loads the
 * exact same files (preview ↔ PDF glyph consistency). Run automatically before `next build`/`next dev`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fontFaceCss, fontFile } from "@gars/fonts";

const out = resolve(import.meta.dirname, "../../apps/web/public/fonts");
const css = fontFaceCss("/fonts");
let n = 0;
for (const m of css.matchAll(/url\(\/fonts\/([a-z0-9-]+)\/files\/([a-z0-9-]+\.woff2)\)/g)) {
  const bytes = fontFile(m[1]!, m[2]!);
  if (!bytes) throw new Error(`missing font ${m[1]}/${m[2]}`);
  const dest = resolve(out, m[1]!, "files", m[2]!);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, bytes);
  n++;
}
writeFileSync(resolve(out, "fonts.css"), css);
console.log(`copied ${n} font files to ${out}`);
