import * as THREE from 'three';
import { randomSource } from '../random-source.js';

export const FLOOR_TOP = -.0175;

export function createAshFloor(loadSurface) {
  const material = new THREE.MeshStandardMaterial({ roughness: .62 });
  loadSurface(material, 'white-ash.jpg', .5, [185, 167, 143]);
  const positions = [], uvs = [], indices = [];
  const random = randomSource(8619);
  const width = .283, bevel = .0015;
  const grainWidth = .10, margin = .012;
  for (let row = 0; row < 25; row++) {
    const centerX = -3.24 + row * .285;
    let z = -3;
    let length = .45 + random() * 1.05;
    while (z < 3) {
      const remaining = 3 - z;
      const depth = remaining - length < .28 ? remaining : length;
      const grainLength = depth / 2.1;
      const uStart = margin + random() * (1 - grainWidth - 2 * margin);
      const vStart = margin + random() * (1 - grainLength - 2 * margin);
      const reverse = random() < .5;
      const halfX = width / 2, halfZ = (depth - .002) / 2;
      const centerZ = z + depth / 2;

      // One top and four bevels. The room's solid subfloor closes each joint.
      function corners(inset, y) {
        const x = halfX - inset, z = halfZ - inset;
        return [[-x,y,-z], [-x,y,z], [x,y,z], [x,y,-z]];
      }
      function quad(points) {
        const start = positions.length / 3;
        for (const [x,y,localZ] of points) {
          positions.push(centerX+x, y, centerZ+localZ);
          const u = .5 + x/width, v = .5 - localZ/(2*halfZ);
          uvs.push(uStart + (reverse ? 1-u : u)*grainWidth,
            vStart + (reverse ? 1-v : v)*grainLength);
        }
        indices.push(start,start+1,start+2, start,start+2,start+3);
      }
      const top = corners(bevel, FLOOR_TOP);
      const rim = corners(0, FLOOR_TOP - .004);
      quad(top);
      for (let edge=0; edge<4; edge++) {
        const next = (edge + 1) % 4;
        quad([top[edge], rim[edge], rim[next], top[next]]);
      }
      z += depth;
      length = 1.23 + random() * .49;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const floor = new THREE.Mesh(geometry, material);
  floor.name = 'ash-floor';
  floor.receiveShadow = true;
  return floor;
}
