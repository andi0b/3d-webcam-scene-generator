import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PathTracingSceneGenerator } from 'three-gpu-pathtracer';
import { createReliefMesh } from '../src/scene/models/mountain-relief.js';

const scene = new THREE.Scene();
scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
const relief = createReliefMesh(2, 1);
relief.position.set(1, 2, -2);
scene.add(relief);
scene.updateMatrixWorld(true);
const { geometry, bvh } = new PathTracingSceneGenerator(scene).generate();
assert.ok(bvh);
const color = geometry.attributes.color;
assert.equal(color.itemSize, 4);
let coloredVertices = 0;
for (let i = 0; i < color.count; i++) {
  assert.equal(color.getW(i), 1, 'All merged vertices must be opaque');
  for (const value of [color.getX(i), color.getY(i), color.getZ(i)]) {
    assert.ok(Number.isFinite(value) && value > 0, 'Scene merging must preserve nonblack relief colors');
  }
  if (color.getX(i) < .9) coloredVertices++;
}
assert.ok(coloredVertices > 30000, 'The relief must retain its colored vertices');
console.log(`PASS: ${coloredVertices} relief vertices retain their colors after path-tracer scene merging`);
