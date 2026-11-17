/**
 * @file
 * "Add to list" buttons and the header counter, on every page.
 *
 * Plain JavaScript, no React: it runs on every page, so it stays small.
 * - One click listener on the document handles every button, including the
 *   ones React renders later in the catalog filter (event delegation).
 * - A MutationObserver sets the right label on buttons that appear later.
 * - Changes in other tabs arrive as the browser's "storage" event.
 * - Drupal.announce() tells screen reader users what changed.
 */
import { add, CHANGE_EVENT, count, has, load, remove, save, STORAGE_KEY } from './store.js';

// Drupal is used as a global, never copied into a local variable: the minifier
// would rename the copy, and Drupal finds strings to translate only in literal
// Drupal.t() and Drupal.formatPlural() calls in the built file.
const { once } = window;
let list = load();

/** Shows "Add to list" or "Remove from list" on one button. */
function updateButton(button) {
  const inList = has(list, button.dataset.productId);
  button.classList.toggle('is-in-list', inList);
  button.querySelector('[data-label="add"]')?.toggleAttribute('hidden', inList);
  button.querySelector('[data-label="remove"]')?.toggleAttribute('hidden', !inList);
}

/** Updates every button and counter inside an element. */
function refresh(root = document) {
  root.querySelectorAll?.('[data-shopping-list-toggle]').forEach(updateButton);
  const total = count(list);
  document.querySelectorAll('[data-shopping-list-count]').forEach((badge) => {
    badge.textContent = total > 0 ? String(total) : '';
    badge.hidden = total === 0;
  });
  document.querySelectorAll('[data-shopping-list-link]').forEach((link) => {
    // The name keeps the visible words "Shopping list" (WCAG 2.5.3).
    link.setAttribute(
      'aria-label',
      total > 0
        ? Drupal.formatPlural(total, 'Shopping list, 1 item', 'Shopping list, @count items')
        : Drupal.t('Shopping list, empty'),
    );
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-shopping-list-toggle]');
  if (!button) return;
  const id = button.dataset.productId;
  const product = button.dataset.productTitle;
  if (has(list, id)) {
    list = remove(list, id);
    Drupal.announce(Drupal.t('@product removed from your shopping list.', { '@product': product }));
  } else {
    list = add(list, id);
    Drupal.announce(Drupal.t('@product added to your shopping list.', { '@product': product }));
  }
  save(list);
});

// A change on this page (also from the list page), or in another tab.
window.addEventListener(CHANGE_EVENT, (event) => {
  list = event.detail;
  refresh();
});
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    list = load();
    refresh();
  }
});

// Buttons that React adds to the page later get the right label at once.
new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches('[data-shopping-list-toggle]')) updateButton(node);
        refresh(node);
      }
    });
  }
}).observe(document.documentElement, { childList: true, subtree: true });

Drupal.behaviors.verdeShoppingList = {
  attach(context) {
    once('verde-shopping-list', 'html', context).forEach(() => refresh());
    refresh(context);
  },
};
