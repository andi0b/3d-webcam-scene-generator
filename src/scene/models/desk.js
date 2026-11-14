import * as THREE from 'three';
import { material, oakBox, roundedBox } from '../primitives.js';
import { createBook } from './book.js';

export function createDesk(wood, dark, baseWood, drawerWood = baseWood) {
  const group = new THREE.Group();
  group.name = 'desk';
  oakBox(group, [2.3, .095, 1.02], [0, .87, 0], wood, .045);
  for (const x of [-.97, .90]) {
    for (const z of [-.35, .35]) {
      const leg = roundedBox(group, [.065, .82, .065], [x, .41, z], baseWood, .018, 5);
      leg.rotation.z = x < 0 ? -.025 : .025;
    }
  }
  roundedBox(group, [2, .10, .055], [-.03, .77, -.39], baseWood, .012, 5);

  const titles = ['STUDIO', 'FORM & SPACE', 'NOTES'];
  const colors = ['#51463a', '#a89a81', '#ddd0b8'];
  for (const [index, title] of titles.entries()) {
    const offset = (index % 2) * .035;
    const book = createBook({ width: .048, height: .53, depth: .34, color: colors[index], title, flat: true });
    book.position.x = -.67 + offset;
    book.position.y += .92 + index * .048;
    book.position.z = -.15 + offset;
    group.add(book);
  }

  // A shallow drawer with an inset face and recessed pull.
  roundedBox(group, [.85, .16, .48], [-.40, .73, .05], drawerWood, .01);
  oakBox(group, [.82, .13, .018], [-.40, .73, .30], drawerWood, .006);
  roundedBox(group, [.18, .012, .025], [-.40, .755, .323], dark, .004);
  const profile = [[.052, 0], [.065, .006], [.065, .19], [.057, .19], [.057, .012], [0, .012]];
  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 48), material('#39362d', .38, .5));
  cup.position.set(.23, .92, -.30);
  cup.castShadow = cup.receiveShadow = true;
  group.add(cup);
  for (let i = 0; i < 6; i++) {
    const pencil = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .27 + i * .008, 8), i % 2 ? dark : wood);
    pencil.position.set(.23 + Math.cos(i * 2.4) * .032, 1.10, -.30 + Math.sin(i * 2.4) * .032);
    pencil.rotation.z = (i - 2.5) * .065;
    pencil.castShadow = true;
    group.add(pencil);
  }
  return group;
}
