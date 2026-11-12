import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { createNormalTexture } from './surface-normals.js';

// Stable variation: changing a light or exporting never regenerates the plants.
function randomSource(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

let plasterTexture;
export function plasterNormalMap() {
  if (!plasterTexture) {
    const size = 128;
    const random = randomSource(123);
    const height = Float32Array.from({ length: size * size }, random);
    plasterTexture = createNormalTexture(size, size, (x, y) => height[y * size + x], .045);
    plasterTexture.repeat.set(12, 8);
  }
  return plasterTexture;
}

export function oakNormalMap({ image }) {
  const { width, height } = image;
  const { data } = image.getContext('2d').getImageData(0, 0, width, height);
  return createNormalTexture(width, height, (x, y) => data[(y * width + x) * 4] / 255, 1.3);
}

// Fine longitudinal pores, rather than a whole photograph repeated on every board.
export function oakTexture(seed = 18) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 1024;
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(256, 1024);
  const random = randomSource(seed), phases = Array.from({length: 12}, () => random() * 6.28);
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 256; x++) {
    const bend = Math.sin(y / 190 + phases[0]) * 5 + Math.sin(y / 370 + phases[1]) * 9;
    const grain = Math.sin((x + bend) * .36 + phases[2]) * 3 + Math.sin((x + bend * .5) * 1.9) * 1.8;
    const broad = Math.sin(x * .045 + Math.sin(y * .003) + phases[3]) * 1.5;
    const pore = random() > .992 ? -7 : 0;
    const variation = grain * .35 + broad + pore + (random() - .5) * 4;
    const i = (y * 256 + x) * 4;
    pixels.data.set([174 + variation, 140 + variation, 99 + variation, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function applySurfaceTexture(material, textureLoader, url, anisotropy, normalScale) {
  material.map = textureLoader.load(url, ({ image }) => {
    // Keep the shallow surface relief aligned with the visible grain and pores.
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(image.width / 2);
    canvas.height = Math.floor(image.height / 2);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { width, height } = canvas;
    const { data } = context.getImageData(0, 0, width, height);
    material.normalMap = createNormalTexture(width, height, (x, y) => data[(y * width + x) * 4 + 1] / 255, 1.3);
    material.normalMap.anisotropy = anisotropy;
    material.normalScale.setScalar(normalScale);
    material.needsUpdate = true;
  });
  material.map.colorSpace = THREE.SRGBColorSpace;
  material.map.anisotropy = anisotropy;
}

export function addAshFloor(scene, textureLoader, anisotropy) {
  const material = new THREE.MeshStandardMaterial({ roughness: .62 });
  applySurfaceTexture(material, textureLoader, '/assets/white-ash.jpg', anisotropy, .5);
  const random = randomSource(8619);
  const grainWidth = .10;
  const margin = .012;
  for (let row = 0; row < 25; row++) {
    let z = -3;
    let length = .45 + random() * 1.05;
    while (z < 3) {
      const remaining = 3 - z;
      const depth = remaining - length < .28 ? remaining : length;
      const geometry = new THREE.BoxGeometry(.283, .065, depth - .002);
      const uv = geometry.getAttribute('uv');
      // Each plank takes a different cut from the sheet, with grain running along its length.
      const grainLength = depth / 2.1;
      const uStart = margin + random() * (1 - grainWidth - 2 * margin);
      const vStart = margin + random() * (1 - grainLength - 2 * margin);
      const reverse = random() < .5;
      for (let i = 0; i < uv.count; i++) {
        const u = reverse ? 1 - uv.getX(i) : uv.getX(i);
        const v = reverse ? 1 - uv.getY(i) : uv.getY(i);
        uv.setXY(i, uStart + u * grainWidth, vStart + v * grainLength);
      }
      const plank = new THREE.Mesh(geometry, material);
      plank.position.set(-3.24 + row * .285, -.05, z + depth / 2);
      plank.receiveShadow = true;
      scene.add(plank);
      z += depth;
      length = 1.23 + random() * .49;
    }
  }
}

export function createPipeline(renderer, scene, camera, windowMaterial) {
  const reflectionTarget = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const reflectionCamera = new THREE.CubeCamera(.1, camera.far, reflectionTarget);
  reflectionCamera.position.set(-.5, 1.35, -1.35);
  const captureBackground = new THREE.Color('#252629');
  let reflectionsDirty = true;
  let reflectedWindowIntensity = 1;
  // Offscreen MSAA requires a sample count supported by both attachments.
  const gl = renderer.getContext();
  const colorSamples = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) ?? [];
  const depthSamples = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES) ?? [];
  const samples = Math.max(0, ...colorSamples.filter(count => count <= 4 && depthSamples.includes(count)));
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new SSAOPass(scene, camera, 512, 512, 32);
  ao.kernelRadius = .065;
  ao.minDistance = .00015;
  ao.maxDistance = .003;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  composer.addPass(new SMAAPass());
  return {
    get guides(){return {normal:ao.normalRenderTarget.texture,depth:ao.normalRenderTarget.depthTexture,color:composer.readBuffer.texture};},
    invalidateReflections(windowIntensity = reflectedWindowIntensity) {
      reflectedWindowIntensity = windowIntensity;
      reflectionsDirty = true;
    },
    resize(w, h, ratio) { composer.setPixelRatio(ratio); composer.setSize(w, h); },
    render() {
      const { environment, environmentIntensity } = scene;
      try {
        if (reflectionsDirty) {
          const background = scene.background;
          const windowIntensity = windowMaterial.emissiveIntensity;
          // Capture direct lighting once. Three.js filters the cubemap for each material's roughness.
          scene.environment = null;
          scene.background = captureBackground;
          windowMaterial.emissiveIntensity = reflectedWindowIntensity;
          try {
            reflectionCamera.update(renderer, scene);
            reflectionsDirty = false;
          } finally {
            scene.background = background;
            windowMaterial.emissiveIntensity = windowIntensity;
          }
        }
        scene.environment = reflectionTarget.texture;
        scene.environmentIntensity = .75;
        // SSAO caches projection uniforms; keep them current for the FOV slider.
        ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
        ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
        composer.render();
      } finally {
        scene.environment = environment;
        scene.environmentIntensity = environmentIntensity;
      }
    },
  };
}

// A gridded, cupped heart-shaped blade, with a folded midrib and drooping tip.
function leafGeometry() {
  const positions = [], uvs = [], indices = [], rows = 16, cols = 8;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const width = .48 * Math.pow(Math.sin(Math.PI * t), .65) * (1.15 - .65 * t);
    for (let i = 0; i <= cols; i++) {
      const u = i / cols * 2 - 1;
      positions.push(u * width, t, .13 * Math.sin(t * Math.PI) * (1 - Math.abs(u)) - .17 * t * t + .035 * u * u);
      uvs.push(i / cols, t);
      if (j < rows && i < cols) {
        const a = j * (cols + 1) + i;
        indices.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

function leafTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 128, 0);
  gradient.addColorStop(0, '#617b35'); gradient.addColorStop(.48, '#9aaa60'); gradient.addColorStop(.52, '#819844'); gradient.addColorStop(1, '#496a2e');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#b1b77b'; ctx.lineWidth = .7;
  ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128);
  for (let y = 15; y < 125; y += 15) {
    ctx.moveTo(64, y); ctx.quadraticCurveTo(38, y + 4, 5, y + 24);
    ctx.moveTo(64, y); ctx.quadraticCurveTo(90, y + 4, 123, y + 24);
  }
  ctx.stroke(); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

const blade = leafGeometry(), leafMap = leafTexture();
const leaves = ['#c2d693', '#a8c47d', '#8fae60', '#d2da9d'].map(color => new THREE.MeshPhysicalMaterial({
  color, map: leafMap, roughness: .58, side: THREE.DoubleSide, emissive: '#536c25', emissiveIntensity: .06,
  clearcoat: .06, clearcoatRoughness: .65,
}));
const stemMaterial = new THREE.MeshStandardMaterial({ color: '#59703a', roughness: .8 });

export function addPlant(scene, x, y, z, scale = 1, trailing = false, { overhang = 0 } = {}) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(scale); scene.add(group);
  const random = randomSource(Math.round((x + 10) * 813 + y * 711));
  function mesh(geometry, material) {
    const item = new THREE.Mesh(geometry, material); item.castShadow = item.receiveShadow = true; group.add(item); return item;
  }
  const ceramic = new THREE.MeshStandardMaterial({
    color: '#b9b29d', roughness: .72, normalMap: plasterNormalMap(), normalScale: new THREE.Vector2(.45, .45),
  });
  const profile = [[0,0],[.12,0],[.135,.015],[.165,.25],[.17,.275],[.157,.28],[.148,.25],[.12,.035]].map(p => new THREE.Vector2(...p));
  mesh(new THREE.LatheGeometry(profile, 48), ceramic);
  const saucerProfile = [[0,0],[.155,0],[.18,.009],[.18,.027],[.17,.031],[.158,.013],[0,.013]].map(p => new THREE.Vector2(...p));
  const saucer = mesh(new THREE.LatheGeometry(saucerProfile,48),ceramic); saucer.position.y=-.008;
  const soil = mesh(new THREE.CylinderGeometry(.148, .148, .012, 32), new THREE.MeshStandardMaterial({ color: '#30251a', roughness: 1 })); soil.position.y = .25;
  const gritMaterial = new THREE.MeshStandardMaterial({color:'#76654b',roughness:1});
  const gritGeometry = new THREE.IcosahedronGeometry(.007,0);
  for(let i=0;i<22;i++) {
    const angle=random()*Math.PI*2,radius=Math.sqrt(random())*.135;
    const grit=mesh(gritGeometry,gritMaterial);grit.position.set(Math.cos(angle)*radius,.259,Math.sin(angle)*radius);grit.scale.set(1+random(),.5,1);
  }
  function stem(points, radius = .003) {
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, radius, 5, false), stemMaterial);
  }
  function leaf(p, angle, tilt, size) {
    const item = mesh(blade, leaves[Math.floor(random() * leaves.length)]);
    item.position.copy(p); item.rotation.set(tilt, angle, (random() - .5) * 2.6); item.scale.setScalar(size);
  }
  for (let b = 0; b < 34; b++) {
    const angle = b * 2.399, radius = .12 + random() * .25;
    const end = new THREE.Vector3(Math.cos(angle) * radius, .29 + random() * .24, Math.sin(angle) * radius * .65 + .08);
    const mid = end.clone().multiplyScalar(.55); mid.y = .32;
    stem([new THREE.Vector3(0, .25, 0), mid, end]);
    leaf(end, angle, .8 + random() * 1.4, .17 + random() * .09);
    if (b % 3 === 0) leaf(mid, angle + 1.2, .8 + random(), .14 + random() * .07);
  }
  if (trailing) for (let v = 0; v < 5; v++) {
    const pts = [], length = .45 + random() * .75;
    // Reach over the ledge early in the curve, then let the vines fall.
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const extraReach = Math.sin(Math.min(t * 3, 1) * Math.PI / 2) * overhang;
      const reach = .12 + Math.sin(t * Math.PI / 2) * .23 + extraReach;
      pts.push(new THREE.Vector3((v - 1.5) * .11 + Math.sin(t * 5 + v) * .09, .30 - t * length, reach));
    }
    stem(pts);
    for (let k = 1; k < pts.length; k++) {
      const p = pts[k], side = k % 2 ? 1 : -1;
      const end = p.clone().add(new THREE.Vector3(side * .065, -.015, .02));
      stem([p, p.clone().lerp(end, .5), end], .002);
      leaf(end, side * .8 + random() * .5, 2.2 + random() * .6, (.16 + random() * .09) * (1 - k * .025));
    }
  }
  return group;
}

