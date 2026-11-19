import * as THREE from 'three';
import { box, material } from '../primitives.js';
import { exteriorPlasterMaps, plasterNormalMap } from '../surface-textures.js';
import { createAshFloor } from './ash-floor.js';

export const ROOM_HEIGHT = 3.95;
const LEFT_X = -3.25, RIGHT_X = 4.05;
const MIN_Z = -3, MAX_Z = 3;

export function createRoomShell(sideOpening, rearOpening, loadSurface) {
  const group = new THREE.Group();
  group.name = 'room-shell';
  const wall = material('#e1d7c9');
  wall.normalMap = plasterNormalMap();
  const exteriorPlaster = material('#ffffff');
  Object.assign(exteriorPlaster, exteriorPlasterMaps());
  const ceiling = material('#ffffff', .91);
  loadSurface(ceiling, 'board-formed-concrete.jpg', .55, [167, 160, 147]);

  box(group, [7.3, ROOM_HEIGHT, .18], [.4, ROOM_HEIGHT / 2, MIN_Z], wall);
  box(group, [.18, ROOM_HEIGHT, 6], [3.65, ROOM_HEIGHT / 2, 0], wall);

  // Extrude one square-edged opening through the full wall depth.
  const nearZ = sideOpening.z - sideOpening.width / 2;
  const farZ = sideOpening.z + sideOpening.width / 2;
  const sideTop = sideOpening.y + sideOpening.height;
  const sideProfile = new THREE.Shape([
    new THREE.Vector2(MIN_Z, 0),
    new THREE.Vector2(MIN_Z, ROOM_HEIGHT),
    new THREE.Vector2(MAX_Z, ROOM_HEIGHT),
    new THREE.Vector2(MAX_Z, 0),
  ]);
  sideProfile.holes.push(new THREE.Path([
    new THREE.Vector2(nearZ, sideOpening.y),
    new THREE.Vector2(farZ, sideOpening.y),
    new THREE.Vector2(farZ, sideTop),
    new THREE.Vector2(nearZ, sideTop),
  ]));
  const sideGeometry = new THREE.ExtrudeGeometry(sideProfile, {
    depth: sideOpening.thickness,
    bevelEnabled: false,
  });
  // ExtrudeGeometry assigns its caps to material 0 and the opening reveals to 1.
  const sideWall = new THREE.Mesh(sideGeometry, [wall, exteriorPlaster]);
  sideWall.name = 'side-wall';
  sideWall.position.x = sideOpening.insideX;
  sideWall.rotation.y = -Math.PI / 2;
  sideWall.castShadow = sideWall.receiveShadow = true;

  const rearWall = new THREE.Group();
  rearWall.name = 'rear-wall';
  rearWall.position.z = rearOpening.z;
  const left = rearOpening.x - rearOpening.width / 2;
  const right = rearOpening.x + rearOpening.width / 2;
  const rearTop = rearOpening.y + rearOpening.height;
  for (const [bottom, top] of [[0, rearOpening.y], [rearTop, ROOM_HEIGHT]]) {
    if (top > bottom) box(rearWall, [7.3, top - bottom, .18], [.4, (bottom + top) / 2, 0], wall);
  }
  for (const [min, max] of [[LEFT_X, left], [right, RIGHT_X]]) {
    if (max > min) box(rearWall, [max - min, rearOpening.height, .18], [(min + max) / 2, rearOpening.y + rearOpening.height / 2, 0], wall);
  }
  group.add(sideWall, rearWall);

  // Solid backing closes the joints between the four visible ceiling slabs.
  box(group, [7.3, .08, 6], [.4, 4.03, 0], ceiling);
  const slabWidth = 6.72 / 4;
  for (const [index, grainStart] of [.03, .36, .69, .07].entries()) {
    const x = -3.16 + (index + .5) * slabWidth;
    const slab = box(group, [slabWidth - .006, .04, 6], [x, 3.97, 0], ceiling);
    const uv = slab.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const across = uv.getX(i), along = uv.getY(i);
      uv.setXY(i, index % 2 ? 1 - along : along, grainStart + across * .24);
    }
  }

  box(group, [7.3, .09, 6.18], [.4, -.0665, 0], material('#9e9990', .76));
  group.add(createAshFloor(loadSurface));
  const trim = material('#e0d1ba');
  box(group, [7.3, .14, .09], [.4, .05, -2.87], trim);
  box(group, [.09, .14, 5.9], [-3.12, .05, 0], trim);
  return group;
}
