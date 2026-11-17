import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  buildProductsUrl,
  buildTermsUrl,
  fetchJsonApi,
  filterByTags,
  filterProducts,
  parseProducts,
  parseTerms,
  staticDataUrls,
} from './api.js';
import ProductCard from './ProductCard.jsx';
import useDebouncedValue from './useDebouncedValue.js';

// Strings are passed to Drupal.t() and Drupal.formatPlural() as literals:
// Drupal scans the JavaScript files of a library for these calls, and only
// strings it finds there get Ukrainian translations in the browser.

const EMPTY_FILTERS = { search: '', category: '', tags: [] };

/**
 * Product catalog filter: search by name, category select and dietary tag
 * checkboxes, with results from JSON:API.
 *
 * States: "loading" (first load or a new request), "success", "error".
 * An empty result is a success with no products.
 *
 * @param {object} props - Component props.
 * @param {string} props.apiBase - JSON:API root, for example "/jsonapi".
 * @param {string} [props.staticData] - Folder of exported JSON files; set only
 *   in the static copy, which has no JSON:API.
 * @param {string} props.basePath - Front page path for the current language,
 *   "/" or "/uk": product links get the same language prefix.
 * @param {string} props.langcode - Current language, "en" or "uk".
 * @param {Function} props.onLiveResultsChange - Called with true when the widget
 *   shows its own results, and false when the server-rendered list should show.
 * @returns {JSX.Element} The widget.
 */
