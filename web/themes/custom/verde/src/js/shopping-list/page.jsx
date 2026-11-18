/**
 * @file
 * Mounts the shopping list page (library verde/shopping-list-page).
 */
import { createRoot } from 'react-dom/client';
import ShoppingListPage from './ShoppingListPage.jsx';

const { Drupal, once } = window;

Drupal.behaviors.verdeShoppingListPage = {
  attach(context) {
    once('verde-shopping-list-page', '[data-shopping-list-page]', context).forEach((element) => {
      createRoot(element).render(
        <ShoppingListPage
          apiBase={element.dataset.apiBase}
          staticData={element.dataset.staticData}
          basePath={element.dataset.basePath}
          langcode={document.documentElement.lang || 'en'}
        />,
      );
    });
  },
};
