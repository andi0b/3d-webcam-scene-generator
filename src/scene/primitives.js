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
  const [width, height, depth] = size;
  const mesh = roundedBox(parent, size, position, material, radius, 5);
  const { position: vertices, uv } = mesh.geometry.attributes;
  const alongX = width > height && width > depth;
  for (let i = 0; i < vertices.count; i++) {
    const along = alongX ? vertices.getX(i) : height > depth ? vertices.getY(i) : vertices.getZ(i);
    const across = alongX ? vertices.getZ(i) : vertices.getX(i);
    uv.setXY(i, across * 3, along * .65);
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
