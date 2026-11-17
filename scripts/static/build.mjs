/**
 * Turns Tome's static export into the site published on GitHub Pages.
 *
 *   node scripts/static/build.mjs --export html --api http://127.0.0.1:8888 \
 *     --base /verde-kitchen-drupal --origin https://ivankhamar.github.io [--storybook storybook-static]
 *
 * Why the steps are needed:
 * - GitHub Pages serves this project under a sub-path (/verde-kitchen-drupal/).
 *   Tome exports from the site root, so root-relative URLs (/products) get the
 *   sub-path here, in HTML attributes, srcset, CSS url() and absolute URLs.
 * - GitHub Pages has no PHP, so no JSON:API: the catalog filter reads JSON
 *   files written here (static-data/LANG/*.json), from the same API queries.
 * - GitHub Pages cannot send HTTP headers, so the Content Security Policy goes
 *   into a <meta> tag (frame-ancestors is not possible there).
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildProductsUrl, buildTermsUrl } from '../../web/themes/custom/verde/src/js/catalog-filter/api.js';

const { values: options } = parseArgs({
  options: {
    export: { type: 'string', default: 'html' },
    api: { type: 'string' },
    base: { type: 'string', default: '/verde-kitchen-drupal' },
    origin: { type: 'string', default: 'https://ivankhamar.github.io' },
    storybook: { type: 'string' },
  },
});
if (!options.api) {
  console.error('Pass --api, the URL of the running site to read JSON:API from.');
  process.exit(1);
}

const root = path.resolve(options.export);
const base = options.base.replace(/\/$/, '');
const languages = { en: '', uk: '/uk' };
const csp = "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'";

/** Prefixes a root-relative URL ("/products") with the sub-path; leaves others alone. */
const withBase = (url) =>
  url.startsWith('/') && !url.startsWith('//') && !url.startsWith(`${base}/`) ? base + url : url;

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else yield full;
  }
}

// 1. Remove what visitors should not get: raw JSON:API documents and term pages.
for (const prefix of Object.values(languages)) {
  for (const dir of ['jsonapi', 'taxonomy']) {
    await rm(path.join(root, prefix, dir), { recursive: true, force: true });
  }
}

// 2. Data for the catalog filter, per language, from the same queries the widget uses.
for (const [langcode, prefix] of Object.entries(languages)) {
  const apiBase = `${options.api}${prefix}/jsonapi`;
  const urls = {
    'products.json': buildProductsUrl(apiBase, { langcode }),
    'product_category.json': buildTermsUrl(apiBase, 'product_category'),
    'dietary_tag.json': buildTermsUrl(apiBase, 'dietary_tag'),
  };
  const folder = path.join(root, 'static-data', langcode);
  await mkdir(folder, { recursive: true });
  for (const [file, url] of Object.entries(urls)) {
    const response = await fetch(url, { headers: { Accept: 'application/vnd.api+json' } });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const document = await response.json();
    for (const resource of document.data) {
      if (resource.attributes.card_image_url) {
        resource.attributes.card_image_url = withBase(resource.attributes.card_image_url);
      }
    }
    // Links point to the live API, which the static copy does not have.
    delete document.links;
    await writeFile(path.join(folder, file), JSON.stringify(document));
  }
  console.log(`static-data/${langcode}: ${Object.keys(urls).join(', ')}`);
}

// 3. HTML and CSS: add the sub-path, the CSP meta tag and absolute URLs.
let pages = 0;
for await (const file of files(root)) {
  if (file.endsWith('.html')) {
    let html = await readFile(file, 'utf8');
    html = html
      // Root-relative URLs in attributes, including the widget's data-* settings.
      .replace(
        /\b(href|src|action|poster|data-base-path|data-api-base|data-static-data)="(\/[^"]*)"/g,
        (_, attr, url) => `${attr}="${withBase(url)}"`,
      )
      // srcset lists several "URL width" pairs.
      .replace(
        /\bsrcset="([^"]*)"/g,
        (_, value) =>
          `srcset="${value
            .split(',')
            .map((candidate) => candidate.trim().replace(/^\S+/, (url) => withBase(url)))
            .join(', ')}"`,
      )
      // Absolute URLs: canonical, Open Graph, hreflang, JSON-LD.
      .replaceAll(`${options.origin}/`, `${options.origin}${base}/`)
      .replaceAll(`${options.origin}${base}${base}/`, `${options.origin}${base}/`)
      // drupalSettings.path.baseUrl, written by Drupal with escaped slashes.
      .replace('"baseUrl":"\\/"', `"baseUrl":"${base.replaceAll('/', '\\/')}\\/"`)
      .replace(/<head>/, `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
    await writeFile(file, html);
    pages++;
  } else if (file.endsWith('.css')) {
    const css = await readFile(file, 'utf8');
    await writeFile(
      file,
      css.replace(/url\((['"]?)(\/[^)'"]*)\1\)/g, (_, quote, url) => `url(${quote}${withBase(url)}${quote})`),
    );
  }
}
console.log(`${pages} HTML pages rewritten for ${base}/`);

// 4. Storybook next to the site, and no Jekyll processing on GitHub Pages.
if (options.storybook) {
  await cp(options.storybook, path.join(root, 'storybook'), { recursive: true });
  console.log('Storybook copied to storybook/');
}
await writeFile(path.join(root, '.nojekyll'), '');
