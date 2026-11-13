import * as THREE from 'three';
import { cylinder, sphere } from '../primitives.js';

export function createShelfLamp(dark) {
  const group = new THREE.Group();
  group.name = 'shelf-lamp';
  cylinder(group, [.10, .11, .09], [0, 0, 0], dark);
  const globe = new THREE.MeshStandardMaterial({
    color: '#fff0d8', emissive: '#ffdc9b', emissiveIntensity: 1.5, roughness: .35,
  });
  globe.castShadow = false;
  sphere(group, .13, [0, .12, 0], globe).castShadow = false;
  const light = new THREE.RectAreaLight('#ffd39a', 5, .32, .32);
  light.position.set(0, .14, .21);
  light.lookAt(0, -.02, -.36);
  group.add(light);
  return { group, light, globe };
}
