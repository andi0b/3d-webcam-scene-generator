import * as THREE from 'three';
import { box, cylinder, material, roundedBox } from '../primitives.js';

function windowTimber(group, size, position, finish, radius, grainWidth = .36) {
  const mesh = roundedBox(group, size, position, finish, radius, 2);
  const { groups, attributes: { uv } } = mesh.geometry;
  const [x, y, z] = size;
  const dimensions = { x, y, z };
  const grainAxis = y > z ? 'y' : 'z';
  const faceAxes = [['z', 'y'], ['x', 'z'], ['x', 'y']];
  // Keep the original grain samples in the model's local coordinates.
  const grainCenter = .5 + Math.sin(position[1] * 4 + position[2] * 7 - 6.92) * .045;
  for (const { start, count, materialIndex } of groups) {
    const [uAxis, vAxis] = faceAxes[Math.floor(materialIndex / 2)];
    const swap = uAxis === grainAxis;
    const acrossScale = dimensions[swap ? vAxis : uAxis] / grainWidth;
    const alongScale = dimensions[swap ? uAxis : vAxis] / 2.7;
    for (let i = start; i < start + count; i++) {
      const u = uv.getX(i) - .5;
      const v = uv.getY(i) - .5;
      uv.setXY(i, grainCenter + (swap ? v : u) * acrossScale, .5 + (swap ? u : v) * alongScale);
    }
  }
}

// This insert fits a 2.2 m by 2.33 m opening. Its origin is at the bottom center.
export function createSideWindow(loadSurface) {
  const group = new THREE.Group();
  group.name = 'side-window';
  const sashWood = material('#e2e6e9', .52);
  const sillWood = material('#f1eeeb', .46);
  const hardware = material('#4b4b46', .32, .72);
  const glazingSeal = material('#46382e', .82);
  loadSurface(sashWood, 'oak.png', .32);
  loadSurface(sillWood, 'oak-sill.png', .35);

  function addFrame({ x, depth, bottom, top, minZ, maxZ, profile, bevel }) {
    const centerY = (bottom + top) / 2;
    const centerZ = (minZ + maxZ) / 2;
    for (const y of [bottom + profile / 2, top - profile / 2]) {
      windowTimber(group, [depth, profile, maxZ - minZ], [x, y, centerZ], sashWood, bevel);
    }
    for (const z of [minZ + profile / 2, maxZ - profile / 2]) {
      windowTimber(group, [depth, top - bottom - 2 * profile, profile], [x, centerY, z], sashWood, bevel);
    }
  }

  // The sashes sit near the exterior face, behind the oak lining and sill.
  windowTimber(group, [.61, .066, 2.42], [.225, -.005, 0], sillWood, .009, .70);
  const lining = { bottom: .028, top: 2.33, minZ: -1.1, maxZ: 1.1, bevel: .003 };
  addFrame({ ...lining, x: .055, depth: .15, profile: .034 });
  addFrame({ ...lining, x: -.098, depth: .055, profile: .065 });
  const sash = { x: -.059, depth: .09, bottom: .083, top: 2.275, profile: .036, bevel: .004 };
  const sashFaceX = sash.x + sash.depth / 2;
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#d8e1df', transparent: true, opacity: .035, roughness: .06,
    envMapIntensity: .5, side: THREE.DoubleSide, depthWrite: false,
  });
  const lights = [];
  const sashHeight = sash.top - sash.bottom;
  const y = (sash.top + sash.bottom) / 2;
  box(group, [.022, sashHeight, .018], [sash.x - .037, y, 0], glazingSeal);
  for (const [minZ, maxZ] of [[-1.051, -.006], [.006, 1.051]]) {
    addFrame({ ...sash, minZ, maxZ });
    const innerWidth = maxZ - minZ - 2 * sash.profile;
    const innerHeight = sashHeight - 2 * sash.profile;
    const z = (minZ + maxZ) / 2;
    const sealWidth = .009;
    for (const edge of [-1, 1]) {
      box(group, [.016, innerHeight, sealWidth], [sashFaceX - .023, y, z + edge * (innerWidth - sealWidth) / 2], glazingSeal);
      box(group, [.016, sealWidth, innerWidth - 2 * sealWidth], [sashFaceX - .023, y + edge * (innerHeight - sealWidth) / 2, z], glazingSeal);
    }
    const paneWidth = innerWidth - sealWidth;
    const paneHeight = innerHeight - sealWidth;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(paneWidth, paneHeight), glassMaterial);
    glass.rotation.y = Math.PI / 2;
    glass.position.set(sashFaceX - .033, y, z);
    group.add(glass);

    // The diffuse emitters match the panes and face into the room.
    const daylight = new THREE.RectAreaLight('#ffffff', 0, paneWidth, paneHeight);
    daylight.position.set(glass.position.x + .008, y, z);
    daylight.rotation.y = -Math.PI / 2;
    lights.push(daylight);
    group.add(daylight);
  }
  for (const z of [-1.038, 1.038]) {
    for (const y of [.40, 1.93]) {
      cylinder(group, [.0095, .0095, .068], [sashFaceX + .003, y, z], hardware);
    }
  }

  const handleMetal = material('#252729', .34, .52);
  const handleY = 1.03, handleZ = -.025;
  roundedBox(group, [.018, .126, .029], [sashFaceX + .008, handleY, handleZ], handleMetal, .003, 2);
  const handleProfile = new THREE.Shape();
  handleProfile.moveTo(.016, .017);
  handleProfile.lineTo(.112, .017);
  handleProfile.lineTo(.112, -.165);
  handleProfile.lineTo(.087, -.165);
  handleProfile.lineTo(.087, -.028);
  handleProfile.quadraticCurveTo(.087, -.017, .076, -.017);
  handleProfile.lineTo(.016, -.017);
  handleProfile.closePath();
  const handle = new THREE.Mesh(new THREE.ExtrudeGeometry(handleProfile, {
    depth: .022, bevelThickness: .002, bevelSize: .002, bevelSegments: 2, curveSegments: 5,
  }), handleMetal);
  handle.position.set(sashFaceX - .001, handleY, handleZ - .011);
  handle.castShadow = handle.receiveShadow = true;
  group.add(handle);
  return { group, lights };
}
