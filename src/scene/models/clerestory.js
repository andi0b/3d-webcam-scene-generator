import * as THREE from 'three';
import { box, material } from '../primitives.js';

export function createClerestory({ width, height }) {
  const group = new THREE.Group();
  group.name = 'clerestory';
  const frame = material('#b9ac98', .55);
  const railWidth = .026;
  const paneHeight = height - 2 * railWidth;
  for (const y of [railWidth / 2, height - railWidth / 2]) {
    box(group, [width, railWidth, .16], [0, y, -.02], frame);
  }
  for (const x of [-(width - railWidth) / 2, (width - railWidth) / 2]) {
    box(group, [railWidth, paneHeight, .16], [x, height / 2, -.02], frame);
  }
  for (const fraction of [-.25, 0, .25]) {
    box(group, [.022, paneHeight, .10], [width * fraction, height / 2, 0], frame);
  }
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#e5e8e3', roughness: .68, clearcoat: .15, clearcoatRoughness: .48,
  });
  // The milky glazing blocks sharp sunlight and glows from diffuse daylight.
  box(group, [width, height, .024], [0, height / 2, 0], glass);
  const light = new THREE.RectAreaLight('#ffffff', 0, width - 2 * railWidth, paneHeight);
  light.position.set(0, height / 2, -.022);
  group.add(light);
  return { group, light, glass };
}
