/**
 * @file
 * JSON:API helpers for the catalog filter: build request URLs, fetch, and
 * turn the JSON:API documents into the small objects the components need.
 *
 * These are pure functions (no React, no DOM), so they are easy to unit test
 * (see api.test.js).
 *
 * JSON:API basics used here:
 * - GET /jsonapi/{entity_type}/{bundle} lists resources, for example
 *   /jsonapi/node/product.
 * - fields[TYPE]=a,b asks only for the listed fields (smaller responses).
 * - filter[NAME][condition][path|operator|value] filters the list.
 * - Relationships (category, tags, image) come as references:
 *   { type, id } where id is the entity UUID.
 */

// Only the fields the card and the filters use.
const PRODUCT_FIELDS = [
  'title',
  'drupal_internal__nid',
  'path',
  'body',
  'field_price',
  'field_category',
  'field_dietary_tags',
  'field_image',
  // Computed by the verde_catalog module: the "card" image style URL.
  'card_image_url',
].join(',');

/**
 * Builds the URL that lists published products matching the filters.
 *
 * Category and title search are filtered by Drupal. Dietary tags are not:
 * see filterByTags() for the reason.
 *
 * @param {string} apiBase - The JSON:API root, usually "/jsonapi".
 * @param {{search?: string, category?: string}} filters - Category is a term UUID.
 * @returns {string} A root-relative URL.
 */
export function buildProductsUrl(apiBase, { search = '', category = '', langcode = '' } = {}) {
  const params = new URLSearchParams();
  // Asking for published content explicitly lets Drupal filter in SQL instead
  // of loading unpublished items and removing them during the access check.
  params.set('filter[status]', '1');
  params.set('sort', 'title');
  params.set('page[limit]', '50');
  params.set('fields[node--product]', PRODUCT_FIELDS);

  const query = search.trim();
  if (query) {
    params.set('filter[search][condition][path]', 'title');
    params.set('filter[search][condition][operator]', 'CONTAINS');
    params.set('filter[search][condition][value]', query);
  }
  if (langcode) {
    // Products exist in several languages. The language prefix of apiBase
    // (/uk/jsonapi) makes Drupal return the Ukrainian translations; this filter
    // makes the title search match titles in that language only.
    params.set('filter[langcode]', langcode);
  }
  if (category) {
    // "field_category.id" filters by the UUID of the referenced term.
    params.set('filter[category][condition][path]', 'field_category.id');
    params.set('filter[category][condition][value]', category);
  }

  return `${apiBase}/node/product?${params}`;
}

/**
 * Builds the URL that lists the terms of a vocabulary, in admin order.
 *
 * @param {string} apiBase - The JSON:API root.
 * @param {string} vocabulary - The vocabulary machine name.
 * @returns {string} A root-relative URL.
 */
export function buildTermsUrl(apiBase, vocabulary) {
  const params = new URLSearchParams();
  params.set('sort', 'weight,name');
  params.set(`fields[taxonomy_term--${vocabulary}]`, 'name');
  return `${apiBase}/taxonomy_term/${vocabulary}?${params}`;
}

/**
 * Fetches a JSON:API document. Rejects on network errors and HTTP errors.
 *
 * @param {string} url - The URL to request.
 * @param {AbortSignal} [signal] - Cancels the request when filters change.
 * @returns {Promise<object>} The parsed JSON:API document.
 */
