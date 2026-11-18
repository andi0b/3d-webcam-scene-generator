import * as THREE from 'three';
import { randomSource } from '../random-source.js';
import { plasterNormalMap } from '../surface-textures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createLeafGeometry } from './leaf-geometry.js';

const leafGeometry = createLeafGeometry(12,6,true);

function leafTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 128, 0);
  gradient.addColorStop(0, '#617b35'); gradient.addColorStop(.48, '#9aaa60'); gradient.addColorStop(.52, '#819844'); gradient.addColorStop(1, '#496a2e');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const random = randomSource(713);
  for (let i=0;i<480;i++) {
    const x = random()*128, y = random()*128;
    ctx.fillStyle = random() < .5 ? 'rgba(187,188,95,.095)' : 'rgba(38,79,35,.08)';
    ctx.beginPath();
    ctx.ellipse(x,y,1+random()*3,2+random()*5,(x-64)/100,0,2*Math.PI);
    ctx.fill();
  }
  for (const side of [-1,1]) {
    for (let y=24;y<140;y+=15+random()*6) {
      const tipY = y-18-random()*9;
      ctx.strokeStyle = 'rgba(194,204,137,.48)'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(64,y);
      ctx.quadraticCurveTo(64+side*32,y-4,64+side*61,tipY); ctx.stroke();
      ctx.lineWidth = .42;
      ctx.beginPath(); ctx.moveTo(64+side*24,y-6);
      ctx.quadraticCurveTo(64+side*38,y-15,64+side*51,tipY-5); ctx.stroke();
    }
  }
  ctx.strokeStyle='#b9be82'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(64,128); ctx.lineTo(64,0); ctx.stroke(); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

const leafMap = leafTexture();
const leaves = ['#c2d693', '#a8c47d', '#8fae60', '#d2da9d'].map(color => new THREE.MeshPhysicalMaterial({
  color, map: leafMap, roughness: .58, side: THREE.DoubleSide,
  clearcoat: .06, clearcoatRoughness: .65,
}));
const stemMaterial = new THREE.MeshStandardMaterial({ color: '#59703a', roughness: .8 });

function stonewareTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(512,128);
  const random = randomSource(930);
  for (let y=0;y<128;y++) for (let x=0;x<512;x++) {
    const ring = Math.sin(y*.86+.38*Math.sin(2*Math.PI*x/512));
    const value = 236 + 3*ring + 7*(random()-.5) - (random()<.022 ? 28+random()*32 : 0);
    const i=(y*512+x)*4;
    pixels.data[i]=value; pixels.data[i+1]=value-2; pixels.data[i+2]=value-5; pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  return map;
}
const clayMap = stonewareTexture();

export function createPlant({ seed, scale = 1, trailing = false, overhang = 0, potColor = '#c5b99e' }) {
  const group = new THREE.Group();
  group.name = 'potted-plant';
  group.scale.setScalar(scale);
  const random = randomSource(seed);
  function mesh(geometry, material) {
    const item = new THREE.Mesh(geometry, material); item.castShadow = item.receiveShadow = true; group.add(item); return item;
  }
  const ceramic = new THREE.MeshStandardMaterial({
    color: potColor, map: clayMap, roughness: .52, normalMap: plasterNormalMap(), normalScale: new THREE.Vector2(.45, .45),
  });
  const profile = [[0,0],[.112,0],[.118,.006],[.119,.014],[.133,.020],[.163,.24],[.169,.262],[.169,.273],[.165,.279],[.157,.279],[.152,.274],[.148,.25],[.12,.035]].map(p => new THREE.Vector2(...p));
  function vessel(points,height) {
    const geometry = new THREE.LatheGeometry(points,48);
    const {position,uv} = geometry.attributes;
    for (let i=0;i<uv.count;i++) uv.setY(i,position.getY(i)/height);
    return mesh(geometry,ceramic);
  }
  vessel(profile,.279);
  const saucerProfile = [[0,0],[.155,0],[.18,.009],[.18,.027],[.17,.031],[.158,.013],[0,.013]].map(p => new THREE.Vector2(...p));
  const saucer = vessel(saucerProfile,.031); saucer.position.y=-.008;
  const soil = mesh(new THREE.CylinderGeometry(.148, .148, .012, 32), new THREE.MeshStandardMaterial({ color: '#30251a', roughness: 1 })); soil.position.y = .25;
  const gritMaterial = new THREE.MeshStandardMaterial({color:'#76654b',roughness:1});
  const gritGeometry = new THREE.IcosahedronGeometry(.007,0);
  for(let i=0;i<22;i++) {
    const angle=random()*Math.PI*2,radius=Math.sqrt(random())*.135;
    const grit=mesh(gritGeometry,gritMaterial);grit.position.set(Math.cos(angle)*radius,.259,Math.sin(angle)*radius);grit.scale.set(1+random(),.5,1);
  }
  function stem(points, radius = .003, segments = 7) {
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 5, false), stemMaterial);
  }
  function leaf(p, angle, tilt, size) {
    const item = mesh(leafGeometry, leaves[Math.floor(random() * leaves.length)]);
    item.position.copy(p); item.rotation.set(tilt, angle, (random() - .5) * 2.6); item.scale.set(size*(.89+.16*Math.cos(angle*3)), size, size);
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
      const spill = THREE.MathUtils.smoothstep(t,0,.25);
      const spread = (v-2)*.083 + Math.sin(t*5+v)*.065;
      pts.push(new THREE.Vector3(spread*(.25+.75*spill),
        .262+.091*Math.sin(Math.PI*Math.min(t/.30,1)) - Math.max(0,t-.18)*length,
        THREE.MathUtils.lerp(.074,reach,spill)));
    }
    stem(pts,.003,20);
    for (let k = 1; k < pts.length; k++) {
      const p = pts[k], side = k % 2 ? 1 : -1;
      const end = p.clone().add(new THREE.Vector3(side * .065, -.015, .02));
      stem([p, p.clone().lerp(end, .5), end], .002, 1);
      leaf(end, side * .8 + random() * .5, 2.2 + random() * .6, (.16 + random() * .09) * (1 - k * .025));
    }
  }
  // Batch static parts by finish. Ordinary meshes also survive path-tracer merging.
  const batches = new Map();
  for (const part of group.children) {
    part.updateMatrix();
    const shared = part.geometry === leafGeometry || part.geometry === gritGeometry;
    const geometry = shared ? part.geometry.clone() : part.geometry;
    geometry.applyMatrix4(part.matrix);
    if (!batches.has(part.material)) batches.set(part.material, []);
    batches.get(part.material).push(geometry);
  }
  group.clear();
  for (const [finish, geometries] of batches) mesh(mergeGeometries(geometries),finish);
  return group;
}
