import * as THREE from 'three';
import { box, cylinder, material, roundedBox } from '../primitives.js';
import { createGalvanizedFinish } from '../surface-textures.js';

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

function addSill(group, { backX, frontX, shoulderX, halfWidth, tongueHalfWidth, top }, finish) {
  // The wide front wraps around the jambs, and the narrow tongue reaches under the sashes.
  const outline = new THREE.Shape([
    new THREE.Vector2(backX, -tongueHalfWidth),
    new THREE.Vector2(shoulderX, -tongueHalfWidth),
    new THREE.Vector2(shoulderX, -halfWidth),
    new THREE.Vector2(frontX, -halfWidth),
    new THREE.Vector2(frontX, halfWidth),
    new THREE.Vector2(shoulderX, halfWidth),
    new THREE.Vector2(shoulderX, tongueHalfWidth),
    new THREE.Vector2(backX, tongueHalfWidth),
  ]);
  const bevel = .005;
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: top - 2 * bevel,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelOffset: -bevel,
  });
  const { groups, attributes: { uv } } = geometry;
  const centerX = (backX + frontX) / 2;
  for (const { start, count, materialIndex } of groups) {
    const isCap = materialIndex === 0;
    for (let i = start; i < start + count; i++) {
      const across = isCap ? uv.getX(i) - centerX : 1 - uv.getY(i);
      const along = isCap ? uv.getY(i) : uv.getX(i);
      uv.setXY(i, .5 + across / .70, .5 + along / 2.7);
    }
  }
  const sill = new THREE.Mesh(geometry, finish);
  sill.name = 'window-sill';
  sill.rotation.x = Math.PI / 2;
  sill.position.y = top - bevel;
  sill.castShadow = sill.receiveShadow = true;
  group.add(sill);
}

function addExteriorSill(group, { width, thickness, sashOuterX, sillTop }) {
  const backX = sashOuterX + .004;
  const frontX = -thickness - .035;
  const rearHeight = sillTop / 2;
  const frontHeight = rearHeight - .012;
  const lipBottom = frontHeight - .021;
  const gauge = .0016;
  // Extrude the sloped sheet and folded drip edge as a single piece.
  const section = new THREE.Shape([
    new THREE.Vector2(backX, rearHeight),
    new THREE.Vector2(frontX, frontHeight),
    new THREE.Vector2(frontX, lipBottom),
    new THREE.Vector2(frontX + .009, lipBottom),
    new THREE.Vector2(frontX + .009, lipBottom + gauge),
    new THREE.Vector2(frontX + gauge, lipBottom + gauge),
    new THREE.Vector2(frontX + gauge, frontHeight - gauge),
    new THREE.Vector2(backX, rearHeight - gauge),
  ]);
  const geometry = new THREE.ExtrudeGeometry(section, { depth: width, bevelEnabled: false });
  const { position, normal, uv } = geometry.attributes;
  const run = backX - frontX;
  for (let i = 0; i < uv.count; i++) {
    const x = position.getX(i), y = position.getY(i);
    const end = Math.abs(normal.getZ(i)) > .5;
    const vertical = Math.abs(normal.getX(i)) > .5;
    const u = end ? (x - frontX) / run : position.getZ(i) / width;
    const v = end ? y / run : (vertical ? frontHeight - y : x - frontX) / run;
    uv.setXY(i, u, v);
  }
  const sill = new THREE.Mesh(geometry, createGalvanizedFinish());
  sill.name = 'exterior-window-sill';
  sill.position.z = -width / 2;
  sill.castShadow = sill.receiveShadow = true;
  group.add(sill);
}

