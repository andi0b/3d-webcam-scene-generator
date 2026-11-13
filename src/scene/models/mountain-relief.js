import * as THREE from 'three';
import { box, oakBox } from '../primitives.js';

// The sculpted ridges give the photographic print depth and catch room light.
export function createReliefMesh(width, height, map = null) {
  const geometry = new THREE.PlaneGeometry(width, height, 256, 128);
  const positions = geometry.attributes.position;
  const colors = [];
  const charcoal = new THREE.Color('#494740'), ochre = new THREE.Color('#a38c62');
  for (let i = 0; i < positions.count; i++) {
    const u = positions.getX(i) / width, v = positions.getY(i) / height;
    let depth = .008, crest = 0;
    // Continuous ridges avoid the discontinuities and moire of the first relief.
    for (let ridge = 0; ridge < 5; ridge++) {
      const phase = ridge * 1.73;
      const horizon = -.46 + ridge * .19 + .10 * Math.sin(u * 8 + phase)
        + .035 * Math.sin(u * 23 + phase) + .012 * Math.sin(u * 61 + ridge);
      const distance = horizon - v;
      const ridgeShape = Math.exp(-Math.abs(distance) * (distance < 0 ? 100 : 15));
      const erosion = .7 + .3 * Math.sin(u * 105 + distance * 32 + Math.sin(u * 41));
      depth += .065 * ridgeShape * erosion;
      crest = Math.max(crest, ridgeShape * .5);
    }
    const grain = Math.sin(u * 210 + Math.sin(v * 80) * 3) * Math.sin(v * 180 + u * 85);
    positions.setZ(i, depth + grain * .0007);
    const color = charcoal.clone().lerp(ochre, crest);
    colors.push(color.r, color.g, color.b, 1);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ map, vertexColors: !map, roughness: .9 });
  const relief = new THREE.Mesh(geometry, material);
  relief.castShadow = relief.receiveShadow = true;
  return relief;
}

export function createMountainRelief(wood, dark, loadImage) {
  const group = new THREE.Group();
  group.name = 'mountain-relief';
  oakBox(group, [2.40, 1.28, .055], [0, 0, 0], wood, .009);
  box(group, [2.32, 1.20, .025], [0, 0, .037], dark);
  const relief = createReliefMesh(2.28, 1.16, loadImage('alpine-relief.jpg'));
  relief.position.z = .055;
  group.add(relief);
  return group;
}
