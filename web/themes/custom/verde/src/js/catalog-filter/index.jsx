/**
 * @file
 * Mounts the React catalog filter on the product catalog page.
 *
 * Drupal loads this file through the library verde/catalog-filter, which only
 * the catalog page attaches (views-view--products--page-catalog.html.twig).
 *
 * Progressive enhancement: the page already contains a server-rendered list of
 * products. It stays visible while the widget loads, and if JavaScript or the
 * API fails. After the first successful API response the widget shows its own
 * results and the fallback list is hidden.
 */
import { createRoot } from 'react-dom/client';
import CatalogFilter from './CatalogFilter.jsx';

const { Drupal, once } = window;
const roots = new Map();

Drupal.behaviors.verdeCatalogFilter = {
  attach(context) {
    // once() returns only elements not processed before, so a second attach()
    // (for example after an AJAX request) does not mount React twice.
    once('verde-catalog-filter', '[data-catalog-filter]', context).forEach((element) => {
      const fallback = document.getElementById(element.dataset.fallbackId);
      const hideFallback = () => {
        if (fallback) fallback.hidden = true;
      };

      const root = createRoot(element);
      root.render(
        <CatalogFilter apiBase={element.dataset.apiBase} basePath={element.dataset.basePath} onReady={hideFallback} />,
      );
      roots.set(element, root);
    });
  },

  // Unmount React when Drupal removes this part of the page.
  detach(context, settings, trigger) {
    if (trigger !== 'unload') return;
    once.remove('verde-catalog-filter', '[data-catalog-filter]', context).forEach((element) => {
      roots.get(element)?.unmount();
      roots.delete(element);
    });
  },
};
