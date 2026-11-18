/**
 * @file
 * The shopping list: an array of { id, quantity } kept in localStorage.
 *
 * The functions that change the list are pure (they return a new array), so
 * they are easy to unit test (store.test.js). Only load() and save() touch
 * the browser.
 *
 * Data in localStorage can be changed by the visitor, by an old version of
 * this code, or by a browser extension, so it is never trusted: parse()
 * keeps only valid product UUIDs and whole quantities from 1 to 99.
 */

export const STORAGE_KEY = 'verde.shoppingList.v1';
export const MAX_QUANTITY = 99;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Turns the stored JSON text into a clean list. Never throws.
 *
 * @param {string|null} text - The value from localStorage.
 * @returns {Array<{id: string, quantity: number}>} A valid list, maybe empty.
 */
export function parse(text) {
  let data;
  try {
    data = JSON.parse(text ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const seen = new Set();
  const list = [];
  for (const item of data) {
    const id = typeof item?.id === 'string' ? item.id.toLowerCase() : '';
    const quantity = Number(item?.quantity);
    if (!UUID.test(id) || seen.has(id) || !Number.isInteger(quantity) || quantity < 1) continue;
    seen.add(id);
    list.push({ id, quantity: Math.min(quantity, MAX_QUANTITY) });
  }
  return list;
}

/** Whether a product is on the list. */
export const has = (list, id) => list.some((item) => item.id === id);

/** Adds one of a product (or one more, if it is already on the list). */
export function add(list, id) {
  if (!UUID.test(id)) return list;
  return has(list, id)
    ? list.map((item) => (item.id === id ? { ...item, quantity: Math.min(item.quantity + 1, MAX_QUANTITY) } : item))
    : [...list, { id: id.toLowerCase(), quantity: 1 }];
}

/** Removes a product from the list. */
export const remove = (list, id) => list.filter((item) => item.id !== id);

/** Sets the quantity of a product; 0 or less removes it. */
export function setQuantity(list, id, quantity) {
  const value = Math.trunc(Number(quantity));
  if (!Number.isFinite(value) || value < 1) return remove(list, id);
  return list.map((item) => (item.id === id ? { ...item, quantity: Math.min(value, MAX_QUANTITY) } : item));
}

/** The number of items, counting quantities: 2 smoothies + 1 bowl = 3. */
export const count = (list) => list.reduce((sum, item) => sum + item.quantity, 0);

/**
 * Reads the list from storage. Private browsing or blocked storage returns
 * an empty list instead of an error.
 *
 * @param {Storage} [storage] - Defaults to window.localStorage.
 * @returns {Array<{id: string, quantity: number}>} The list.
 */
export function load(storage = globalThis.localStorage) {
  try {
    return parse(storage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

/**
 * Writes the list and tells the page about the change, so every button,
 * counter and the list page update. Other tabs get the browser's own
 * "storage" event.
 *
 * @param {Array<{id: string, quantity: number}>} list - The new list.
 * @param {Storage} [storage] - Defaults to window.localStorage.
 * @returns {boolean} Whether the list was saved.
 */
export function save(list, storage = globalThis.localStorage) {
  let saved = true;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Full or blocked storage: the change still applies to this page.
    saved = false;
  }
  globalThis.dispatchEvent?.(new CustomEvent(CHANGE_EVENT, { detail: list }));
  return saved;
}

/** The event fired on this page after every change. */
export const CHANGE_EVENT = 'verde:shopping-list-change';
