import * as THREE from 'three';
import { box } from '../primitives.js';

export function createBackdrop(loadTexture, onTextureChanged) {
  const group = new THREE.Group();
  group.name = 'window-backdrop';
  const material = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveIntensity: 1, roughness: 1 });
  const backdrop = box(group, [8.2, 4.7, .03], [0, 0, 0], material, false);
  backdrop.rotation.y = Math.PI / 2;
  // The photograph remains visible through the window and lets traced sunlight pass.
  material.castShadow = false;
  backdrop.visibleToShadowRays = false;
  const images = new Map();
  let active;

  return {
    group,
    material,
    get ready() { return active?.ready; },
    update(view, mood) {
      if (!images.has(view)) {
        const image = loadTexture(`${view}.webp`, {
          fallback: [153, 167, 174],
          onChange: error => {
            if (image === active) onTextureChanged(error);
          },
        });
        images.set(view, image);
      }
      active = images.get(view);
      material.emissiveMap = active.texture;
      material.emissive.set(mood === 'night' ? '#424c6a' : mood === 'golden' ? '#ffd5ad' : '#ffffff');
    },
  };
}
