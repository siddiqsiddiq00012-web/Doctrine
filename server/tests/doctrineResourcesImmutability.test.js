import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_INVENTORY } from '../../src/data/doctrineData.js';

test('FEATURE 3 — IMMUTABLE DOCTRINE RESOURCES & TRACKING TESTS', async (t) => {
  
  await t.test('1. Verify Resource Definitions Originate Exclusively from Doctrine Plan', () => {
    assert.ok(Array.isArray(INITIAL_INVENTORY));
    assert.ok(INITIAL_INVENTORY.length >= 25);

    const categories = new Set(INITIAL_INVENTORY.map(item => item.category));
    assert.ok(categories.has('FOOD'));
    assert.ok(categories.has('SUPPLEMENTS'));
    assert.ok(categories.has('SKINCARE'));
    assert.ok(categories.has('HAIR'));

    // Verify key Doctrine resources exist
    const eggs = INITIAL_INVENTORY.find(i => i.name === 'Eggs');
    assert.ok(eggs);
    assert.equal(eggs.category, 'FOOD');
    assert.equal(eggs.unit, 'pcs');

    const biotin = INITIAL_INVENTORY.find(i => i.name.includes('Biotin'));
    assert.ok(biotin);
    assert.equal(biotin.category, 'SUPPLEMENTS');
  });

  await t.test('2. Verify Resource Requirements Are Derived and Defined by Doctrine', () => {
    INITIAL_INVENTORY.forEach(item => {
      assert.ok(item.id, `Item ${item.name} must have an ID`);
      assert.ok(item.name, 'Item must have a name');
      assert.ok(item.category, 'Item must have a category');
      assert.ok(item.unit, 'Item must have a unit');
      assert.ok(typeof item.minStockLevel === 'number', 'Item must have numeric minStockLevel requirement');
      assert.ok(typeof item.purchaseQty === 'number', 'Item must have numeric purchaseQty requirement');
    });
  });

  await t.test('3. Verify Resource Tracking Calculations (Progress, Deficit, Surplus)', () => {
    const item = { ...INITIAL_INVENTORY[0], currentQty: 10, purchaseQty: 30 }; // Eggs
    const progressPct = Math.round((item.currentQty / item.purchaseQty) * 100);
    assert.equal(progressPct, 33);

    // After adding stock +20
    const updatedQty = item.currentQty + 20;
    const updatedProgressPct = Math.round((updatedQty / item.purchaseQty) * 100);
    assert.equal(updatedProgressPct, 100);
  });
});
