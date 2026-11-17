import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildProductsByIdUrl,
  fetchJsonApi,
  formatPrice,
  parseProducts,
  staticDataUrls,
} from '../catalog-filter/api.js';
import { CHANGE_EVENT, load, MAX_QUANTITY, remove, save, setQuantity, STORAGE_KEY } from './store.js';

// Drupal stays a global here: see the note in index.js.

/**
 * Keeps React state in sync with the stored list: changes from this page,
 * from "Add to list" buttons and from other tabs all end up here.
 *
 * @returns {Array<{id: string, quantity: number}>} The current list.
 */
function useShoppingList() {
  const [list, setList] = useState(() => load());
  useEffect(() => {
    const onChange = (event) => setList(event.detail);
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setList(load());
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return list;
}

/**
 * The shopping list page: products on the list with quantities, prices and a
 * total. The list (IDs and quantities) is in localStorage; names, images and
 * prices come from JSON:API, or from the exported JSON in the static copy.
 *
 * @param {object} props - Component props.
 * @param {string} props.apiBase - JSON:API root for the page language.
 * @param {string} [props.staticData] - Folder of exported JSON (static copy).
 * @param {string} props.basePath - Front page path for the page language.
 * @param {string} props.langcode - Page language.
 * @returns {JSX.Element} The page.
 */
export default function ShoppingListPage({ apiBase, staticData, basePath, langcode }) {
  const list = useShoppingList();
  const [products, setProducts] = useState({});
  const [loaded, setLoaded] = useState({ key: null, failed: false });
  const [confirmClear, setConfirmClear] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const clearButton = useRef(null);
  const cancelButton = useRef(null);
  const confirmWasOpen = useRef(false);

  // "Clear list" is replaced by the question, so focus moves to "Cancel" (the
  // safe choice); when the question closes, it goes back to "Clear list".
  useEffect(() => {
    if (confirmClear) {
      confirmWasOpen.current = true;
      cancelButton.current?.focus();
    } else if (confirmWasOpen.current) {
      confirmWasOpen.current = false;
      clearButton.current?.focus();
    }
  }, [confirmClear]);

  // Load product data only when the set of products changes, not the quantities.
  const ids = useMemo(() => list.map((item) => item.id).sort(), [list]);
  const requestKey = JSON.stringify([ids, attempt]);

  useEffect(() => {
    if (ids.length === 0) return undefined;
    const controller = new AbortController();
    const url = staticData ? staticDataUrls(staticData).products : buildProductsByIdUrl(apiBase, ids, langcode);
    fetchJsonApi(url, controller.signal)
      .then((document) => {
        const found = Object.fromEntries(
          parseProducts(document, basePath)
            .filter((product) => ids.includes(product.id))
            .map((product) => [product.id, product]),
        );
        setProducts(found);
        setLoaded({ key: requestKey, failed: false });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLoaded({ key: requestKey, failed: true });
      });
    return () => controller.abort();
  }, [apiBase, staticData, basePath, langcode, ids, requestKey]);

  const isLoading = ids.length > 0 && loaded.key !== requestKey;
  const failed = ids.length > 0 && loaded.key === requestKey && loaded.failed;
  // Products that no longer exist (or are unpublished) are not shown.
  const items = list.filter((item) => products[item.id]);
  const total = items.reduce((sum, item) => sum + Number(products[item.id].price) * item.quantity, 0);

  // Quantity stays between 1 and MAX_QUANTITY; "Remove" takes a product away.
  // The step buttons use aria-disabled, not disabled, at the limits: a disabled
  // button drops keyboard focus to the page body.
  const changeQuantity = (item, quantity) => {
    if (quantity < 1 || quantity > MAX_QUANTITY) return;
    save(setQuantity(list, item.id, quantity));
    Drupal.announce(Drupal.t('@product: @quantity', { '@product': products[item.id].title, '@quantity': quantity }));
  };

  const removeItem = (item) => {
    save(remove(list, item.id));
    Drupal.announce(Drupal.t('@product removed from your shopping list.', { '@product': products[item.id].title }));
  };

  const clearList = () => {
    save([]);
    setConfirmClear(false);
    Drupal.announce(Drupal.t('Your shopping list is empty now.'));
  };

  if (list.length === 0) {
    return (
      <div className="shopping-list shopping-list--empty">
        <p>{Drupal.t('Your shopping list is empty.')}</p>
        <a className="button button--primary" href={`${basePath.replace(/\/$/, '')}/products`}>
          {Drupal.t('Browse products')}
        </a>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="shopping-list" role="alert">
        <p>{Drupal.t('The products could not be loaded.')}</p>
        <button type="button" className="button button--primary" onClick={() => setAttempt((n) => n + 1)}>
          {Drupal.t('Try again')}
        </button>
      </div>
    );
  }

  return (
    <div className="shopping-list" aria-busy={isLoading}>
      {isLoading && items.length === 0 ? (
        <p role="status">{Drupal.t('Loading your list…')}</p>
      ) : (
        <>
          <ul className="shopping-list__items" role="list">
            {items.map((item) => {
              const product = products[item.id];
              return (
                <li key={item.id} className="shopping-list__item">
                  {product.image && (
                    <img
                      className="shopping-list__image"
                      src={product.image.url}
                      alt=""
                      width="96"
                      height="72"
                      loading="lazy"
                    />
                  )}
                  <div className="shopping-list__info">
                    <a className="shopping-list__title" href={product.url}>
                      {product.title}
                    </a>
                    <span className="shopping-list__unit-price">{formatPrice(product.price, langcode)}</span>
                  </div>
                  {/* A group, so screen readers say what the buttons belong to. */}
                  <div
                    className="shopping-list__quantity"
                    role="group"
                    aria-label={Drupal.t('Quantity of @product', { '@product': product.title })}
                  >
                    <button
                      type="button"
                      className="shopping-list__step"
                      onClick={() => changeQuantity(item, item.quantity - 1)}
                      aria-disabled={item.quantity <= 1}
                      aria-label={Drupal.t('One less')}
                    >
                      −
                    </button>
                    <span className="shopping-list__count">{item.quantity}</span>
                    <button
                      type="button"
                      className="shopping-list__step"
                      onClick={() => changeQuantity(item, item.quantity + 1)}
                      aria-disabled={item.quantity >= MAX_QUANTITY}
                      aria-label={Drupal.t('One more')}
                    >
                      +
                    </button>
                  </div>
                  <span className="shopping-list__line-total">
                    {formatPrice(String(Number(product.price) * item.quantity), langcode)}
                  </span>
                  <button type="button" className="shopping-list__remove" onClick={() => removeItem(item)}>
                    {Drupal.t('Remove')}
                    <span className="shopping-list__context">: {product.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="shopping-list__summary">
            <p className="shopping-list__total">
              {Drupal.t('Estimated total')}: <strong>{formatPrice(String(total), langcode)}</strong>
            </p>
            <div className="shopping-list__actions">
              <button type="button" className="button button--primary" onClick={() => window.print()}>
                {Drupal.t('Print list')}
              </button>
              {confirmClear ? (
                <span className="shopping-list__confirm" role="group" aria-label={Drupal.t('Clear the list?')}>
                  <span>{Drupal.t('Clear the list?')}</span>
                  <button type="button" className="button button--primary" onClick={clearList}>
                    {Drupal.t('Yes, clear')}
                  </button>
                  <button
                    ref={cancelButton}
                    type="button"
                    className="button button--secondary"
                    onClick={() => setConfirmClear(false)}
                  >
                    {Drupal.t('Cancel')}
                  </button>
                </span>
              ) : (
                <button
                  ref={clearButton}
                  type="button"
                  className="button button--secondary"
                  onClick={() => setConfirmClear(true)}
                >
                  {Drupal.t('Clear list')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
