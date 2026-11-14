import * as THREE from 'three';
import { box, material } from '../primitives.js';
import { plasterNormalMap } from '../surface-textures.js';
import { createAshFloor } from './ash-floor.js';

export const ROOM_HEIGHT = 3.95;
const LEFT_X = -3.25, RIGHT_X = 4.05;
const MIN_Z = -3, MAX_Z = 3;

export function createRoomShell(sideOpening, rearOpening, loadSurface) {
  const group = new THREE.Group();
  group.name = 'room-shell';
  const wall = material('#e1d7c9');
  wall.normalMap = plasterNormalMap();
  const ceiling = material('#ffffff', .91);
  loadSurface(ceiling, 'board-formed-concrete.jpg', .55, [167, 160, 147]);

  box(group, [7.3, ROOM_HEIGHT, .18], [.4, ROOM_HEIGHT / 2, MIN_Z], wall);
  box(group, [.18, ROOM_HEIGHT, 6], [3.65, ROOM_HEIGHT / 2, 0], wall);

  // The window and surrounding wall share the same opening dimensions and placement.
  const sideWall = new THREE.Group();
  sideWall.name = 'side-wall';
  sideWall.position.x = sideOpening.x;
  const nearZ = sideOpening.z - sideOpening.width / 2;
  const farZ = sideOpening.z + sideOpening.width / 2;
  const sideTop = sideOpening.y + sideOpening.height;
  for (const [min, max] of [[MIN_Z, nearZ], [farZ, MAX_Z]]) {
    if (max > min) box(sideWall, [.18, ROOM_HEIGHT, max - min], [0, ROOM_HEIGHT / 2, (min + max) / 2], wall);
  }
  for (const [bottom, top] of [[0, sideOpening.y], [sideTop, ROOM_HEIGHT]]) {
    if (top > bottom) box(sideWall, [.18, top - bottom, sideOpening.width], [0, (bottom + top) / 2, sideOpening.z], wall);
  }

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
