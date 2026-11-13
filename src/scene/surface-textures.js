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

export function oakNormalMap({ image }) {
  const { width, height } = image;
  const { data } = image.getContext('2d').getImageData(0, 0, width, height);
  return createNormalTexture(width, height, (x, y) => data[(y * width + x) * 4] / 255, 1.3);
}

// Fine longitudinal pores, rather than a whole photograph repeated on every board.
export function oakTexture(seed = 18) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 1024;
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(256, 1024);
  const random = randomSource(seed), phases = Array.from({length: 12}, () => random() * 6.28);
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 256; x++) {
    const bend = Math.sin(y / 190 + phases[0]) * 5 + Math.sin(y / 370 + phases[1]) * 9;
    const grain = Math.sin((x + bend) * .36 + phases[2]) * 3 + Math.sin((x + bend * .5) * 1.9) * 1.8;
    const broad = Math.sin(x * .045 + Math.sin(y * .003) + phases[3]) * 1.5;
    const pore = random() > .992 ? -7 : 0;
    const variation = grain * .35 + broad + pore + (random() - .5) * 4;
    const i = (y * 256 + x) * 4;
    pixels.data.set([174 + variation, 140 + variation, 99 + variation, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function applySurfaceTexture(material, textureLoader, url, anisotropy, normalScale) {
  material.map = textureLoader.load(url, ({ image }) => {
    // Keep the shallow surface relief aligned with the visible grain and pores.
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(image.width / 2);
    canvas.height = Math.floor(image.height / 2);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { width, height } = canvas;
    const { data } = context.getImageData(0, 0, width, height);
    material.normalMap = createNormalTexture(width, height, (x, y) => data[(y * width + x) * 4 + 1] / 255, 1.3);
    material.normalMap.anisotropy = anisotropy;
    material.normalScale.setScalar(normalScale);
    material.needsUpdate = true;
  });
  material.map.colorSpace = THREE.SRGBColorSpace;
  material.map.anisotropy = anisotropy;
}