export default function CatalogFilter({ apiBase, staticData, basePath, langcode, onLiveResultsChange }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [terms, setTerms] = useState({ categories: [], tags: [] });
  const [termsFailed, setTermsFailed] = useState(false);
  // The last finished products request: which request it was ("key"), and
  // its outcome. Products from the last success stay while a new request runs.
  const [result, setResult] = useState({ key: null, products: [], failed: false, loadedOnce: false });
  // Changing this number repeats the request (the "Try again" button).
  const [attempt, setAttempt] = useState(0);
  const searchRef = useRef(null);
  const id = useId();

  const search = useDebouncedValue(filters.search, 300);

  // "Try again" repeats every request that can have failed.
  const retry = () => {
    setTermsFailed(false);
    setAttempt((n) => n + 1);
  };

  // Load the category and tag lists once.
  useEffect(() => {
    const controller = new AbortController();
    const files = staticData ? staticDataUrls(staticData) : null;
    Promise.all([
      fetchJsonApi(files?.categories ?? buildTermsUrl(apiBase, 'product_category'), controller.signal),
      fetchJsonApi(files?.tags ?? buildTermsUrl(apiBase, 'dietary_tag'), controller.signal),
    ])
      .then(([categories, tags]) => setTerms({ categories: parseTerms(categories), tags: parseTerms(tags) }))
      .catch((error) => {
        if (error.name !== 'AbortError') setTermsFailed(true);
      });
    // Cleanup on unmount: abort requests that are still running.
    return () => controller.abort();
  }, [apiBase, staticData, attempt]);

  // Every combination of server-side filters (and every retry) is one request.
  const requestKey = JSON.stringify([search.trim(), filters.category, attempt]);

  // Load products whenever the request changes. State is only set in the
  // promise callbacks, when the response arrives: "loading" is not stored but
  // derived below, from the difference between this request and the last
  // finished one. (Setting state at the start of an effect makes React render
  // twice; the React docs and the react-hooks lint rules advise against it.)
  useEffect(() => {
    const controller = new AbortController();
    // The static copy has one file with every product; the browser filters it.
    const url = staticData
      ? staticDataUrls(staticData).products
      : buildProductsUrl(apiBase, { search, category: filters.category, langcode });
    fetchJsonApi(url, controller.signal)
      .then((document) => {
        let products = parseProducts(document, basePath);
        if (staticData) products = filterProducts(products, { search, category: filters.category });
        setResult({ key: requestKey, products, failed: false, loadedOnce: true });
      })
      .catch((error) => {
        // A newer request replaced this one: not an error.
        if (error.name !== 'AbortError') setResult((previous) => ({ ...previous, key: requestKey, failed: true }));
      });
    // Aborting the previous request means an old, slow response can never
    // overwrite the results of a newer one.
    return () => controller.abort();
  }, [apiBase, staticData, basePath, search, filters.category, langcode, requestKey]);

  let status = 'success';
  if (termsFailed || (result.key === requestKey && result.failed)) {
    status = 'error';
  } else if (result.key !== requestKey) {
    status = 'loading';
  }
  const { products, loadedOnce: hasLoaded } = result;

  // Derived data: computed from state on each render, not stored in state.
  const visibleProducts = useMemo(() => filterByTags(products, filters.tags), [products, filters.tags]);
  const names = useMemo(
    () => Object.fromEntries([...terms.categories, ...terms.tags].map((term) => [term.id, term.name])),
    [terms],
  );

  // Shows the "Clear filters" button as soon as the user types or clicks.
  const isFiltered = filters.search !== '' || filters.category !== '' || filters.tags.length > 0;

  // The widget shows its own list only once a filter is active (search counts
  // after the debounce). Before that, the server-rendered list stays: it is
  // already painted, so replacing it with identical React cards would only
  // delay the Largest Contentful Paint and re-render images for nothing.
  const showLiveResults = hasLoaded && (search.trim() !== '' || filters.category !== '' || filters.tags.length > 0);

  useEffect(() => {
    onLiveResultsChange?.(showLiveResults);
  }, [showLiveResults, onLiveResultsChange]);

  const toggleTag = (tagId) =>
    setFilters((current) => ({
      ...current,
      tags: current.tags.includes(tagId)
        ? current.tags.filter((selected) => selected !== tagId)
        : [...current.tags, tagId],
    }));

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    // Put focus somewhere useful: the "Clear" button may disappear.
    searchRef.current?.focus();
  };

  let message = '';
  if (status === 'loading') {
    message = Drupal.t('Loading products…');
  } else if (status === 'error') {
    message = Drupal.t('Products could not be loaded.');
  } else {
    message = Drupal.formatPlural(visibleProducts.length, '1 product found', '@count products found');
  }

  return (
    <div className="catalog-filter">
      {/* role="search" makes the form a landmark; it never submits a page. */}
      <form
        className="catalog-filter__form"
        role="search"
        aria-label={Drupal.t('Filter products')}
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="catalog-filter__field">
          <label htmlFor={`${id}-search`}>{Drupal.t('Search by name')}</label>
          <input
            ref={searchRef}
            id={`${id}-search`}
            type="search"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            autoComplete="off"
          />
        </div>

        <div className="catalog-filter__field">
          <label htmlFor={`${id}-category`}>{Drupal.t('Category')}</label>
          <select
            id={`${id}-category`}
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="">{Drupal.t('All categories')}</option>
            {terms.categories.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </select>
        </div>

        {terms.tags.length > 0 && (
          <fieldset className="catalog-filter__tags">
            <legend>{Drupal.t('Dietary needs')}</legend>
            {terms.tags.map((term) => (
              <label key={term.id} className="catalog-filter__tag">
                <input type="checkbox" checked={filters.tags.includes(term.id)} onChange={() => toggleTag(term.id)} />
                {term.name}
              </label>
            ))}
          </fieldset>
        )}

        {isFiltered && (
          <button type="button" className="button button--secondary catalog-filter__clear" onClick={clearFilters}>
            {Drupal.t('Clear filters')}
          </button>
        )}
      </form>

      {/*
        A live region must exist before its text changes, so it is always
        rendered. role="status" is polite: screen readers announce the new
        count after the user stops interacting, without interrupting.
      */}
      <p className="catalog-filter__status" role="status">
        {message}
      </p>

      {status === 'error' && (
        <div className="catalog-filter__error">
          <p>{Drupal.t('Check your connection and try again.')}</p>
          <button type="button" className="button button--primary" onClick={retry}>
            {Drupal.t('Try again')}
          </button>
        </div>
      )}

      {/* Without an active filter the server-rendered list is shown instead. */}
      {showLiveResults && status !== 'error' && (
        <div className="catalog-filter__results" aria-busy={status === 'loading'}>
          {visibleProducts.length > 0 ? (
            <ul className="teaser-grid__list" role="list">
              {visibleProducts.map((product) => (
                <li key={product.id} className="teaser-grid__item">
                  <ProductCard
                    product={product}
                    langcode={langcode}
                    category={names[product.categoryId] ?? ''}
                    badges={product.tagIds.map((tagId) => names[tagId]).filter(Boolean)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            status === 'success' && (
              <div className="catalog-filter__empty">
                <p>{Drupal.t('No products match your filters.')}</p>
                <button type="button" className="button button--secondary" onClick={clearFilters}>
                  {Drupal.t('Clear filters')}
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
