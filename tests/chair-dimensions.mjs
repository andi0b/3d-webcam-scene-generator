import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PathTracingSceneGenerator } from 'three-gpu-pathtracer';

// The chair builds its procedural textures in a browser canvas. Geometry and
// bounds can be checked in Node using a minimal drawing-context substitute.
const context = {
  fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, quadraticCurveTo() {}, stroke() {},
  createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; },
  putImageData() {},
};
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
const { createReadingChair } = await import('../src/scene/models/reading-chair.js');
const chair = createReadingChair();
chair.updateMatrixWorld(true);
const size = new THREE.Box3().setFromObject(chair).getSize(new THREE.Vector3());
// IKEA's dimensions are 68 × 82 × 100 cm; allow a little for bevels and padding.
for (const [name, actual, expected] of [['width',size.x,.68],['depth',size.z,.82],['height',size.y,1]]) {
  assert.ok(Math.abs(actual-expected)<.035, `${name}: ${actual.toFixed(3)}m, expected about ${expected}m`);
}
const cushionBounds = new THREE.Box3().setFromObject(chair.getObjectByName('chair-cushion'));
for (const side of [-1, 1]) {
  const armBounds = new THREE.Box3().setFromObject(chair.getObjectByName(`chair-arm-${side}`));
  const supportBounds = new THREE.Box3().setFromObject(chair.getObjectByName(`chair-support-${side}`));
  const clearance = side > 0 ? armBounds.min.x-supportBounds.max.x : supportBounds.min.x-armBounds.max.x;
  assert.ok(clearance >= 0 && clearance < .004, `arm/support side clearance: ${clearance.toFixed(4)}m`);
  const coverage = side > 0 ? cushionBounds.max.x-supportBounds.max.x : supportBounds.min.x-cushionBounds.min.x;
  assert.ok(coverage > -.002, `cushion should cover the support: ${coverage.toFixed(4)}m`);
}
console.log(`PASS: chair bounds ${(size.x*100).toFixed(1)} × ${(size.z*100).toFixed(1)} × ${(size.y*100).toFixed(1)} cm`);
const cushion = chair.getObjectByName('chair-cushion');
const [front, backing, ends] = cushion.children;
assert.notEqual(front.material, backing.material, 'The cushion must have separate front and backing fabrics');
assert.ok(ends.material.color.equals(front.material.color), 'The rolled ends must match the front fabric color');
assert.equal(ends.material.map, null, 'The rolled edges must not stretch the face texture');
for (const side of [-1, 1]) {
  for (const name of [`chair-arm-${side}`, `chair-support-${side}`]) {
    const [faces, edges] = chair.getObjectByName(name).children;
    assert.notEqual(faces.material, edges.material, 'The veneer faces and layered edges must use separate materials');
  }
}

// The tracer merges meshes in UUID order. Check the material on the actual
// merged triangles, since a material can be present but applied to the wrong mesh.
const meshes = [];
chair.traverse(object => { if (object.isMesh) meshes.push(object); });
meshes.sort((a, b) => a.uuid.localeCompare(b.uuid));
const generated = new PathTracingSceneGenerator(chair).generate();
const { groups, index } = generated.geometry;
const materialIndices = generated.geometry.getAttribute('materialIndex');
assert.equal(groups.length, meshes.length);
for (const { start, count, materialIndex } of groups) {
  const expected = meshes[materialIndex].material;
  const expectedIndex = generated.materials.indexOf(expected);
  for (let i = start; i < start + count; i++) {
    assert.equal(materialIndices.getX(index.getX(i)), expectedIndex, 'Merged triangles must retain their source material');
  }
}
console.log('PASS: chair triangles retain their materials after path-tracer scene merging');
