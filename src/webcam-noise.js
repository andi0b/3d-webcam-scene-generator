import { randomSource } from './scene/random-source.js';

export function applyWebcamNoise(image, level) {
  if (level !== 'low' && level !== 'high') return image;
  const { width, height, data } = image;
  const high = level === 'high';
  const lumaStrength = high ? 16 : 10;
  const chromaStrength = high ? 4 : 2.5;
  const coarseWeight = high ? .86 : .70;
  const pixelWeight = high ? .14 : .30;
  const random = randomSource(5731);

  const grainSpacing = high ? Math.max(3, Math.round(height / 180)) : Math.max(2, Math.round(height / 250));
  const lumaColumns = Math.ceil(width / grainSpacing) + 1;
  const lumaRows = Math.ceil(height / grainSpacing) + 1;
  // Compensate for the lower contrast after blending neighboring samples.
  const lumaNoise = Float32Array.from({ length: lumaColumns * lumaRows }, () => 1.4 * (random() - random()));

  // Webcam color noise is softer and coarser than its brightness noise.
  const spacing = 2 * grainSpacing;
  const columns = Math.ceil(width / spacing) + 1;
  const rows = Math.ceil(height / spacing) + 1;
  const redNoise = Float32Array.from({ length: rows * columns }, () => random() - .5);
  const blueNoise = Float32Array.from(redNoise, () => random() - .5);
  for (let y = 0; y < height; y++) {
    const lumaRow = Math.floor(y / grainSpacing) * lumaColumns;
    const lumaY = (y % grainSpacing) / grainSpacing;
    const row = Math.floor(y / spacing) * columns;
    const fy = (y % spacing) / spacing;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const luminance = .2126 * data[offset] + .7152 * data[offset + 1] + .0722 * data[offset + 2];
      const shadow = 1 - luminance / 255;
      const shadowGain = .10 + .90 * shadow * shadow;
      const lumaIndex = lumaRow + Math.floor(x / grainSpacing);
      const lumaX = (x % grainSpacing) / grainSpacing;
      const coarseGrain = interpolate(lumaNoise, lumaIndex, lumaColumns, lumaX, lumaY);
      const grain = (coarseWeight * coarseGrain + pixelWeight * (random() - random())) * lumaStrength * shadowGain;
      const i = row + Math.floor(x / spacing);
      const fx = (x % spacing) / spacing;
      const red = interpolate(redNoise, i, columns, fx, fy) * chromaStrength * shadowGain;
      const blue = interpolate(blueNoise, i, columns, fx, fy) * chromaStrength * shadowGain;
      data[offset] += grain + red;
      data[offset + 1] += grain - .30 * red - .10 * blue;
      data[offset + 2] += grain + blue;
    }
  }
  return image;
}

function interpolate(values, i, stride, x, y) {
  const top = values[i] + (values[i + 1] - values[i]) * x;
  const bottom = values[i + stride] + (values[i + stride + 1] - values[i + stride]) * x;
  return top + (bottom - top) * y;
}
