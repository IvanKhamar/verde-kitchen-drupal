/**
 * Checks every story of the built Storybook (storybook-static/):
 * - the story renders without an error;
 * - axe-core finds no critical or serious accessibility issue in it.
 *
 *   npm run build-storybook
 *   CHROME_PATH="/path/to/chrome" npm run test:storybook [-- --screenshots <dir>]
 *
 * It serves storybook-static/ itself on a free local port, so nothing else
 * needs to run. Exit code 1 when a story fails.
 */
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { startBrowser, waitUntil } from './lib/cdp.mjs';

const root = path.resolve('storybook-static');
const shotsIndex = process.argv.indexOf('--screenshots');
const shotsDir = shotsIndex > -1 ? process.argv[shotsIndex + 1] : null;
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

if (!process.env.CHROME_PATH) {
  console.error('Set CHROME_PATH to a Chrome or Edge executable.');
  process.exit(1);
}

// A tiny static file server for storybook-static/.
const server = createServer(async (request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  try {
    await stat(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const index = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story');
const axeSource = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const browser = await startBrowser(process.env.CHROME_PATH);
const failures = [];
try {
  await browser.page('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 800,
    mobile: false,
    deviceScaleFactor: 1,
  });
  if (shotsDir) await mkdir(shotsDir, { recursive: true });

  for (const story of stories) {
    await browser.open(`${base}/iframe.html?id=${story.id}&viewMode=story`);
    try {
      await waitUntil(
        browser.evaluate,
        "document.querySelector('#storybook-root')?.childNodes.length > 0 || document.body.classList.contains('sb-show-errordisplay')",
      );
    } catch {
      failures.push(`${story.id}: did not render`);
      continue;
    }
    // Storybook shows its own error screen; the Twig plugin prints its errors as text.
    const renderError = await browser.evaluate(`document.body.classList.contains('sb-show-errordisplay')
      ? document.querySelector('#error-message')?.textContent ?? 'error'
      : (/An error occurred whilst rendering/.test(document.querySelector('#storybook-root').textContent)
        ? document.querySelector('#storybook-root').textContent : '')`);
    if (renderError) {
      failures.push(`${story.id}: render error: ${renderError.trim().slice(0, 300)}`);
      continue;
    }

    await browser.evaluate(`window.axe || (0, eval)(${JSON.stringify(axeSource)}), true`);
    // Storybook's a11y addon runs its own axe check after each render. axe allows
    // one run at a time, so wait for that run to finish, then run ours.
    const violations = await browser.evaluate(`(async () => {
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          const result = await axe.run('#storybook-root', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
          return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
        } catch (error) {
          if (!String(error).includes('already running')) throw error;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      throw new Error('axe stayed busy');
    })()`);
    const blocking = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    blocking.forEach((v) => failures.push(`${story.id}: axe ${v.id} (${v.impact}, ${v.nodes} elements)`));
    console.log(
      `${blocking.length ? '✖' : '✔'} ${story.id}${violations.length ? ` (${violations.map((v) => v.id).join(', ')})` : ''}`,
    );

    if (shotsDir) {
      const { data } = await browser.page('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(shotsDir, `${story.id}.png`), Buffer.from(data, 'base64'));
    }
  }
} finally {
  await browser.close();
  // Also drop keep-alive connections a leftover browser process may hold.
  server.closeAllConnections();
  server.close();
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nAll ${stories.length} stories render and pass axe.`);