export async function fetchJsonApi(url, signal) {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.api+json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Turns a terms document into [{ id, name }].
 *
 * @param {object} document - A JSON:API document.
 * @returns {Array<{id: string, name: string}>} The terms.
 */
export function parseTerms(document) {
  return document.data.map((term) => ({ id: term.id, name: term.attributes.name }));
}

/**
 * Turns a products document into plain product objects.
 *
 * @param {object} document - A JSON:API document.
 * @param {string} basePath - The site base path, usually "/".
 * @returns {Array<object>} The products.
 */
export function parseProducts(document, basePath = '/') {
  const base = basePath.replace(/\/$/, '');
  return document.data.map(({ id, attributes, relationships }) => ({
    id,
    title: attributes.title,
    // Path alias when there is one, otherwise the system path.
    url: base + (attributes.path?.alias ?? `/node/${attributes.drupal_internal__nid}`),
    summary: attributes.body?.summary ?? '',
    price: attributes.field_price,
    categoryId: relationships.field_category?.data?.id ?? '',
    tagIds: (relationships.field_dietary_tags?.data ?? []).map((tag) => tag.id),
    image: attributes.card_image_url
      ? { url: attributes.card_image_url, alt: relationships.field_image?.data?.meta?.alt ?? '' }
      : null,
  }));
}

/**
 * Keeps only the products that have every selected tag.
 *
 * This runs in the browser on purpose. A JSON:API filter with two conditions
 * on the same multi-value field (field_dietary_tags.id = A, and = B) returns
 * nothing: Drupal joins the field table once, and a single row cannot hold
 * both values. "Any of the tags" (operator IN) would work on the server, but
 * shoppers expect "vegan AND gluten-free". With at most a few dozen products
 * per response, filtering here is instant.
 *
 * @param {Array<{tagIds: string[]}>} products - Products from parseProducts().
 * @param {string[]} selectedTagIds - Selected tag UUIDs.
 * @returns {Array<object>} The matching products.
 */
export function filterByTags(products, selectedTagIds) {
  if (selectedTagIds.length === 0) {
    return products;
  }
  return products.filter((product) => selectedTagIds.every((id) => product.tagIds.includes(id)));
}

const numberFormats = {
  en: new Intl.NumberFormat('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  uk: new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};

/**
 * Formats a decimal string from Drupal for a language, like the theme's
 * verde_format_price(): "€3.90" in English, "3,90 €" in Ukrainian.
 *
 * Intl's currency style would print "EUR" for Ukrainian, so the number is
 * formatted by Intl and the sign is placed by hand (with a non-breaking space).
 *
 * @param {string|null} value - The price.
 * @param {string} [langcode] - "en" or "uk".
 * @returns {string} The formatted price, or "" when there is none.
 */
export function formatPrice(value, langcode = 'en') {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const number = Number(value);
  return langcode === 'uk' ? `${numberFormats.uk.format(number)}\u00A0€` : `€${numberFormats.en.format(number)}`;
}

/**
 * The exported JSON files the widget reads in the static copy (GitHub Pages),
 * which has no JSON:API. scripts/static/build.mjs writes them per language.
 *
 * @param {string} folder - For example "/verde-kitchen-drupal/static-data/uk".
 * @returns {{products: string, categories: string, tags: string}} File URLs.
 */
export function staticDataUrls(folder) {
  return {
    products: `${folder}/products.json`,
    categories: `${folder}/product_category.json`,
    tags: `${folder}/dietary_tag.json`,
  };
}

/**
 * Filters products by name and category in the browser. The live site lets
 * Drupal do this (see buildProductsUrl()); the static copy has no server.
 *
 * @param {Array<object>} products - Products from parseProducts().
 * @param {{search?: string, category?: string}} filters - Category is a term UUID.
 * @returns {Array<object>} The matching products.
 */
export function filterProducts(products, { search = '', category = '' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return products.filter(
    (product) =>
      (!query || product.title.toLocaleLowerCase().includes(query)) && (!category || product.categoryId === category),
  );
}

/**
 * Builds the URL that loads specific products by UUID: the shopping list page
 * asks only for the products on the list.
 *
 * JSON:API's IN operator takes the values as an array:
 * filter[ids][condition][value][]=A&filter[ids][condition][value][]=B
 *
 * @param {string} apiBase - The JSON:API root, usually "/jsonapi".
 * @param {string[]} ids - Product UUIDs.
 * @param {string} [langcode] - Limits the results to one language.
 * @returns {string} A root-relative URL.
 */
export function buildProductsByIdUrl(apiBase, ids, langcode = '') {
  const params = new URLSearchParams();
  params.set('filter[status]', '1');
  params.set('fields[node--product]', PRODUCT_FIELDS);
  params.set('page[limit]', '50');
  params.set('filter[ids][condition][path]', 'id');
  params.set('filter[ids][condition][operator]', 'IN');
  ids.forEach((id) => params.append('filter[ids][condition][value][]', id));
  if (langcode) params.set('filter[langcode]', langcode);
  return `${apiBase}/node/product?${params}`;
}
