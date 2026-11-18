import * as THREE from 'three';
import { createLighting } from './lighting.js';
import { material } from './primitives.js';
import { createBirchFinish, createTextureLoader } from './surface-textures.js';
import { FLOOR_TOP } from './models/ash-floor.js';
import { createBackdrop } from './models/backdrop.js';
import { createCeilingFixture } from './models/ceiling-fixture.js';
import { createClerestory } from './models/clerestory.js';
import { createDesk } from './models/desk.js';
import { createDeskLamp } from './models/desk-lamp.js';
import { createMountainRelief } from './models/mountain-relief.js';
import { createOutdoorBranches } from './models/outdoor-branches.js';
import { createPlant } from './models/plant.js';
import { createReadingChair } from './models/reading-chair.js';
import { createReadingTable } from './models/reading-table.js';
import { createRollup } from './models/rollup.js';
import { createRoomShell, ROOM_HEIGHT } from './models/room-shell.js';
import { createShelfLamp } from './models/shelf-lamp.js';
import { createShelves } from './models/shelves.js';
import { createSideWindow } from './models/side-window.js';

export function createRoom(assets, anisotropy, onTextureChanged) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c4aa91');
  const loadTexture = createTextureLoader(assets, anisotropy, onTextureChanged);
  const roomTextures = [];
  const loadRoomTexture = (filename, options) => {
    const { texture, ready } = loadTexture(filename, options);
    roomTextures.push(ready);
    return texture;
  };
  const loadSurface = (finish, filename, normalScale, fallback) => {
    finish.map = loadRoomTexture(filename, { fallback });
    finish.normalMap = loadRoomTexture(filename.replace(/\.[^.]+$/, '-normal.png'), { normal: true });
    finish.normalMap.wrapS = finish.normalMap.wrapT = THREE.RepeatWrapping;
    finish.normalScale.setScalar(normalScale);
  };
  const wood = material('#c5baa9', .32);
  loadSurface(wood, 'oak-sill.png', .50, [169, 139, 103]);
  wood.map.wrapS = wood.map.wrapT = THREE.RepeatWrapping;
  // A cool stain balances the warm oak grain to give it a charcoal-brown finish.
  const darkWood = new THREE.MeshPhysicalMaterial({
    color: '#7e9ff0',
    map: wood.map,
    normalMap: wood.normalMap,
    normalScale: new THREE.Vector2(.8, .8),
    roughness: .60,
    specularIntensity: .34,
  });
  const dark = material('#34322c');
  const birch = createBirchFinish();

  // The shell owns the openings. The frames and panes are separate inserts.
  const sideOpening = { insideX: -3.16, y: .72, z: -1.4, width: 2.2, height: 2.33, thickness: .60 };
  const clerestoryHeight = ROOM_HEIGHT * .1;
  const rearOpening = { x: .2, y: ROOM_HEIGHT - clerestoryHeight, z: 3.08, width: 6.72, height: clerestoryHeight };
  scene.add(createRoomShell(sideOpening, rearOpening, loadSurface));

  const sideWindow = createSideWindow(sideOpening, loadSurface, darkWood);
  sideWindow.group.position.set(sideOpening.insideX, sideOpening.y, sideOpening.z);
  const sillPlant = createPlant({ seed: 6333, scale: .8, trailing: true, overhang: .10, potColor: '#ba896e' });
  // The scaled saucer extends 6.4 mm below the plant's origin.
  sillPlant.position.set(.29, sideWindow.sillTop + .0064, .85);
  sillPlant.rotation.y = Math.PI / 2;
  sideWindow.group.add(sillPlant);
  const clerestory = createClerestory(rearOpening);
  clerestory.group.position.set(rearOpening.x, rearOpening.y, rearOpening.z);
  scene.add(sideWindow.group, clerestory.group);

  // Leave enough backdrop coverage for the camera's range of motion.
  const backdrop = createBackdrop(loadTexture, onTextureChanged);
  backdrop.group.position.set(-5.85, 2.10, -3.24);
  const branches = createOutdoorBranches();
  // The branch tips intercept the beam to the wall beneath the shelves.
  branches.position.set(-5.05, 0, -1.41);
  scene.add(backdrop.group, branches);

  const shelves = createShelves(wood, darkWood);
  shelves.group.position.set(-2.04, 0, -2.74);
  const shelfLamp = createShelfLamp(dark);
  shelfLamp.group.position.set(.694, shelves.upperSurfaceY, .025);
  shelves.group.add(shelfLamp.group);
  const relief = createMountainRelief(birch, dark, filename => loadRoomTexture(filename, { fallback: [91, 82, 73] }));
  relief.position.set(1.40, 1.99, -2.855);
  scene.add(shelves.group, relief);

  const desk = createDesk(wood, dark, darkWood, birch);
  desk.position.set(2.45, 0, -1.95);
  const deskLamp = createDeskLamp(dark);
  deskLamp.group.position.set(.59, .92, -.15);
  desk.add(deskLamp.group);

  const chair = createReadingChair(birch);
  chair.scale.multiplyScalar(1.656);
  const runner = chair.getObjectByName('chair-arm-1');
  chair.updateMatrixWorld(true);
  chair.position.set(-1.748, FLOOR_TOP - new THREE.Box3().setFromObject(runner).min.y, -1.688);
  chair.rotation.y = .40 + Math.PI / 6;
  const readingTable = createReadingTable(wood);
  // Set the table between the seated person's left arm and the back wall.
  readingTable.position.set(-.95, 0, -2.54);
  const rollup = createRollup();
  rollup.position.set(3.32, FLOOR_TOP, .08);
  rollup.rotation.y = -1.32;
  scene.add(rollup);
  const ceiling = createCeilingFixture();
  ceiling.group.position.set(-.45, 3.90, -1.22);
  scene.add(desk, chair, readingTable, ceiling.group);

  const lighting = createLighting(scene, {
    sideWindow, clerestory, ceiling, deskLamp, shelfLamp, shelfWash: shelves.wash, backdrop,
  });
  async function ready() {
    let timer;
    try {
      const errors = await Promise.race([
        Promise.all([...roomTextures, backdrop.ready]),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Scene textures did not finish loading.')), 15000);
        }),
      ]);
      const error = errors.find(Boolean);
      if (error) throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  return { scene, lighting, backdrop, ready };
}
