import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function material(color, roughness = 1, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addMesh(parent, geometry, material, position, castShadow, receiveShadow) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  return mesh;
}

export function box(parent, size, position, material, castShadow = true) {
  return addMesh(parent, new THREE.BoxGeometry(...size), material, position, castShadow, true);
}

export function roundedBox(parent, size, position, material, radius = .003, segments = 3) {
  const geometry = new RoundedBoxGeometry(...size, segments, radius);
  return addMesh(parent, geometry, material, position, true, true);
}

export function oakBox(parent, size, position, material, radius) {
  const mesh = roundedBox(parent, size, position, material, radius, 5);
  const { groups, attributes: { position: vertices, uv } } = mesh.geometry;
  // Run the grain along the board and project it onto each face and its bevel.
  for (const { start, count, materialIndex } of groups) {
    const faceAxis = Math.floor(materialIndex / 2);
    for (let i = start; i < start + count; i++) {
      const across = faceAxis === 1 ? vertices.getZ(i) : vertices.getY(i);
      const along = faceAxis === 0 ? vertices.getZ(i) : vertices.getX(i);
      uv.setXY(i, .5 + across / 1.2, .5 + along / 2.7);
    }
  }
  uv.needsUpdate = true;
  return mesh;
}

export function cylinder(parent, size, position, material) {
  const geometry = new THREE.CylinderGeometry(...size, 48);
  return addMesh(parent, geometry, material, position, true, true);
}

export function sphere(parent, radius, position, material) {
  return addMesh(parent, new THREE.SphereGeometry(radius, 32, 24), material, position, true, false);
}
