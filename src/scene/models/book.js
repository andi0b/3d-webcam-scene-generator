import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { randomSource } from '../random-source.js';

// A strip across the thickness of the page block. The same strip wraps onto
// the head, fore-edge and tail, so the sheets line up at all four corners.
const canvas = document.createElement('canvas');
canvas.width = 512; canvas.height = 64;
const paper = canvas.getContext('2d'), random = randomSource(432);
paper.fillStyle = '#e4dccb';
paper.fillRect(0, 0, 512, 64);
for (let x = 0; x < 512; x += 2 + Math.floor(random() * 4)) {
  paper.fillStyle = `rgba(115,99,79,${.12 + random() * .30})`;
  paper.fillRect(x, 0, 1, 64);
}
for (let x=8;x<512;x+=17+Math.floor(random()*13)) {
  paper.fillStyle = 'rgba(130,111,86,.23)';
  paper.fillRect(x,0,2,64);
}
const paperMap = new THREE.CanvasTexture(canvas);
paperMap.colorSpace = THREE.SRGBColorSpace;
paperMap.wrapS = paperMap.wrapT = THREE.RepeatWrapping;
paperMap.anisotropy = 4;
const pages = new THREE.MeshStandardMaterial({ map: paperMap, roughness: .96 });

function bindingTexture(color, title) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.scale(.5,.5);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1024, 512);
  // Small variations in the bookcloth dye catch the light behind the stamping.
  const grain = randomSource(title.length*137);
  for (let i=0;i<12000;i++) {
    ctx.fillStyle = i%2 ? 'rgba(255,244,222,.07)' : 'rgba(37,31,25,.09)';
    ctx.fillRect(grain()*1024,grain()*512,1+grain()*4,1);
  }
  const ink = new THREE.Color(color).getHSL({}).l > .35 ? '#423c33' : '#dfd1af';
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(512, 240); ctx.rotate(-Math.PI / 2);
  ctx.font = '24px Georgia'; ctx.fillText(title, 0, 7, 345);
  ctx.restore();
  ctx.fillRect(489, 437, 46, 2);
  ctx.font = '13px Georgia'; ctx.fillText('R / L', 512, 467);
  // Restrained foil stamping on the front board is visible on the stacked books.
  ctx.font = '29px Georgia'; ctx.fillText(title, 792, 176, 350);
  ctx.fillRect(763, 192, 58, 2);
  ctx.font = '14px Georgia'; ctx.fillText('R / L', 792, 446);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createBook({ width = .12, height = .4, depth = .23, color, title, lean = 0, flat = false }) {
  const group = new THREE.Group();
  group.name = title;
  const board = Math.min(.003, width * .065), blockWidth = width - 2 * board;
  const pageBlock = new RoundedBoxGeometry(blockWidth, height - .007, depth - .014, 1, .0014);
  const position = pageBlock.attributes.position;
  for (let i=0; i<position.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    // A bound fore-edge draws inward slightly at the middle of the stack.
    const hollow = Math.max(0, 1 - (2*x/blockWidth)**2);
    if (z < 0) position.setZ(i, z + .0025*hollow);
    pageBlock.attributes.uv.setXY(i, x/.060 + .5, (position.getY(i) + z)/.18);
  }
  pageBlock.translate(0,height/2,0);
  pageBlock.computeVertexNormals();
  const covers = [];
  for (const side of [-1,1]) {
    const cover = new RoundedBoxGeometry(board,height,depth,1,board*.35);
    const p = cover.attributes.position;
    for (let i=0; i<p.count; i++) {
      const z = p.getZ(i), v = p.getY(i)/height + .5;
      const distance = depth/2-z;
      const hinge = Math.exp(-((distance-.009)**2)/.000012);
      p.setX(i,p.getX(i) - side*.001*hinge);
      // The left board faces up when a book lies flat.
      cover.attributes.uv.setXY(i, side < 0 ? .99-.42*distance/depth : .01+.42*distance/depth,v);
    }
    cover.translate(side*(width-board)/2,height/2,0);
    covers.push(cover);
  }
  // The title follows the curved spine. Its ends curl into the cover boards.
  const spine = new THREE.CylinderGeometry(1,1,1,24,1,false).toNonIndexed();
  const p = spine.attributes.position, uv = spine.attributes.uv;
  for (let i=0;i<p.count;i++) uv.setXY(i,.5+.053*p.getX(i),p.getY(i)+.5);
  spine.scale(width/2,height,.006);
  spine.translate(0,height/2,depth/2-.001);
  covers.push(spine);
  const binding = new THREE.MeshStandardMaterial({map:bindingTexture(color,title), roughness:.81});
  for (const [geometry, material] of [[pageBlock,pages],[mergeGeometries(covers),binding]]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.rotation.z = flat ? -Math.PI / 2 : lean;
  if (flat) group.position.y = width / 2;
  return group;
}
