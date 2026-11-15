import * as THREE from 'three';
import { cylinder, material, roundedBox, sphere } from '../primitives.js';
import { randomSource } from '../random-source.js';

function roundedRectangle(width, height, radius) {
  const x = width / 2, y = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + radius, -y);
  shape.lineTo(x - radius, -y);
  shape.quadraticCurveTo(x, -y, x, -y + radius);
  shape.lineTo(x, y - radius);
  shape.quadraticCurveTo(x, y, x - radius, y);
  shape.lineTo(-x + radius, y);
  shape.quadraticCurveTo(-x, y, -x, y - radius);
  shape.lineTo(-x, -y + radius);
  shape.quadraticCurveTo(-x, -y, -x + radius, -y);
  return shape;
}

function createGrilleMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const image = context.createImageData(canvas.width, canvas.height);
  const random = randomSource(1357);
  const threadTones = [-21, 4, 11, 0];
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const warpOver = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
      const thread = (warpOver ? x : y) % 4;
      const shade = threadTones[thread] + (random() - .5) * 16;
      const index = (y * canvas.width + x) * 4;
      image.data[index] = 181 + shade;
      image.data[index + 1] = 164 + shade;
      image.data[index + 2] = 138 + shade;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, roughness: .91 });
}

export function createRadio(wood) {
  const group = new THREE.Group();
  group.name = 'shelf-radio';
  const width = .59, height = .27, depth = .20;
  const footHeight = .014;
  const centerY = footHeight + height / 2;
  const outline = roundedRectangle(width, height, .057);
  outline.holes.push(roundedRectangle(width - .032, height - .032, .042));
  const cabinetGeometry = new THREE.ExtrudeGeometry(outline, {
    depth, bevelSize: .004, bevelThickness: .004, bevelSegments: 2, curveSegments: 8,
  });
  const { groups, attributes: { uv } } = cabinetGeometry;
  for (const { start, count, materialIndex } of groups) {
    for (let i = start; i < start + count; i++) {
      const across = materialIndex === 0 ? uv.getY(i) : 1 - uv.getY(i) - depth / 2;
      uv.setXY(i, .5 + across / .70, .5 + uv.getX(i) / 2.7);
    }
  }
  const cabinet = new THREE.Mesh(cabinetGeometry, wood);
  cabinet.position.set(0, centerY, -depth / 2);
  cabinet.castShadow = cabinet.receiveShadow = true;
  group.add(cabinet);

  const grilleGeometry = new THREE.ShapeGeometry(roundedRectangle(width - .027, height - .027, .044), 8);
  const grilleUV = grilleGeometry.attributes.uv;
  for (let i = 0; i < grilleUV.count; i++) {
    grilleUV.setXY(i, .5 + grilleUV.getX(i) / width, .5 + grilleUV.getY(i) / height);
  }
  const grille = new THREE.Mesh(grilleGeometry, createGrilleMaterial());
  grille.position.set(0, centerY, depth / 2 - .004);
  grille.castShadow = grille.receiveShadow = true;
  group.add(grille);

  const rubber = material('#2d2925', .86);
  const back = new THREE.Mesh(grilleGeometry, rubber);
  back.position.set(0, centerY, -depth / 2);
  back.rotation.y = Math.PI;
  back.castShadow = true;
  group.add(back);
  for (const x of [-.206, .206]) {
    for (const z of [-.061, .061]) {
      roundedBox(group, [.055, footHeight, .041], [x, footHeight / 2, z], rubber, .004, 2);
    }
  }

  const brass = material('#c7a772', .32, .62);
  const dial = cylinder(group, [.022, .024, .018], [.196, .073, .105], brass);
  dial.rotation.x = Math.PI / 2;
  sphere(group, .0045, [-.224, .068, .098], material('#f5ddae', .48));
  return group;
}
