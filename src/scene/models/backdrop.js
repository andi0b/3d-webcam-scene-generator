import * as THREE from 'three';
import { box } from '../primitives.js';

export function createBackdrop(loadImage) {
  const group = new THREE.Group();
  group.name = 'window-backdrop';
  const material = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveIntensity: 1, roughness: 1 });
  const backdrop = box(group, [8.2, 4.7, .03], [0, 0, 0], material, false);
  backdrop.rotation.y = Math.PI / 2;
  // The photograph remains visible through the window and lets traced sunlight pass.
  material.castShadow = false;
  backdrop.visibleToShadowRays = false;
  const images = Object.fromEntries(['city', 'forest', 'mountains'].map(name => [name, loadImage(`${name}.png`)]));

  return {
    group,
    material,
    update(view, mood) {
      const image = images[view];
      if (material.emissiveMap !== image) {
        material.emissiveMap = image;
        material.needsUpdate = true;
      }
      material.emissive.set(mood === 'night' ? '#424c6a' : mood === 'golden' ? '#ffd5ad' : '#ffffff');
    },
  };
}
