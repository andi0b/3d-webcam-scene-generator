import { expect, test } from 'vitest';
import { estimateExposureEV } from '../src/exposure-meter.js';

function meter(luminanceAt) {
  const width = 32, height = 18;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels[(y * width + x) * 4] = Math.round((Math.log2(luminanceAt(x, y)) + 12) / 28 * 255);
    }
  }
  return estimateExposureEV(pixels, width, height);
}

test('the same bright patch lowers exposure only on the upper-right side of the diagonal', () => {
  const baseline = meter(() => .09);
  const upperRight = meter((x, y) => x >= 22 && y >= 10 ? 4 : .09);
  const lowerLeft = meter((x, y) => x < 10 && y < 8 ? 4 : .09);
  expect(lowerLeft).toBe(baseline);
  expect(upperRight).toBeLessThan(-1.5);
});

test('auto exposure caps boosts at +1 EV and keeps reducing exposure as luminance increases', () => {
  expect(meter(() => .001)).toBe(1);
  expect(meter(() => 64)).toBeLessThan(-8);
  expect(meter(() => 4096)).toBeLessThan(meter(() => 512));
});
