import * as THREE from 'three';
import { randomSource } from '../random-source.js';

export function createAshFloor(loadSurface) {
  const group = new THREE.Group();
  group.name = 'ash-floor';
  const material = new THREE.MeshStandardMaterial({ roughness: .62 });
  loadSurface(material, 'white-ash.jpg', .5, [185, 167, 143]);
  const random = randomSource(8619);
  const grainWidth = .10;
  const margin = .012;
  for (let row = 0; row < 25; row++) {
    let z = -3;
    let length = .45 + random() * 1.05;
    while (z < 3) {
      const remaining = 3 - z;
      const depth = remaining - length < .28 ? remaining : length;
      const geometry = new THREE.BoxGeometry(.283, .065, depth - .002);
      const uv = geometry.getAttribute('uv');
      // Each plank takes a different cut from the sheet, with grain running along its length.
      const grainLength = depth / 2.1;
      const uStart = margin + random() * (1 - grainWidth - 2 * margin);
      const vStart = margin + random() * (1 - grainLength - 2 * margin);
      const reverse = random() < .5;
      for (let i = 0; i < uv.count; i++) {
        const u = reverse ? 1 - uv.getX(i) : uv.getX(i);
        const v = reverse ? 1 - uv.getY(i) : uv.getY(i);
        uv.setXY(i, uStart + u * grainWidth, vStart + v * grainLength);
      }
      const plank = new THREE.Mesh(geometry, material);
      plank.position.set(-3.24 + row * .285, -.05, z + depth / 2);
      plank.receiveShadow = true;
      group.add(plank);
      z += depth;
      length = 1.23 + random() * .49;
    }
  }
  return group;
}