// The origin is at the bottom center of the opening on the room side.
export function createSideWindow({ width, height, thickness }, loadSurface, darkWood) {
  const group = new THREE.Group();
  group.name = 'side-window';
  const matteFinish = { roughness: .78, specularIntensity: .22 };
  const sashWood = new THREE.MeshPhysicalMaterial({ color: '#a7917d', ...matteFinish });
  const sillWood = darkWood.clone();
  sillWood.setValues(matteFinish);
  sillWood.normalScale.setScalar(1.35);
  const hardware = material('#4b4b46', .32, .72);
  const glazingSeal = material('#46382e', .82);
  const glassSpacer = material('#777a75', .5, .65);
  loadSurface(sashWood, 'oak.webp', 1.25, [155, 122, 86]);

  function addFrame({ x, depth, bottom, top, minZ, maxZ, profile, bevel, bottomRail = true }) {
    const stileBottom = bottomRail ? bottom + profile : bottom;
    const stileTop = top - profile;
    const centerY = (stileBottom + stileTop) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const rails = bottomRail ? [bottom + profile / 2, top - profile / 2] : [top - profile / 2];
    for (const y of rails) {
      windowTimber(group, [depth, profile, maxZ - minZ], [x, y, centerZ], sashWood, bevel);
    }
    for (const z of [minZ + profile / 2, maxZ - profile / 2]) {
      windowTimber(group, [depth, stileTop - stileBottom, profile], [x, centerY, z], sashWood, bevel);
    }
  }

  // Set the sash back from the room-side face independently of the exterior plaster depth.
  const sashOuterX = -.25;
  const sashDepth = .09;
  const sash = { x: sashOuterX + sashDepth / 2, depth: sashDepth, bottom: .083, top: height - .055, profile: .036, bevel: .004 };
  const sillTop = sash.bottom;
  const liningBackX = sashOuterX + .004;
  const liningFrontX = .04;
  const liningWidth = .065;
  const sillOverlap = .006;
  addSill(group, {
    backX: sashOuterX, frontX: .44, shoulderX: -sillOverlap,
    halfWidth: width / 2 + .11, tongueHalfWidth: width / 2 - liningWidth + sillOverlap, top: sillTop,
  }, sillWood);
  addExteriorSill(group, { width, thickness, sashOuterX, sillTop });
  addFrame({
    x: (liningBackX + liningFrontX) / 2, depth: liningFrontX - liningBackX,
    bottom: 0, top: height, minZ: -width / 2, maxZ: width / 2, profile: liningWidth, bevel: .003, bottomRail: false,
  });
  const glassX = sash.x;
  const sashFaceX = sashOuterX + sashDepth;
  const sashHalfWidth = width / 2 - .049;
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    // Thin panes transmit the view while reflecting more light at grazing angles.
    color: '#f6faf8', transmission: 1, opacity: 1, roughness: .003,
    ior: 1.5, thickness: 0, side: THREE.DoubleSide,
  });
  // The WebGL path tracer checks this material flag for shadow rays.
  glassMaterial.castShadow = false;
  const sashHeight = sash.top - sash.bottom;
  const y = (sash.top + sash.bottom) / 2;
  box(group, [.022, sashHeight, .018], [glassX, y, 0], glazingSeal);
  for (const [minZ, maxZ] of [[-sashHalfWidth, -.006], [.006, sashHalfWidth]]) {
    addFrame({ ...sash, minZ, maxZ });
    const innerWidth = maxZ - minZ - 2 * sash.profile;
    const innerHeight = sashHeight - 2 * sash.profile;
    const z = (minZ + maxZ) / 2;
    const sealWidth = .009;
    for (const edge of [-1, 1]) {
      box(group, [.016, innerHeight, sealWidth], [glassX, y, z + edge * (innerWidth - sealWidth) / 2], glazingSeal);
      box(group, [.016, sealWidth, innerWidth - 2 * sealWidth], [glassX, y + edge * (innerHeight - sealWidth) / 2, z], glazingSeal);
    }
    const paneWidth = innerWidth - sealWidth;
    const paneHeight = innerHeight - sealWidth;
    // A narrow spacer closes the air gap at the perimeter of the insulated unit.
    const spacerWidth = .006;
    for (const edge of [-1, 1]) {
      box(group, [.016, paneHeight, spacerWidth], [glassX, y, z + edge * (paneWidth - spacerWidth) / 2], glassSpacer);
      box(group, [.016, spacerWidth, paneWidth - 2 * spacerWidth], [glassX, y + edge * (paneHeight - spacerWidth) / 2, z], glassSpacer);
    }
    const glassGeometry = new THREE.PlaneGeometry(paneWidth, paneHeight);
    // Two panes with a 16 mm insulating gap, recessed within the sash.
    for (const offset of [-.008, .008]) {
      const glass = new THREE.Mesh(glassGeometry, glassMaterial);
      glass.name = 'window-glass';
      // WebGPU shadow rays otherwise treat transmissive panes as opaque.
      glass.visibleToShadowRays = false;
      glass.rotation.y = Math.PI / 2;
      glass.position.set(glassX + offset, y, z);
      group.add(glass);
    }
  }
  // The path tracers sample this broad disc, while Fast preview uses its shadow map.
  const exteriorLight = new THREE.SpotLight('#ffffff', 0, 0, Math.PI / 3, .35, 1);
  exteriorLight.position.set(-thickness - 2.65, height * .62, 0);
  exteriorLight.target.position.set(0, height * .48, 0);
  exteriorLight.radius = 1.4;
  exteriorLight.castShadow = true;
  exteriorLight.shadow.autoUpdate = false;
  exteriorLight.shadow.needsUpdate = true;
  exteriorLight.shadow.mapSize.setScalar(512);
  exteriorLight.shadow.focus = .65;
  exteriorLight.shadow.camera.far = 14;
  exteriorLight.shadow.bias = -.00025;
  exteriorLight.shadow.normalBias = .008;
  exteriorLight.shadow.radius = 5;
  group.add(exteriorLight, exteriorLight.target);

  for (const z of [-sashHalfWidth + .013, sashHalfWidth - .013]) {
    for (const y of [.40, 1.93]) {
      cylinder(group, [.0095, .0095, .068], [sashFaceX + .003, y, z], hardware);
    }
  }

  // Black powder-coated metal has a satin dielectric finish over the metal.
  const handleMetal = material('#414447', .48, .15);
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
  return { group, exteriorLight, sillTop };
}