// Actual sculpted relief: overlapping ridges catch light instead of gold wires.
export function addRelief(scene, x, y, z, width, height) {
  const geometry = new THREE.PlaneGeometry(width, height, 256, 128);
  const positions = geometry.attributes.position;
  const colors = [];
  const charcoal = new THREE.Color('#494740'), ochre = new THREE.Color('#a38c62');
  for (let i = 0; i < positions.count; i++) {
    const u = positions.getX(i) / width, v = positions.getY(i) / height;
    let depth = .008, crest = 0;
    // Continuous ridges avoid the discontinuities and moire of the first relief.
    for (let ridge = 0; ridge < 5; ridge++) {
      const phase = ridge * 1.73;
      const horizon = -.46 + ridge * .19 + .10 * Math.sin(u * 8 + phase)
        + .035 * Math.sin(u * 23 + phase) + .012 * Math.sin(u * 61 + ridge);
      const distance = horizon - v;
      const ridgeShape = Math.exp(-Math.abs(distance) * (distance < 0 ? 100 : 15));
      const erosion = .7 + .3 * Math.sin(u * 105 + distance * 32 + Math.sin(u * 41));
      depth += .065 * ridgeShape * erosion;
      crest = Math.max(crest, ridgeShape * .5);
    }
    const grain = Math.sin(u * 210 + Math.sin(v * 80) * 3) * Math.sin(v * 180 + u * 85);
    positions.setZ(i, depth + grain * .0007);
    const color = charcoal.clone().lerp(ochre, crest);
    colors.push(color.r, color.g, color.b, 1);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.computeVertexNormals();
  const relief = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }));
  relief.position.set(x, y, z); relief.castShadow = relief.receiveShadow = true; scene.add(relief);
}
