/**
 * A minimal Chrome DevTools Protocol (CDP) client, shared by the screenshot and
 * audit scripts. CDP is the protocol DevTools itself uses to control Chromium
 * browsers (Chrome, Edge) over a WebSocket. Node 22+ has WebSocket built in, so
 * no npm package is needed.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Starts a headless browser and opens one tab (a CDP "page" session).
 *
 * @param {string} chromePath - Path to the Chrome or Edge executable.
 * @returns {Promise<object>} { page, evaluate, open, close }.
 */
export async function startBrowser(chromePath) {
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'verde-cdp-'));
  const browser = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--hide-scrollbars',
    'about:blank',
  ]);

  // The browser prints its WebSocket address on stderr.
  const wsUrl = await new Promise((resolve, reject) => {
    let output = '';
    browser.stderr.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    browser.on('exit', (code) => reject(new Error(`Browser exited with code ${code}`)));
  });

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

  const send = (method, params = {}, sessionId = undefined) =>
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

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  await page('Page.enable');

  /** Runs JavaScript in the page and returns its (awaited) result. */
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await page('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }
    return result.value;
  };

  /** Navigates and waits for the load event. */
  const open = async (url) => {
    const loaded = waitFor('Page.loadEventFired', sessionId);
    await page('Page.navigate', { url });
    await loaded;
  };

  const close = async () => {
    socket.close();
    browser.kill();
    // Windows keeps the profile locked for a moment after the browser exits.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  };

  return { page, evaluate, open, close };
}

/** Waits until `check()` returns a truthy value in the page, or times out. */
export async function waitUntil(evaluate, check, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(check)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for: ${check}`);
}
