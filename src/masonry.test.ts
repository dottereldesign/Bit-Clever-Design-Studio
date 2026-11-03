import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeMasonry } from './masonry';

test('mixed shapes stay within the grid and never overlap across preview widths', () => {
  const ratios = Array.from({ length: 250 }, (_, n) => [0.4, 0.7, 1, 1.8, 3][n % 5]);
  for (const width of [220, 600, 950, 1600, 2400]) {
    const { tiles, height } = arrangeMasonry(ratios, width, 260);
    assert.equal(tiles.length, ratios.length);
    for (const tile of tiles) {
      assert.ok(tile.left >= 0 && tile.left + tile.width <= width + 0.001);
      assert.ok(tile.top >= 0 && tile.top + tile.height <= height + 0.001);
      assert.ok(Math.abs(tile.width / tile.height - ratios[tile.index]) < 0.001);
      for (const other of tiles.slice(tile.index + 1)) {
        assert.ok(tile.left + tile.width <= other.left || other.left + other.width <= tile.left || tile.top + tile.height <= other.top || other.top + other.height <= tile.top);
      }
    }
  }
});

test('empty and unknown-size media yield finite usable layouts', () => {
  assert.deepEqual(arrangeMasonry([], 900, 260), { tiles: [], height: 0 });
  const result = arrangeMasonry([NaN, 0, -1, Infinity], 600, 260);
  assert.ok(result.tiles.every(tile => Number.isFinite(tile.height) && tile.height > 0));
});
