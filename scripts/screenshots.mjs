/**
 * Takes full-page screenshots of the site at phone, tablet and desktop widths.
 *
 * Emulation.setDeviceMetricsOverride gives a real mobile viewport, which a small
 * desktop window cannot (Chromium windows have a minimum width).
 *
 * Usage:
 *   CHROME_PATH="/path/to/chrome" BASE_URL="http://127.0.0.1:12345" \
 *     node scripts/screenshots.mjs [output-dir]
 *
 * BASE_URL: the site address; `ddev describe` shows a direct 127.0.0.1 URL.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startBrowser } from './lib/cdp.mjs';

const chromePath = process.env.CHROME_PATH;
const baseUrl = (process.env.BASE_URL ?? '').replace(/\/$/, '');
const outDir = process.argv[2] ?? 'docs/screenshots';

if (!chromePath || !baseUrl) {
  console.error('Set CHROME_PATH and BASE_URL. See the comment at the top of this file.');
  process.exit(1);
}

const viewports = {
  mobile: { width: 360, height: 800, mobile: true, deviceScaleFactor: 2 },
  tablet: { width: 768, height: 1024, mobile: true, deviceScaleFactor: 1 },
  desktop: { width: 1280, height: 900, mobile: false, deviceScaleFactor: 1 },
};

const firstCardLink = "document.querySelector('.card__link').getAttribute('href')";
// [name, path] or [name, listing path to take the first card's link from].
const pages = [
  ['home', '/'],
  ['catalog', '/products'],
  ['product', '/products', firstCardLink],
  ['article', '/articles', firstCardLink],
];

const browser = await startBrowser(chromePath);
try {
  await mkdir(outDir, { recursive: true });
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    await browser.page('Emulation.setDeviceMetricsOverride', viewport);
    for (const [pageName, pagePath, linkExpression] of pages) {
      await browser.open(baseUrl + pagePath);
      if (linkExpression) {
        await browser.open(baseUrl + (await browser.evaluate(linkExpression)));
      }
      // Scroll through the page, so lazy images load before the screenshot.
      await browser.evaluate(`(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
          scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 100));
        }
        scrollTo(0, 0);
        // decode() waits until an image is ready to paint. A hidden lazy image
        // never loads, so give up after 3 seconds instead of waiting forever.
        const decoded = Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
        await Promise.race([decoded, new Promise((r) => setTimeout(r, 3000))]);
      })()`);
      const { cssContentSize } = await browser.page('Page.getLayoutMetrics');
      const { data } = await browser.page('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: viewport.width, height: Math.ceil(cssContentSize.height), scale: 1 },
      });
      const file = path.join(outDir, `${pageName}-${viewportName}.png`);
      await writeFile(file, Buffer.from(data, 'base64'));
      console.log(file);
    }
  }
} finally {
  await browser.close();
}
