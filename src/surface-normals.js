import { CanvasTexture, NoColorSpace, RepeatWrapping } from 'three';

// Convert an unlit height field to tangent-space normals. The image rows run
// downward, so the green channel uses the opposite derivative from the red.
export function createNormalTexture(width, height, heightAt, strength) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    const above = (y + height - 1) % height;
    const below = (y + 1) % height;
    for (let x = 0; x < width; x++) {
      const left = (x + width - 1) % width;
      const right = (x + 1) % width;
      const nx = (heightAt(left, y) - heightAt(right, y)) * strength;
      const ny = (heightAt(x, below) - heightAt(x, above)) * strength;
      const nz = 1 / Math.hypot(nx, ny, 1);
      const i = (y * width + x) * 4;
      pixels.data[i] = 127.5 * (1 + nx * nz);
      pixels.data[i + 1] = 127.5 * (1 + ny * nz);
      pixels.data[i + 2] = 127.5 * (1 + nz);
      pixels.data[i + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}
