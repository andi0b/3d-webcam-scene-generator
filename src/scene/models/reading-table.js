import * as THREE from 'three';
import { cylinder, material, oakBox } from '../primitives.js';
import { createBook } from './book.js';

export function createReadingTable(wood) {
  const group = new THREE.Group();
  group.name = 'reading-table';
  const top = .54;
  const legMaterial = material('#9b795b', .78);
  oakBox(group, [.56, .05, .48], [0, top - .025, 0], wood, .024);
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const leg = cylinder(group, [.025, .017, .516], [x * .177, .24, z * .145], legMaterial);
      leg.rotation.set(z * -.09, 0, x * .09);
    }
  }
  const books = [
    { x: -.145, z: -.035, width: .039, height: .28, depth: .20, color: '#46594f', title: 'FIELD NOTES', angle: -.08 },
    { x: -.113, z: -.018, width: .032, height: .24, depth: .174, color: '#a47955', title: 'WOODLANDS', angle: .10 },
    { x: -.083, z: -.045, width: .026, height: .19, depth: .14, color: '#847461', title: 'SEASONS', angle: -.16 },
  ];
  let bookBase = top;
  for (const { x, z, angle, ...spec } of books) {
    const book = createBook({ ...spec, flat: true });
    book.position.x = x;
    book.position.y += bookBase;
    book.position.z = z;
    book.rotation.y = angle;
    group.add(book);
    bookBase += spec.width;
  }
  return group;
}
