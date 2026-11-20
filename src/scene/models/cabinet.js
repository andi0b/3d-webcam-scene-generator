import * as THREE from 'three';
import { FLOOR_TOP } from '../../camera-geometry.js';
import { box, cylinder, material } from '../primitives.js';
import { createBook } from './book.js';
import { createPlant } from './plant.js';

const veneerStrips = [
  { u:.015, v:.08, tone:1.16 }, { u:.083, v:.01, tone:.79 },
  { u:.879, v:.06, tone:1.06 }, { u:.049, v:.14, tone:.88 },
  { u:.913, v:.04, tone:1.18 }, { u:.098, v:.10, tone:.97 },
  { u:.850, v:.02, tone:.76 }, { u:.032, v:.12, tone:1.10 },
  { u:.941, v:.08, tone:.86 }, { u:.066, v:.05, tone:1.02 },
  { u:.959, v:.03, tone:.83 }, { u:.107, v:.09, tone:1.12 },
  { u:.901, v:.13, tone:.92 }, { u:.024, v:.02, tone:1.04 },
  { u:.866, v:.11, tone:.78 }, { u:.112, v:.06, tone:1.09 },
];

function createVeneerDoor(width, height, finishes, index) {
  const count = veneerStrips.length;
  const geometry = new THREE.BoxGeometry(width, height, .027, count).toNonIndexed();
  const { uv } = geometry.attributes;
  const front = geometry.groups[4];
  const back = geometry.groups[5];
  const verticesPerStrip = front.count / count;
  geometry.clearGroups();
  geometry.addGroup(0, front.start, 0);

  // Each strip has its own grain and tone on the same flat door face.
  for (let strip = 0; strip < count; strip++) {
    const veneer = (strip + 3 * index) % count;
    const { u, v } = veneerStrips[veneer];
    const start = front.start + strip * verticesPerStrip;
    for (let i = start; i < start + verticesPerStrip; i++) {
      const across = uv.getX(i) * count - strip;
      uv.setXY(i, u + across * .027, v + uv.getY(i) * .82);
    }
    geometry.addGroup(start, verticesPerStrip, veneer + 1);
  }
  geometry.addGroup(back.start, back.count, 0);

  const door = new THREE.Mesh(geometry, finishes);
  door.castShadow = door.receiveShadow = true;
  return door;
}

export function createCabinet(wood, loadSurface) {
  const group = new THREE.Group();
  group.name = 'sideboard';
  const frame = material('#99897c', .62);
  loadSurface(frame, 'oak.webp', .16, [218,164,98]);
  const doorFinish = wood.clone();
  doorFinish.color.set('#867970');
  doorFinish.normalScale.setScalar(.26);
  doorFinish.roughness = .65;
  const doorFinishes = [doorFinish, ...veneerStrips.map(({ tone }) => {
    const finish = doorFinish.clone();
    finish.color.multiplyScalar(tone);
    return finish;
  })];
  const reveal = material('#51402f', .85);
  const metal = material('#302e29', .55, .35);
  const width = 3.30, depth = .76, bottom = .235, top = 1.16, board = .027;
  const front = .28, back = front - depth, center = (front + back) / 2;
  const middle = (bottom + top) / 2, height = top - bottom;

  for (const y of [top - board / 2, bottom + board / 2]) {
    const rail = box(group, [width, board, depth], [0, y, center], frame);
    const uv = rail.geometry.attributes.uv;
    // The oak runs along the long rails and vertically on the side panels.
    for (let i = 0; i < uv.count; i++) uv.setXY(i, .18 + (1 - uv.getY(i)) * .64, uv.getX(i));
    uv.needsUpdate = true;
  }
  for (const side of [-1, 1])
    box(group, [board, height - 2 * board, depth], [side * (width - board) / 2, middle, center], frame);
  box(group, [width - 2 * board, height - 2 * board, .025], [0, middle, back + .06], reveal);
  const opening = width - 2 * board, gap = .012;
  const doorWidth = (opening - 5 * gap) / 4;
  for (let index = 0; index < 4; index++) {
    const x = -opening / 2 + gap + doorWidth / 2 + index * (doorWidth + gap);
    const door = createVeneerDoor(doorWidth, height - 2 * board - 2 * gap, doorFinishes, index);
    door.position.set(x, middle, front - .019);
    group.add(door);
  }
  const pullHeight = .2704, mountHeight = .018;
  const mountOffset = (pullHeight - mountHeight) / 2;
  for (const seam of [-(doorWidth + gap), doorWidth + gap]) {
    for (const side of [-1, 1]) {
      const x = seam + side * .027;
      for (const y of [middle - mountOffset, middle + mountOffset]) box(group, [.012, mountHeight, .025], [x, y, .288], metal);
      box(group, [.014, pullHeight, .014], [x, middle, .307], metal);
    }
  }
  const legHeight = bottom - FLOOR_TOP;
  for (const x of [-1.48, 1.48]) for (const z of [back + .10, front - .10])
    cylinder(group, [.0125, .0125, legHeight], [x, FLOOR_TOP + legHeight / 2, z], metal);

  for (let index = 0; index < 3; index++) {
    const book = createBook({ width: .045, height: .32 + index*.02, depth: .23, color: ['#5e5141','#a79375','#d6c5a3'][index], title: ['FORM','PLACES','STUDIO'][index], flat: true });
    book.position.set(.50 + index*.012, top + index*.045, -.03); group.add(book);
  }
  const plant = createPlant({ seed: 733, scale: .78, trailing: true, overhang: .1, potColor:'#b89d79' });
  plant.position.set(1.25, top + .006, -.02); group.add(plant);
  return group;
}

