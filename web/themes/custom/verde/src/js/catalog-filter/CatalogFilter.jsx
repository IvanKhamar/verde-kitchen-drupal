import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  buildProductsUrl,
  buildTermsUrl,
  fetchJsonApi,
  filterByTags,
  parseProducts,
  parseTerms,
} from './api.js';
import ProductCard from './ProductCard.jsx';
import useDebouncedValue from './useDebouncedValue.js';

// Drupal.t() makes strings translatable in the Drupal admin UI. The fallback
// keeps the component usable outside Drupal (for example in tests).
const t = (text, args) => window.Drupal?.t(text, args) ?? text;
const formatPlural = (count, singular, plural) =>
  window.Drupal?.formatPlural(count, singular, plural) ?? (count === 1 ? singular : plural).replace('@count', count);

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
 * @param {string} props.basePath - Site base path, for example "/".
 * @param {Function} props.onReady - Called once, after the first successful load.
 * @returns {JSX.Element} The widget.
 */
export default function CatalogFilter({ apiBase, basePath, onReady }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [terms, setTerms] = useState({ categories: [], tags: [] });
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [hasLoaded, setHasLoaded] = useState(false);
  // Changing this number repeats the request (the "Try again" button).
  const [attempt, setAttempt] = useState(0);
  const searchRef = useRef(null);
  const id = useId();

  const search = useDebouncedValue(filters.search, 300);

  // Load the category and tag lists once.
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchJsonApi(buildTermsUrl(apiBase, 'product_category'), controller.signal),
      fetchJsonApi(buildTermsUrl(apiBase, 'dietary_tag'), controller.signal),
    ])
      .then(([categories, tags]) => setTerms({ categories: parseTerms(categories), tags: parseTerms(tags) }))
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error');
      });
    // Cleanup on unmount: abort requests that are still running.
    return () => controller.abort();
  }, [apiBase]);

  // Load products whenever the server-side filters change.
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    fetchJsonApi(buildProductsUrl(apiBase, { search, category: filters.category }), controller.signal)
      .then((document) => {
        setProducts(parseProducts(document, basePath));
        setStatus('success');
        setHasLoaded(true);
      })
      .catch((error) => {
        // A newer request replaced this one: not an error.
        if (error.name !== 'AbortError') setStatus('error');
      });
    // Aborting the previous request means an old, slow response can never
    // overwrite the results of a newer one.
    return () => controller.abort();
  }, [apiBase, basePath, search, filters.category, attempt]);

  // Tell the page (once) that live results are ready, so it can hide the
  // server-rendered fallback list.
  useEffect(() => {
    if (hasLoaded) onReady?.();
  }, [hasLoaded, onReady]);

  // Derived data: computed from state on each render, not stored in state.
  const visibleProducts = useMemo(() => filterByTags(products, filters.tags), [products, filters.tags]);
  const names = useMemo(
    () => Object.fromEntries([...terms.categories, ...terms.tags].map((term) => [term.id, term.name])),
    [terms],
  );

  const isFiltered = filters.search !== '' || filters.category !== '' || filters.tags.length > 0;

  const toggleTag = (tagId) =>
    setFilters((current) => ({
      ...current,
      tags: current.tags.includes(tagId) ? current.tags.filter((selected) => selected !== tagId) : [...current.tags, tagId],
    }));

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    // Put focus somewhere useful: the "Clear" button may disappear.
    searchRef.current?.focus();
  };

  let message = '';
  if (status === 'loading') {
    message = t('Loading products…');
  } else if (status === 'error') {
    message = t('Products could not be loaded.');
  } else {
    message = formatPlural(visibleProducts.length, '1 product found', '@count products found');
  }

  return (
    <div className="catalog-filter">
      {/* role="search" makes the form a landmark; it never submits a page. */}
      <form className="catalog-filter__form" role="search" aria-label={t('Filter products')} onSubmit={(e) => e.preventDefault()}>
        <div className="catalog-filter__field">
          <label htmlFor={`${id}-search`}>{t('Search by name')}</label>
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
          <label htmlFor={`${id}-category`}>{t('Category')}</label>
          <select
            id={`${id}-category`}
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="">{t('All categories')}</option>
            {terms.categories.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </select>
        </div>

        {terms.tags.length > 0 && (
          <fieldset className="catalog-filter__tags">
            <legend>{t('Dietary needs')}</legend>
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
            {t('Clear filters')}
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
          <p>{t('Check your connection and try again.')}</p>
          <button type="button" className="button button--primary" onClick={() => setAttempt((n) => n + 1)}>
            {t('Try again')}
          </button>
        </div>
      )}

      {/* Until the first load succeeds, the server-rendered list is shown instead. */}
      {hasLoaded && status !== 'error' && (
        <div className="catalog-filter__results" aria-busy={status === 'loading'}>
          {visibleProducts.length > 0 ? (
            <ul className="teaser-grid__list" role="list">
              {visibleProducts.map((product) => (
                <li key={product.id} className="teaser-grid__item">
                  <ProductCard
                    product={product}
                    category={names[product.categoryId] ?? ''}
                    badges={product.tagIds.map((tagId) => names[tagId]).filter(Boolean)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            status === 'success' && (
              <div className="catalog-filter__empty">
                <p>{t('No products match your filters.')}</p>
                <button type="button" className="button button--secondary" onClick={clearFilters}>
                  {t('Clear filters')}
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
