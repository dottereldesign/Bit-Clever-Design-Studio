export type MasonryTile = { index: number; left: number; top: number; width: number; height: number };
export function arrangeMasonry(ratios: number[], width: number, preferredWidth: number, gap = 14) {
  const columns = Math.max(1, Math.floor((width + gap) / (preferredWidth + gap)));
  const tileWidth = Math.max(1, (width - (columns - 1) * gap) / columns);
  const bottoms = Array<number>(columns).fill(0);
  const tiles = ratios.map((ratio, index) => {
    let lane = 0;
    for (let n = 1; n < columns; n++) if (bottoms[n] < bottoms[lane]) lane = n;
    const height = tileWidth / (Number.isFinite(ratio) && ratio > 0 ? ratio : 1 / 1.4);
    const tile = { index, left: lane * (tileWidth + gap), top: bottoms[lane], width: tileWidth, height };
    bottoms[lane] += height + gap;
    return tile;
  });
  return { tiles, height: Math.max(0, ...bottoms) - (ratios.length ? gap : 0) };
}
