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

let exteriorPlasterTextures;
export function exteriorPlasterMaps() {
  if (!exteriorPlasterTextures) {
    const size = 128;
    const random = randomSource(927);
    const grains = Float32Array.from({ length: size * size }, random);
    const aggregate = Float32Array.from({ length: 32 * 32 }, random);
    // Interpolate the aggregate so the render has irregular, soft plaster grains.
    const height = (x, y) => {
      const gx = x / 4, gy = y / 4;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      const smooth = t => t * t * (3 - 2 * t);
      const fx = smooth(gx - ix), fy = smooth(gy - iy);
      const at = (dx, dy) => aggregate[((iy + dy) % 32) * 32 + (ix + dx) % 32];
      const top = at(0, 0) * (1 - fx) + at(1, 0) * fx;
      const bottom = at(0, 1) * (1 - fx) + at(1, 1) * fx;
      return grains[y * size + x] * .2 + (top * (1 - fy) + bottom * fy) * .8;
    };
    const normalMap = createNormalTexture(size, size, height, .48);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const value = 166 + (height(x, y) - .5) * 24;
        const i = (y * size + x) * 4;
        pixels.data[i] = value;
        pixels.data[i + 1] = value;
        pixels.data[i + 2] = value - 2;
        pixels.data[i + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3, 3);
    normalMap.repeat.copy(map.repeat);
    exteriorPlasterTextures = { map, normalMap };
  }
  return exteriorPlasterTextures;
}

export function createBirchFinish() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const grain = canvas.getContext('2d');
  grain.fillStyle = '#dfd1ac';
  grain.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 120; i++) {
    const x = (i * 73) % canvas.width;
    const alpha = .035 + (i % 5) * .009;
    grain.strokeStyle = `rgba(142,117,72,${alpha})`;
    grain.lineWidth = i % 7 === 0 ? 1.3 : .45;
    grain.beginPath();
    grain.moveTo(x, 0);
    grain.bezierCurveTo(x + 4, 300, x - 5, 700, x + 2, canvas.height);
    grain.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshPhysicalMaterial({ map, roughness: .46, clearcoat: .28, clearcoatRoughness: .38 });
}

export function createGalvanizedFinish() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(canvas.width, canvas.height);
  const random = randomSource(4817);
  const spacing = 16;
  const columns = Math.ceil(canvas.width / spacing) + 2;
  const rows = Math.ceil(canvas.height / spacing) + 2;
  // Vary the tone of the zinc crystals under a broader mottled patina.
  const crystals = Array.from({ length: columns * rows }, (_, index) => ({
    x: (index % columns - 1 + .2 + random() * .6) * spacing,
    y: (Math.floor(index / columns) - 1 + .2 + random() * .6) * spacing,
    tone: (random() - .5) * 26,
  }));
  for (let y = 0; y < canvas.height; y++) {
    const row = Math.floor(y / spacing);
    for (let x = 0; x < canvas.width; x++) {
      const column = Math.floor(x / spacing);
      let nearest = Infinity, tone = 0;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          const crystal = crystals[(row + dy) * columns + column + dx];
          const distance = (x - crystal.x) ** 2 + (y - crystal.y) ** 2;
          if (distance < nearest) {
            nearest = distance;
            tone = crystal.tone;
          }
        }
      }
      const patina = 10 * Math.sin(x / 41 + Math.sin(y / 13)) * Math.cos(y / 25 + x / 71);
      const value = 157 + tone + patina + (random() - .5) * 7;
      const offset = (y * canvas.width + x) * 4;
      pixels.data[offset] = value - 4;
      pixels.data[offset + 1] = value;
      pixels.data[offset + 2] = value + 2;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, metalness: .72, roughness: .60 });
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
