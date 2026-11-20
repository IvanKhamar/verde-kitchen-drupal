/**
 * Runs Lighthouse and axe-core against the site and writes a summary.
 *
 *   CHROME_PATH="/path/to/chrome" BASE_URL="http://127.0.0.1:12345" npm run audit:site
 *
 * - Lighthouse (mobile preset: emulated phone, slow 4G, 4x slower CPU) for
 *   Performance, Accessibility, Best Practices and SEO. HTML reports go to reports/.
 * - axe-core, the engine behind most accessibility checkers, on every page at
 *   360px and 1280px, plus interactive states: the mobile menu open and the
 *   catalog filter showing results.
 * - The summary goes to docs/audit-results.md.
 *
 * The exit code is 1 when a target is missed: a Lighthouse score under 90 or
 * any "critical" or "serious" axe violation.
 * --skip-performance leaves Performance out of the targets (for CI, where
 * shared machines make timing scores unreliable).
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { extraChromeFlags, startBrowser, waitUntil } from './lib/cdp.mjs';

const chromePath = process.env.CHROME_PATH;
const baseUrl = (process.env.BASE_URL ?? '').replace(/\/$/, '');
const skipPerformance = process.argv.includes('--skip-performance');
const reportDir = 'reports';
const summaryFile = 'docs/audit-results.md';
const TARGET = 90;

if (!chromePath || !baseUrl) {
  console.error('Set CHROME_PATH and BASE_URL. See the comment at the top of this file.');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const lighthouseVersion = JSON.parse(await readFile(require.resolve('lighthouse/package.json'), 'utf8')).version;
const axeVersion = JSON.parse(await readFile(require.resolve('axe-core/package.json'), 'utf8')).version;

const viewports = {
  mobile: { width: 360, height: 800, mobile: true, deviceScaleFactor: 2 },
  desktop: { width: 1280, height: 900, mobile: false, deviceScaleFactor: 1 },
};
const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
const failures = [];

// --- Find the pages --------------------------------------------------------------
const browser = await startBrowser(chromePath);
// On /products React replaces the server list with its own cards, so wait for a card.
const firstCard = async () => {
  await waitUntil(browser.evaluate, "document.querySelector('.card__link') !== null");
  return browser.evaluate("document.querySelector('.card__link').getAttribute('href')");
};
await browser.open(`${baseUrl}/products`);
const productPath = await firstCard();
await browser.open(`${baseUrl}/articles`);
const articlePath = await firstCard();
const pages = [
  ['Home', '/'],
  ['Catalog', '/products'],
  ['Product', productPath],
  ['Article', articlePath],
  ['Home, Ukrainian', '/uk'],
  ['Catalog, Ukrainian', '/uk/products'],
  ['Shopping list', '/shopping-list'],
  ['Contact', '/contact'],
  ['Contact, Ukrainian', '/uk/contact'],
];

// --- axe -------------------------------------------------------------------------
// Rules for WCAG 2.0/2.1 levels A and AA, plus axe's best practices.
const axeOptions = { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] };

async function runAxe(label) {
  await browser.evaluate(`window.axe || (0, eval)(${JSON.stringify(axeSource)}), true`);
  const result = await browser.evaluate(
    `axe.run(document, ${JSON.stringify(axeOptions)}).then((r) => r.violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    })))`,
  );
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  result.forEach((violation) => {
    counts[violation.impact] += violation.nodes;
  });
  if (counts.critical + counts.serious > 0) {
    failures.push(`axe: ${label} has ${counts.critical} critical and ${counts.serious} serious issues`);
  }
  return { label, counts, violations: result };
}

const axeResults = [];
try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    await browser.page('Emulation.setDeviceMetricsOverride', viewport);
    for (const [name, pagePath] of pages) {
      await browser.open(baseUrl + pagePath);
      if (name.startsWith('Catalog')) {
        // Wait until the React widget has loaded its data.
        await waitUntil(
          browser.evaluate,
          "/(found|Знайдено)/.test(document.querySelector('.catalog-filter__status')?.textContent ?? '')",
        );
      }
      if (name.startsWith('Shopping list')) {
        // The React list page renders after the scripts load (an empty list here).
        await waitUntil(browser.evaluate, "document.querySelector('.shopping-list') !== null");
      }
      axeResults.push(await runAxe(`${name} (${viewportName})`));
    }
  }

  // Interactive states, at phone width.
  await browser.page('Emulation.setDeviceMetricsOverride', viewports.mobile);
  await browser.open(`${baseUrl}/`);
  await browser.evaluate("document.querySelector('.navigation__toggle').click(), true");
  await waitUntil(
    browser.evaluate,
    "document.querySelector('.navigation__toggle').getAttribute('aria-expanded') === 'true'",
  );
  axeResults.push(await runAxe('Home, mobile menu open (mobile)'));

  await browser.open(`${baseUrl}/products`);
  await waitUntil(
    browser.evaluate,
    "/(found|Знайдено)/.test(document.querySelector('.catalog-filter__status')?.textContent ?? '')",
  );
  // Tick the first dietary tag the way a user would (React listens to real events).
  await browser.evaluate("document.querySelector('.catalog-filter__tag input').click(), true");
  await waitUntil(browser.evaluate, "document.querySelector('.catalog-filter__results') !== null");
  axeResults.push(await runAxe('Catalog, filter applied (mobile)'));

  // The shopping list with products in it: add two from the catalog cards.
  await browser.evaluate(
    "[...document.querySelectorAll('[data-shopping-list-toggle]')].slice(0, 2).forEach((b) => b.click()), true",
  );
  await browser.open(`${baseUrl}/shopping-list`);
  await waitUntil(browser.evaluate, "document.querySelectorAll('.shopping-list__item').length === 2");
  axeResults.push(await runAxe('Shopping list with products (mobile)'));
  // "Clear list" asks first; check the question too.
  await browser.evaluate("document.querySelector('.shopping-list__actions button:last-child').click(), true");
  await waitUntil(browser.evaluate, "document.querySelector('.shopping-list__confirm') !== null");
  axeResults.push(await runAxe('Shopping list, clear confirmation (mobile)'));

  // The contact form sent empty: the error summary and the inline errors.
  await browser.open(`${baseUrl}/contact`);
  await browser.evaluate("document.querySelector('.contact-form [type=submit]').click(), true");
  await waitUntil(browser.evaluate, "document.querySelector('.messages--error') !== null");
  axeResults.push(await runAxe('Contact, form with errors (mobile)'));
} finally {
  await browser.close();
}

// --- Lighthouse ------------------------------------------------------------------
await mkdir(reportDir, { recursive: true });
const lighthouseResults = [];
for (const [name, pagePath] of pages) {
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', ...extraChromeFlags] });
  try {
    const { lhr, report } = await lighthouse(baseUrl + pagePath, {
      port: chrome.port,
      output: 'html',
      logLevel: 'error',
      onlyCategories: categories,
    });
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '-');
    await writeFile(path.join(reportDir, `lighthouse-${slug}.html`), report);
    const scores = Object.fromEntries(categories.map((id) => [id, Math.round(lhr.categories[id].score * 100)]));
    const metrics = {
      lcp: lhr.audits['largest-contentful-paint'].displayValue,
      cls: lhr.audits['cumulative-layout-shift'].displayValue,
      tbt: lhr.audits['total-blocking-time'].displayValue,
    };
    for (const id of categories) {
      if (id === 'performance' && skipPerformance) continue;
      if (scores[id] < TARGET) failures.push(`Lighthouse: ${name} ${id} is ${scores[id]}`);
    }
    lighthouseResults.push({ name, pagePath, scores, metrics });
    console.log(name, scores, metrics);
  } finally {
    await chrome.kill();
  }
}

// --- Summary ---------------------------------------------------------------------
const date = new Date().toISOString().slice(0, 10);
const lines = [
  '# Audit results',
  '',
  `Generated by \`scripts/audit.mjs\` on ${date} with Lighthouse ${lighthouseVersion} and axe-core ${axeVersion},`,
  'against the local DDEV site (nginx, PHP 8.4, page cache on, CSS/JS aggregation on).',
  '',
  '## Lighthouse (mobile)',
  '',
  'Mobile preset: emulated mid-range phone, slow 4G, 4x CPU slowdown. Target: 90 or more.',
  '',
  '| Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
  '| ---- | ----------: | ------------: | -------------: | --: | --: | --: | --: |',
  ...lighthouseResults.map(
    ({ name, scores, metrics }) =>
      `| ${name} | ${scores.performance} | ${scores.accessibility} | ${scores['best-practices']} | ${scores.seo} | ${metrics.lcp} | ${metrics.cls} | ${metrics.tbt} |`,
  ),
  '',
  '## axe-core',
  '',
  'Rules: WCAG 2.0 and 2.1, levels A and AA, plus best practices. Target: no critical or serious issues.',
  'The numbers count affected elements.',
  '',
  '| Page and state | Critical | Serious | Moderate | Minor |',
  '| -------------- | -------: | ------: | -------: | ----: |',
  ...axeResults.map(
    ({ label, counts }) =>
      `| ${label} | ${counts.critical} | ${counts.serious} | ${counts.moderate} | ${counts.minor} |`,
  ),
  '',
];
const remaining = axeResults.flatMap(({ label, violations }) => violations.map((v) => ({ label, ...v })));
if (remaining.length > 0) {
  lines.push('### Remaining axe findings', '');
  remaining.forEach(({ label, id, impact, help, targets }) => {
    lines.push(`- **${label}**: \`${id}\` (${impact}): ${help}. Elements: \`${targets.join('`, `')}\``);
  });
  lines.push('');
}
await writeFile(summaryFile, lines.join('\n'));
console.log(`\nSummary: ${summaryFile}, reports: ${reportDir}/`);

if (failures.length > 0) {
  console.error(`\nTargets missed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('All targets met.');
