import * as THREE from 'three';
import { createLighting } from './lighting.js';
import { material } from './primitives.js';
import { createBirchFinish, createTextureLoader } from './surface-textures.js';
import { FLOOR_TOP } from './models/ash-floor.js';
import { createBackdrop } from './models/backdrop.js';
import { createCeilingFixture } from './models/ceiling-fixture.js';
import { createClerestory } from './models/clerestory.js';
import { createCabinet } from './models/cabinet.js';
import { box } from './primitives.js';
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

export function createRoom(assets, anisotropy, onTextureChanged, onArtworkError) {
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
    finish.normalMap = loadRoomTexture(filename.replace(/\.[^.]+$/, '-normal.webp'), { normal: true });
    finish.normalMap.wrapS = finish.normalMap.wrapT = THREE.RepeatWrapping;
    finish.normalScale.setScalar(normalScale);
  };
  const wood = material('#c5baa9', .32);
  loadSurface(wood, 'oak-sill.webp', .50, [169, 139, 103]);
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
  relief.scale.setScalar(.84);
  relief.position.set(1.95, 2.54, -2.855);
  scene.add(shelves.group, relief);

  const cabinet = createCabinet(wood, loadSurface);
  cabinet.position.set(2.84, 0, -.80);
  cabinet.rotation.y = -Math.PI / 2;
  const deskLamp = createDeskLamp(dark);
  deskLamp.group.position.set(-1.38, 1.16, 0);
  cabinet.add(deskLamp.group);
  const imageMaterials = [];
  const pictureSizes = [[1.00,.70], [.75,.58]];
  const pictureAspect = ([width, height]) => (width - .14) / (height - .14);
  function fitImage(texture, targetAspect) {
    const source = texture.image;
    if (!source?.width || !source?.height) return;
    const aspect = source.width / source.height;
    const x = Math.min(1, targetAspect / aspect), y = Math.min(1, aspect / targetAspect);
    texture.repeat.set(x, y);
    texture.offset.set((1 - x) / 2, (1 - y) / 2);
    texture.needsUpdate = true;
  }
  function loadPrint(filename, aspect, fallback) {
    const { texture, ready } = loadTexture(filename, { fallback });
    roomTextures.push(ready.then(error => { if (!error) { fitImage(texture, aspect); onTextureChanged(); } return error; }));
    return texture;
  }
  const frameFinish = material('#2d2a26', .52);
  const matFinish = material('#eee9dc', .96);
  function picture(x, y, width, height, imageMaterial) {
    const frame = new THREE.Group();
    box(frame, [width,height,.04], [0,0,0], frameFinish);
    box(frame, [width-.045,height-.045,.012], [0,0,.026], matFinish);
    const image = new THREE.Mesh(new THREE.PlaneGeometry(width-.14,height-.14), imageMaterial);
    image.position.z = .033;
    frame.add(image); frame.position.set(x,y,-2.84); scene.add(frame);
  }
  const pictureMaterials = Array.from({length: 2}, () => new THREE.MeshStandardMaterial({color:'white', roughness:.9}));
  imageMaterials.push(...pictureMaterials);
  picture(1.54, 1.54, ...pictureSizes[0], pictureMaterials[0]);
  picture(2.47, 1.60, ...pictureSizes[1], pictureMaterials[1]);

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
  rollup.position.set(.28 + .84 * 1.40 / 2, FLOOR_TOP, -2.43);
  rollup.scale.set(1.40, 1.30, 1);
  scene.add(rollup);
  const ceiling = createCeilingFixture();
  ceiling.group.position.set(-.45, 3.90, -1.22);
  scene.add(cabinet, chair, readingTable, ceiling.group);

  const lighting = createLighting(scene, {
    sideWindow, clerestory, ceiling, deskLamp, shelfLamp, shelfWash: shelves.wash, backdrop,
  });
  async function ready({ includeArtwork = false } = {}) {
    let timer;
    const visibleArtwork = rollup.visible && rollup.userData.extended.visible ? 3 : 2;
    try {
      const errors = await Promise.race([
        Promise.all([...roomTextures, backdrop.ready, ...(includeArtwork ? artworkLoads.slice(0, visibleArtwork) : [])]),
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
  const defaults = [
    loadPrint('alpine-lake-print.jpg', pictureAspect(pictureSizes[0]), [164,142,110]),
    loadPrint('misty-forest-print.jpg', pictureAspect(pictureSizes[1]), [100,115,90]),
  ];
  imageMaterials.forEach((mat, i) => { mat.map = defaults[i]; });
  const rollupFace = rollup.userData.face;
  const { width: rollupWidth, height: rollupHeight } = rollupFace.geometry.parameters;
  const rollupAspect = (rollupWidth * rollup.scale.x) / (rollupHeight * rollup.scale.y);
  const defaultRollup = loadPrint('roomlight-rollup.webp', rollupAspect, [41,58,45]);
  rollupFace.material.map = defaultRollup;
  const versions = [0,0,0], currentImages = [null,null,null];
  const artworkLoads = [];
  const artworkErrors = [];
  const imageAspects = [pictureAspect(pictureSizes[0]), pictureAspect(pictureSizes[1]), rollupAspect];
  function setImage(index, url) {
    if (currentImages[index] === url) return;
    currentImages[index] = url;
    if (artworkErrors[index]) {
      artworkErrors[index] = '';
      onArtworkError(artworkErrors.find(Boolean) || '');
    }
    const mat = index === 2 ? rollupFace.material : imageMaterials[index];
    const version = ++versions[index];
    const previous = mat.map;
    if (previous && previous !== defaultRollup && !defaults.includes(previous)) previous.dispose();
    if (!url) {
      artworkLoads[index] = undefined;
      mat.map = index === 2 ? defaultRollup : defaults[index];
      mat.color.set('white');
      mat.needsUpdate = true; onTextureChanged(); return;
    }
    mat.map = index === 2 ? defaultRollup : defaults[index];
    mat.color.set('white'); mat.needsUpdate = true;
    artworkLoads[index] = new THREE.TextureLoader().loadAsync(url).then(texture => {
      if (version !== versions[index]) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      fitImage(texture, imageAspects[index]);
      mat.map = texture;
      mat.needsUpdate = true;
      onTextureChanged();
    }).catch(() => {
      if (version !== versions[index]) return;
      const label = ['left picture', 'right picture', 'rollup'][index];
      const error = new Error(`Could not load the ${label} artwork. Choose another image or use the default.`);
      artworkErrors[index] = error.message;
      onArtworkError(artworkErrors.find(Boolean));
      return error;
    });
  }
  function updateDecoration(settings) {
    rollup.visible = settings.rollup !== 'absent';
    rollup.userData.extended.visible = settings.rollup === 'extended';
    [settings.frame1Image, settings.frame2Image, settings.rollupImage].forEach((url, i) => setImage(i, url));
    onTextureChanged();
  }
  return { scene, lighting, backdrop, ready, updateDecoration };
}

