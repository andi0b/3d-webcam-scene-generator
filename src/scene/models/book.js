import * as THREE from 'three';
import { roundedBox } from '../primitives.js';

const paperCanvas = document.createElement('canvas');
paperCanvas.width = 64; paperCanvas.height = 512;
const paperContext = paperCanvas.getContext('2d');
paperContext.fillStyle = '#d9d1bd'; paperContext.fillRect(0, 0, 64, 512);
for (let y = 0; y < 512; y += 3) {
  paperContext.fillStyle = y % 9 === 0 ? '#b9b19e' : '#ccc4b1';
  paperContext.fillRect(0, y, 64, 1);
}
const paperMap = new THREE.CanvasTexture(paperCanvas); paperMap.colorSpace = THREE.SRGBColorSpace;
const pages = new THREE.MeshStandardMaterial({ map: paperMap, roughness: .92 });

export function createBook({ width = .12, height = .4, depth = .23, color, title, lean = 0, flat = false }) {
  const group = new THREE.Group();
  group.name = title;
  const cover = new THREE.MeshStandardMaterial({ color, roughness: .72 });
  roundedBox(group, [width - .014, height - .018, depth - .016], [0, height / 2, -.004], pages);
  for (const side of [-1, 1]) roundedBox(group, [.006, height, depth], [side * (width / 2 - .003), height / 2, 0], cover);
  roundedBox(group, [width, height, .016], [0, height / 2, depth / 2 - .008], cover, .005);
  // Subtle typography and publisher marks follow the actual spine.
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 512;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 512);
  ctx.fillStyle = '#cbbf9c'; ctx.font = '22px Georgia'; ctx.textAlign = 'center';
  ctx.save(); ctx.translate(64, 240); ctx.rotate(-Math.PI / 2); ctx.fillText(title, 0, 0); ctx.restore();
  ctx.fillRect(32, 440, 64, 2); ctx.font = '13px serif'; ctx.fillText('R / L', 64, 475);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(width * .90, height * .96), new THREE.MeshStandardMaterial({ map, roughness: .8 }));
  label.position.set(0, height / 2, depth / 2 + .0005); group.add(label);
  group.rotation.z = lean;
  if (flat) { group.rotation.z = -Math.PI / 2; group.position.y += width / 2; }
  return group;
}

