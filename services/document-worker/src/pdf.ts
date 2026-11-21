/**
 * HTML → PDF with headless Chromium. Same HTML as the live preview (renderResumeHtml), so preview and export match.
 * Security: the page has JavaScript disabled, and every network request is blocked except bundled fonts and an
 * optional photo data: URI — resume content can never make the renderer fetch anything.
 */
import { chromium, type Browser } from "playwright-core";
import { FONT_ORIGIN, fontBytes, fontFaceCss } from "@gars/fonts";

let browserPromise: Promise<Browser> | null = null;

export function getBrowser(): Promise<Browser> {
  // CHROMIUM_EXECUTABLE lets operators point at a system Chrome/Chromium when Playwright's bundled build is unavailable.
  browserPromise ??= chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: ["--disable-dev-shm-usage", "--no-first-run"],
  });
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise;
  browserPromise = null;
  await b.close();
}

export interface PdfOptions {
  pageSize: "A4" | "Letter";
  title?: string;
  timeoutMs?: number;
  /** Called for every blocked request (observability/tests). */
  onBlocked?: (url: string) => void;
}

/** Inject bundled @font-face rules right after <head>. */
export function withFonts(html: string): string {
  return html.replace(/<head>/i, `<head><style>${fontFaceCss()}</style>`);
}

async function isolatedContext(opts: { javaScript?: boolean; viewport?: { width: number; height: number }; scale?: number; onBlocked?: (url: string) => void }) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    javaScriptEnabled: opts.javaScript ?? false, viewport: opts.viewport, deviceScaleFactor: opts.scale ?? 1,
  });
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(FONT_ORIGIN)) {
      const body = fontBytes(url);
      return body ? route.fulfill({ status: 200, body, contentType: "font/woff2" }) : route.abort();
    }
    if (url.startsWith("data:")) return route.continue();
    opts.onBlocked?.(url);
    return route.abort();
  });
  return context;
}

/** A4 / Letter at 96 dpi (CSS px). */
export const PAGE_PX = { A4: { width: 794, height: 1123 }, Letter: { width: 816, height: 1056 } } as const;

/** Screenshot of page 1 as rendered for print (print media, same fonts) — for visual regression. */
export async function renderPng(html: string, opts: { pageSize: "A4" | "Letter"; scale?: number }): Promise<Buffer> {
  const vp = PAGE_PX[opts.pageSize];
  const context = await isolatedContext({ viewport: vp, scale: opts.scale ?? 0.5 });
  try {
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    // @page margins don't apply on screen; emulate them with body padding so the screenshot matches the PDF page.
    await page.setContent(withFonts(html).replace("</head>", "<style>body{padding:14mm;box-sizing:border-box}</style></head>"), { waitUntil: "load" });
    return await page.screenshot({ clip: { x: 0, y: 0, ...vp }, animations: "disabled" });
  } finally {
    await context.close();
  }
}

/** Layout measurement (JS enabled only for this probe; content itself contains no scripts). */
export async function measureLayout(html: string, pageSize: "A4" | "Letter"): Promise<{ overflowX: number; overflowing: string[] }> {
  const vp = PAGE_PX[pageSize];
  const context = await isolatedContext({ javaScript: true, viewport: vp });
  try {
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    await page.setContent(withFonts(html).replace("</head>", "<style>body{padding:14mm;box-sizing:border-box}</style></head>"), { waitUntil: "load" });
    return await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const bad = [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > w + 1)
        .map((el) => `${el.tagName.toLowerCase()}.${(el as HTMLElement).className}`.slice(0, 60));
      return { overflowX: Math.max(0, document.documentElement.scrollWidth - w), overflowing: [...new Set(bad)].slice(0, 10) };
    });
  } finally {
    await context.close();
  }
}

export async function renderPdf(html: string, opts: PdfOptions): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext({ javaScriptEnabled: false, offline: false });
  try {
    await context.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.startsWith(FONT_ORIGIN)) {
        const body = fontBytes(url);
        return body ? route.fulfill({ status: 200, body, contentType: "font/woff2" }) : route.abort();
      }
      if (url.startsWith("data:")) return route.continue();
      opts.onBlocked?.(url);
      return route.abort(); // block all other network access (images by URL, trackers, etc.)
    });
    const page = await context.newPage();
    page.setDefaultTimeout(opts.timeoutMs ?? 30_000);
    await page.setContent(withFonts(html), { waitUntil: "load" });
    await page.evaluateHandle("document.fonts.ready").catch(() => undefined); // JS off → no-op; fonts load via 'load'
    const pdf = await page.pdf({
      format: opts.pageSize,
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true, // accessible, structured PDF (headings, reading order)
      outline: true,
    });
    return pdf;
  } finally {
    await context.close();
  }
}
