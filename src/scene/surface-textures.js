import * as THREE from 'three';
import { createNormalTexture } from '../surface-normals.js';
import { randomSource } from './random-source.js';

let plasterTexture;
export function plasterNormalMap() {
  if (!plasterTexture) {
    const size = 128;
    const random = randomSource(123);
    const height = Float32Array.from({ length: size * size }, random);
    plasterTexture = createNormalTexture(size, size, (x, y) => height[y * size + x], .045);
    plasterTexture.repeat.set(12, 8);
  }
  return plasterTexture;
}

export function createTextureLoader(assets, anisotropy, onTextureChanged) {
  const loader = new THREE.TextureLoader();

  return function loadTexture(filename, { normal = false, fallback = [255, 255, 255], onChange = onTextureChanged } = {}) {
    let texture;
    const ready = new Promise(resolve => {
      texture = loader.load(`${assets}${filename}`, () => {
        // The placeholder may already have immutable GPU storage at 1 × 1.
        // Release it before Three.js uploads the full-size image.
        texture.dispose();
        resolve(null);
        onChange();
      }, undefined, () => {
        const error = new Error(`Could not load ${filename}.`);
        resolve(error);
        onChange(error);
      });
    });
    // Keep the map present from the first frame so a loaded image changes only the sampler contents.
    texture.image = new ImageData(new Uint8ClampedArray([...(normal ? [128, 128, 255] : fallback), 255]), 1, 1);
    texture.needsUpdate = true;
    texture.colorSpace = normal ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    return { texture, ready };
  };
}
