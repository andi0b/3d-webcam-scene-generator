import * as THREE from 'three';
import { randomSource } from '../random-source.js';
import { leafGeometry } from './leaf-geometry.js';

export function createOutdoorBranches() {
  const group = new THREE.Group();
  group.name = 'outdoor-branches';
  const bark = new THREE.MeshStandardMaterial({ color: '#514134', roughness: .95 });
  const foliage = new THREE.MeshStandardMaterial({ color: '#82743e', roughness: .8, side: THREE.DoubleSide });
  const random = randomSource(2741);

  function addBranch(points, baseRadius, tipRadius) {
    const curve = new THREE.CatmullRomCurve3(points);
    const segments = Math.max(6, Math.ceil(curve.getLength() * 20));
    const sides = 7;
    const geometry = new THREE.TubeGeometry(curve, segments, 1, sides);
    const { position, normal } = geometry.attributes;
    for (let row = 0; row <= segments; row++) {
      const t = row / segments;
      const center = curve.getPointAt(t);
      const radius = THREE.MathUtils.lerp(baseRadius, tipRadius, t);
      for (let side = 0; side <= sides; side++) {
        const i = row * (sides + 1) + side;
        position.setXYZ(i,
          center.x + normal.getX(i) * radius,
          center.y + normal.getY(i) * radius,
          center.z + normal.getZ(i) * radius);
      }
    }
    const mesh = new THREE.Mesh(geometry, bark);
    mesh.castShadow = true;
    group.add(mesh);
    return curve;
  }

  // Keep the thicker stem at the edge of the beam and fan the tips toward the wall.
  const main = [
    [-.04, 2.28, .99], [-.015, 2.56, .68], [.012, 2.78, .46],
    [.045, 2.95, .285], [.032, 3.12, .185], [.08, 3.22, .23],
  ].map(point => new THREE.Vector3(...point));
  const limbs = [
    addBranch(main, .031, .0018),
    addBranch([
      main[2], new THREE.Vector3(-.022, 2.83, .54),
      new THREE.Vector3(-.07, 2.97, .61), new THREE.Vector3(-.05, 3.13, .57),
    ], .012, .0015),
    addBranch([
      main[2], new THREE.Vector3(.02, 2.74, .35),
      new THREE.Vector3(.05, 2.72, .22), new THREE.Vector3(.02, 2.78, .12),
    ], .011, .0015),
    addBranch([
      main[3], new THREE.Vector3(.01, 3.05, .37),
      new THREE.Vector3(.025, 3.17, .44), new THREE.Vector3(.055, 3.25, .49),
    ], .010, .0015),
    addBranch([
      main[3], new THREE.Vector3(.05, 2.96, .19),
      new THREE.Vector3(.03, 3.01, .10), new THREE.Vector3(.06, 3.10, .07),
    ], .009, .0015),
  ];
  for (const limb of limbs) {
    for (const [index, t] of [.42, .65, .84].entries()) {
      const side = index % 2 ? -1 : 1;
      const start = limb.getPointAt(t);
      const end = start.clone().addScaledVector(limb.getTangentAt(t), .05 + random() * .055);
      end.add(new THREE.Vector3((random() - .5) * .06, .025 + random() * .04, side * (.05 + random() * .065)));
      const bend = start.clone().lerp(end, .5);
      bend.y -= .018;
      const twig = addBranch([start, bend, end], .0045, .0008);
      for (const [leafIndex, leafT] of [.42, .68, .95].entries()) {
        const leaf = new THREE.Mesh(leafGeometry, foliage);
        leaf.position.copy(twig.getPointAt(leafT));
        const swing = leafIndex % 2 ? -side : side;
        leaf.rotation.set(
          (random() - .5) * .8,
          Math.PI / 2 + (random() - .5) * 1.2,
          swing * (.45 + random() * 1.45),
        );
        leaf.scale.setScalar(.042 + random() * .033);
        leaf.castShadow = true;
        group.add(leaf);
      }
    }
  }
  return group;
}
