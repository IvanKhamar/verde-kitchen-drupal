/**
 * @file
 * Unit tests for api.js, run with Node's built-in test runner: npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildProductsByIdUrl,
  buildProductsUrl,
  buildTermsUrl,
  filterByTags,
  filterProducts,
  formatPrice,
  parseProducts,
  parseTerms,
  staticDataUrls,
} from './api.js';

const params = (url) => new URL(url, 'http://example.test').searchParams;

describe('buildProductsUrl', () => {
  it('lists published products sorted by title, with sparse fieldsets', () => {
    const url = buildProductsUrl('/jsonapi');
    assert.ok(url.startsWith('/jsonapi/node/product?'));
    const p = params(url);
    assert.equal(p.get('filter[status]'), '1');
    assert.equal(p.get('sort'), 'title');
    assert.match(p.get('fields[node--product]'), /card_image_url/);
    assert.equal(p.get('filter[search][condition][path]'), null);
    assert.equal(p.get('filter[category][condition][path]'), null);
  });

  it('adds a CONTAINS title filter for a trimmed search', () => {
    const p = params(buildProductsUrl('/jsonapi', { search: '  bowl ' }));
    assert.equal(p.get('filter[search][condition][path]'), 'title');
    assert.equal(p.get('filter[search][condition][operator]'), 'CONTAINS');
    assert.equal(p.get('filter[search][condition][value]'), 'bowl');
  });

  it('ignores a search of only spaces', () => {
    assert.equal(params(buildProductsUrl('/jsonapi', { search: '   ' })).get('filter[search][condition][path]'), null);
  });

  it('limits the results to one language when a langcode is given', () => {
    assert.equal(params(buildProductsUrl('/uk/jsonapi', { langcode: 'uk' })).get('filter[langcode]'), 'uk');
    assert.equal(params(buildProductsUrl('/jsonapi')).get('filter[langcode]'), null);
  });

  it('filters by category UUID', () => {
    const p = params(buildProductsUrl('/jsonapi', { category: 'abc-123' }));
    assert.equal(p.get('filter[category][condition][path]'), 'field_category.id');
    assert.equal(p.get('filter[category][condition][value]'), 'abc-123');
  });
});

describe('buildTermsUrl', () => {
  it('lists terms of a vocabulary by weight, with names only', () => {
    const url = buildTermsUrl('/jsonapi', 'dietary_tag');
    assert.ok(url.startsWith('/jsonapi/taxonomy_term/dietary_tag?'));
    assert.equal(params(url).get('fields[taxonomy_term--dietary_tag]'), 'name');
  });
});

describe('parseTerms', () => {
  it('returns id and name', () => {
    const document = { data: [{ id: 'u1', type: 'taxonomy_term--dietary_tag', attributes: { name: 'Vegan' } }] };
    assert.deepEqual(parseTerms(document), [{ id: 'u1', name: 'Vegan' }]);
  });
});

describe('parseProducts', () => {
  const resource = (overrides = {}) => ({
    id: 'p1',
    attributes: {
      title: 'Green Glow Smoothie',
      drupal_internal__nid: 7,
      path: { alias: null },
      body: { summary: 'Fresh.' },
      field_price: '3.90',
      card_image_url: '/files/card.png',
      ...overrides,
    },
    relationships: {
      field_category: { data: { id: 'c1' } },
      field_dietary_tags: { data: [{ id: 't1' }, { id: 't2' }] },
      field_image: { data: { meta: { alt: 'A bottle' } } },
    },
  });

  it('maps attributes and relationships', () => {
    const [product] = parseProducts({ data: [resource()] });
    assert.deepEqual(product, {
      id: 'p1',
      title: 'Green Glow Smoothie',
      url: '/node/7',
      summary: 'Fresh.',
      price: '3.90',
      categoryId: 'c1',
      tagIds: ['t1', 't2'],
      image: { url: '/files/card.png', alt: 'A bottle' },
    });
  });

  it('prefers the path alias and adds the base path', () => {
    const [product] = parseProducts({ data: [resource({ path: { alias: '/products/smoothie' } })] }, '/shop/');
    assert.equal(product.url, '/shop/products/smoothie');
  });

  it('has no image when the computed URL is missing', () => {
    const [product] = parseProducts({ data: [resource({ card_image_url: null })] });
    assert.equal(product.image, null);
  });
});

describe('filterByTags', () => {
  const products = [
    { id: 'a', tagIds: ['vegan', 'gluten-free'] },
    { id: 'b', tagIds: ['vegan'] },
    { id: 'c', tagIds: [] },
  ];

  it('returns every product when no tag is selected', () => {
    assert.equal(filterByTags(products, []).length, 3);
  });

  it('requires all selected tags (AND)', () => {
    assert.deepEqual(
      filterByTags(products, ['vegan', 'gluten-free']).map((p) => p.id),
      ['a'],
    );
  });
});

describe('formatPrice', () => {
  it('formats euro with two decimals', () => {
    assert.equal(formatPrice('3.9'), '€3.90');
  });

  it('uses a decimal comma and the sign after the number in Ukrainian', () => {
    assert.equal(formatPrice('3.9', 'uk'), '3,90\u00A0€');
    assert.equal(formatPrice('1234.5', 'uk'), '1\u00A0234,50\u00A0€');
  });

  it('returns an empty string without a value', () => {
    assert.equal(formatPrice(null), '');
    assert.equal(formatPrice(''), '');
  });
});

describe('filterProducts (static copy)', () => {
  const products = [
    { title: 'Quinoa Power Bowl', categoryId: 'bowls' },
    { title: 'Боул з кіноа', categoryId: 'bowls' },
    { title: 'Berry Kombucha', categoryId: 'drinks' },
  ];

  it('matches part of the name, ignoring case, in any alphabet', () => {
    assert.deepEqual(
      filterProducts(products, { search: ' BOWL ' }).map((p) => p.title),
      ['Quinoa Power Bowl'],
    );
    assert.equal(filterProducts(products, { search: 'БОУЛ' }).length, 1);
  });

  it('filters by category and combines it with the search', () => {
    assert.equal(filterProducts(products, { category: 'bowls' }).length, 2);
    assert.equal(filterProducts(products, { search: 'kombucha', category: 'bowls' }).length, 0);
  });

  it('returns everything without filters', () => {
    assert.equal(filterProducts(products).length, 3);
  });
});

describe('staticDataUrls', () => {
  it('points to the exported files of a language', () => {
    assert.equal(staticDataUrls('/base/static-data/uk').products, '/base/static-data/uk/products.json');
  });
});

describe('buildProductsByIdUrl', () => {
  it('asks for the given UUIDs with the IN operator', () => {
    const p = params(buildProductsByIdUrl('/uk/jsonapi', ['a', 'b'], 'uk'));
    assert.equal(p.get('filter[ids][condition][operator]'), 'IN');
    assert.deepEqual(p.getAll('filter[ids][condition][value][]'), ['a', 'b']);
    assert.equal(p.get('filter[langcode]'), 'uk');
  });
});
