/**
 * @file
 * Unit tests for the shopping list store (npm test).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { add, count, has, load, MAX_QUANTITY, parse, remove, save, setQuantity, STORAGE_KEY } from './store.js';

const A = '0b8e6c2e-3d6f-4f7a-9c1e-2a4b6c8d0e1f';
const B = '1c9f7d3f-4e7a-4a8b-8d2f-3b5c7d9e1f20';

/** A tiny in-memory stand-in for localStorage. */
const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => (data[key] = value), data };
};

describe('parse', () => {
  it('keeps valid items', () => {
    assert.deepEqual(parse(JSON.stringify([{ id: A, quantity: 2 }])), [{ id: A, quantity: 2 }]);
  });

  it('returns an empty list for broken or unexpected data', () => {
    assert.deepEqual(parse('not json'), []);
    assert.deepEqual(parse('{"id": 1}'), []);
    assert.deepEqual(parse(null), []);
  });

  it('drops invalid ids, bad quantities and duplicates', () => {
    const text = JSON.stringify([
      { id: '<script>', quantity: 1 },
      { id: A, quantity: 0 },
      { id: A, quantity: 1.5 },
      { id: B, quantity: 3 },
      { id: B, quantity: 4 },
    ]);
    assert.deepEqual(parse(text), [{ id: B, quantity: 3 }]);
  });

  it('caps quantities', () => {
    assert.equal(parse(JSON.stringify([{ id: A, quantity: 500 }]))[0].quantity, MAX_QUANTITY);
  });
});

describe('changes', () => {
  it('adds a product, then one more of it', () => {
    const once = add([], A);
    assert.deepEqual(once, [{ id: A, quantity: 1 }]);
    assert.deepEqual(add(once, A), [{ id: A, quantity: 2 }]);
  });

  it('ignores ids that are not UUIDs', () => {
    assert.deepEqual(add([], 'nope'), []);
  });

  it('removes a product', () => {
    assert.deepEqual(remove(add(add([], A), B), A), [{ id: B, quantity: 1 }]);
  });

  it('sets a quantity; 0 removes the product', () => {
    const list = add([], A);
    assert.equal(setQuantity(list, A, 5)[0].quantity, 5);
    assert.deepEqual(setQuantity(list, A, 0), []);
    assert.equal(setQuantity(list, A, 1000)[0].quantity, MAX_QUANTITY);
  });

  it('does not change the list it gets', () => {
    const list = add([], A);
    add(list, A);
    assert.equal(list[0].quantity, 1);
  });

  it('counts quantities and finds products', () => {
    const list = setQuantity(add(add([], A), B), A, 2);
    assert.equal(count(list), 3);
    assert.equal(has(list, B), true);
  });
});

describe('storage', () => {
  it('saves and loads the list', () => {
    const storage = memoryStorage();
    save([{ id: A, quantity: 2 }], storage);
    assert.deepEqual(load(storage), [{ id: A, quantity: 2 }]);
    assert.ok(storage.data[STORAGE_KEY]);
  });

  it('returns an empty list when storage is blocked', () => {
    const blocked = {
      getItem() {
        throw new Error('SecurityError');
      },
    };
    assert.deepEqual(load(blocked), []);
  });

  it('reports a failed save instead of throwing', () => {
    const full = {
      setItem() {
        throw new Error('QuotaExceededError');
      },
    };
    assert.equal(save([], full), false);
  });
});
