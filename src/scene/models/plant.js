import * as THREE from 'three';
import { randomSource } from '../random-source.js';
import { plasterNormalMap } from '../surface-textures.js';
import { leafGeometry } from './leaf-geometry.js';

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

const leafMap = leafTexture();
const leaves = ['#c2d693', '#a8c47d', '#8fae60', '#d2da9d'].map(color => new THREE.MeshPhysicalMaterial({
  color, map: leafMap, roughness: .58, side: THREE.DoubleSide,
  clearcoat: .06, clearcoatRoughness: .65,
}));
const stemMaterial = new THREE.MeshStandardMaterial({ color: '#59703a', roughness: .8 });

export function createPlant({ seed, scale = 1, trailing = false, overhang = 0 }) {
  const group = new THREE.Group();
  group.name = 'potted-plant';
  group.scale.setScalar(scale);
  const random = randomSource(seed);
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
    const item = mesh(leafGeometry, leaves[Math.floor(random() * leaves.length)]);
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
