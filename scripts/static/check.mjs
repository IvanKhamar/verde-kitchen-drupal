/**
 * Checks the static site before it is published:
 * - serves the folder under the GitHub Pages sub-path, like GitHub does;
 * - follows every internal link, image, script and stylesheet from the home
 *   page and fails on anything that is not found;
 * - with CHROME_PATH set, opens the catalog in both languages and checks that
 *   the filter works on the exported JSON files.
 *
 *   CHROME_PATH=/path/to/chrome node scripts/static/check.mjs --dir html --base /verde-kitchen-drupal
 */
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { startBrowser, waitUntil } from '../lib/cdp.mjs';

const { values: options } = parseArgs({
  options: { dir: { type: 'string', default: 'html' }, base: { type: 'string', default: '/verde-kitchen-drupal' } },
});
const root = path.resolve(options.dir);
const base = options.base.replace(/\/$/, '');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Maps a URL path to a file, as GitHub Pages does: /a/ and /a serve /a/index.html. */
async function resolveFile(urlPath) {
  if (!urlPath.startsWith(`${base}/`) && urlPath !== base) return null;
  const relative = decodeURIComponent(urlPath.slice(base.length)) || '/';
  const candidate = path.join(root, relative);
  if (!candidate.startsWith(root)) return null;
  for (const file of [candidate, path.join(candidate, 'index.html')]) {
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

const server = createServer(async (request, response) => {
  const file = await resolveFile(new URL(request.url, 'http://localhost').pathname);
  if (!file) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// Crawl internal URLs.
const broken = [];
const seen = new Set();
const queue = [`${base}/`];
const urlsIn = (text) => [
  ...[...text.matchAll(/\b(?:href|src)="([^"#]+)"/g)].map((m) => m[1]),
  ...[...text.matchAll(/\bsrcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((c) => c.trim().split(/\s+/)[0])),
  ...[...text.matchAll(/url\(['"]?([^)'"]+)['"]?\)/g)].map((m) => m[1]),
];
while (queue.length) {
  const url = queue.shift();
  const pathname = new URL(url, origin).pathname;
  if (seen.has(pathname)) continue;
  seen.add(pathname);
  const file = await resolveFile(pathname);
  if (!file) {
    broken.push(url);
    continue;
  }
  if (file.endsWith('.html') || file.endsWith('.css')) {
    for (const found of urlsIn(await readFile(file, 'utf8'))) {
      if (found.startsWith('/') && !found.startsWith('//')) {
        queue.push(found);
      } else if (!/^(https?:|data:|mailto:|#)/.test(found) && file.endsWith('.css')) {
        // Relative url() in CSS: resolve against the stylesheet's own path.
        queue.push(new URL(found, origin + pathname).pathname);
      }
    }
  }
}
console.log(`Checked ${seen.size} URLs, ${broken.length} not found.`);
broken.forEach((url) => console.log(`  not found: ${url}`));

// The catalog filter on the exported JSON files.
const problems = [...broken.map((url) => `not found: ${url}`)];

// The contact pages: a notice instead of the form, because nothing on GitHub
// Pages could receive it.
for (const prefix of ['', '/uk']) {
  const file = await resolveFile(`${base}${prefix}/contact`);
  const html = file ? await readFile(file, 'utf8') : '';
  if (!html.includes('contact-static-notice') || html.includes('contact-form')) {
    problems.push(`${prefix || '(en)'}/contact: expected the static notice instead of the form`);
  }
}
if (process.env.CHROME_PATH) {
  const browser = await startBrowser(process.env.CHROME_PATH);
  try {
    for (const [prefix, all, search, found] of [
      ['', '14 products found', 'bowl', '3 products found'],
      ['/uk', 'Знайдено 14 продуктів', 'боул', 'Знайдено 3 продукти'],
    ]) {
      await browser.open(`${origin}${base}${prefix}/products`);
      const statusText = "document.querySelector('.catalog-filter__status')?.textContent";
      try {
        await waitUntil(browser.evaluate, `${statusText} === ${JSON.stringify(all)}`);
        await browser.evaluate(`(() => {
          const input = document.querySelector('.catalog-filter input[type=search]');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(search)});
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        })()`);
        await waitUntil(browser.evaluate, `${statusText} === ${JSON.stringify(found)}`);
        console.log(`✔ catalog filter${prefix || ' (en)'}: "${search}" → ${found}`);
      } catch {
        problems.push(`catalog filter${prefix}: status is "${await browser.evaluate(statusText)}"`);
      }
    }

    // The shopping list: add two products on the catalog, then the list page
    // shows them from the exported JSON (the list is in localStorage).
    try {
      await browser.evaluate(
        "[...document.querySelectorAll('[data-shopping-list-toggle]')].slice(0, 2).forEach((b) => b.click()), true",
      );
      await browser.open(`${origin}${base}/uk/shopping-list`);
      await waitUntil(browser.evaluate, "document.querySelectorAll('.shopping-list__item').length === 2");
      console.log('✔ shopping list/uk: 2 products from the static data');
    } catch {
      problems.push('shopping list: the list page did not show the 2 added products');
    }
  } finally {
    await browser.close();
  }
}

server.closeAllConnections();
server.close();
if (problems.length) {
  console.error(`\nProblems:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('Static site OK.');
