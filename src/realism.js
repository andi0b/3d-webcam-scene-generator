import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Stable variation: changing a light or exporting never regenerates the plants.
function randomSource(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

export function surfaceNoise() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(256, 256), random = randomSource(123);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = 110 + random() * 36;
    pixels.data.set([value, value, value, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 8);
  return texture;
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

export function createPipeline(renderer, scene, camera) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .06).texture;
  scene.environmentIntensity = .16;
  room.dispose(); pmrem.dispose();
  // The default canvas antialias flag does not antialias offscreen composer targets.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Math.min(4, renderer.capabilities.maxSamples) });
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
    resize(w, h, ratio) { composer.setPixelRatio(ratio); composer.setSize(w, h); },
    render() {
      // SSAO caches projection uniforms; keep them current for the FOV slider.
      ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
      composer.render();
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

export function addPlant(scene, x, y, z, scale = 1, trailing = false) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(scale); scene.add(group);
  const random = randomSource(Math.round((x + 10) * 813 + y * 711));
  function mesh(geometry, material) {
    const item = new THREE.Mesh(geometry, material); item.castShadow = item.receiveShadow = true; group.add(item); return item;
  }
  const ceramic = new THREE.MeshStandardMaterial({ color: '#b9b29d', roughness: .72, bumpMap: surfaceNoise(), bumpScale: .001 });
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
    // Vines drape forward over the rim and shelf, away from the wall.
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push(new THREE.Vector3((v - 1.5) * .11 + Math.sin(t * 5 + v) * .09, .30 - t * length, .12 + Math.sin(t * Math.PI / 2) * .23));
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
