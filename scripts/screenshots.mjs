/**
 * Takes full-page screenshots of the site at phone, tablet and desktop widths.
 *
 * It starts a local Chromium-based browser (Chrome or Edge) in headless mode and
 * drives it through the Chrome DevTools Protocol (CDP) over a WebSocket, with no
 * extra npm packages. Emulation.setDeviceMetricsOverride gives a real mobile
 * viewport, which a small desktop window cannot (Chromium windows have a minimum width).
 *
 * Usage:
 *   CHROME_PATH="/path/to/chrome" BASE_URL="http://127.0.0.1:12345" \
 *     node scripts/screenshots.mjs [output-dir]
 *
 * BASE_URL: the site address; `ddev describe` shows a direct 127.0.0.1 URL.
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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

// name -> path, or a function that finds the path on an already open page.
const pages = [
  ['home', '/'],
  ['catalog', '/products'],
  ['product', async (cdp) => cdp.evaluate("document.querySelector('.card__link').getAttribute('href')"), '/products'],
  ['article', async (cdp) => cdp.evaluate("document.querySelector('.card__link').getAttribute('href')"), '/articles'],
];

/** Starts the browser and resolves with its DevTools WebSocket URL. */
async function launchBrowser(profileDir) {
  const browser = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--hide-scrollbars',
    'about:blank',
  ]);
  const wsUrl = await new Promise((resolve, reject) => {
    let output = '';
    browser.stderr.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    browser.on('exit', (code) => reject(new Error(`Browser exited with code ${code}`)));
  });
  return { browser, wsUrl };
}

/** A minimal CDP client: send commands, wait for events. */
async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method) {
      listeners.forEach((listener) => listener(message));
    }
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const waitFor = (method, sessionId) =>
    new Promise((resolve) => {
      const listener = (message) => {
        if (message.method === method && message.sessionId === sessionId) {
          listeners.delete(listener);
          resolve(message.params);
        }
      };
      listeners.add(listener);
    });

  return { socket, send, waitFor };
}

const { browser, wsUrl } = await launchBrowser(await mkdtemp(path.join(os.tmpdir(), 'vk-shots-')));
try {
  const { socket, send, waitFor } = await connect(wsUrl);
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const cdp = {
    evaluate: async (expression) => (await page('Runtime.evaluate', { expression, returnByValue: true })).result.value,
  };
  const open = async (url) => {
    const loaded = waitFor('Page.loadEventFired', sessionId);
    await page('Page.navigate', { url });
    await loaded;
    // Give lazy images in the viewport a moment to load.
    await new Promise((resolve) => setTimeout(resolve, 500));
  };
  await page('Page.enable');

  await mkdir(outDir, { recursive: true });
  for (const [name, viewport] of Object.entries(viewports)) {
    await page('Emulation.setDeviceMetricsOverride', viewport);
    for (const [pageName, target, from] of pages) {
      let url = typeof target === 'string' ? target : null;
      if (!url) {
        await open(baseUrl + from);
        url = await target(cdp);
      }
      await open(baseUrl + url);
      const { cssContentSize } = await page('Page.getLayoutMetrics');
      const { data } = await page('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: viewport.width, height: Math.ceil(cssContentSize.height), scale: 1 },
      });
      const file = path.join(outDir, `${pageName}-${name}.png`);
      await writeFile(file, Buffer.from(data, 'base64'));
      console.log(file);
    }
  }
  socket.close();
} finally {
  browser.kill();
}
