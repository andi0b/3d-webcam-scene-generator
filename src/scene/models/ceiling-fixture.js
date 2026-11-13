import * as THREE from 'three';
import { cylinder, material } from '../primitives.js';

export function createCeilingFixture() {
  const group = new THREE.Group();
  group.name = 'ceiling-fixture';
  cylinder(group, [.30, .30, .10], [0, 0, 0], material('#c8c5bb', .55, .25));
  const diffuser = material('#eeeae1', .75);
  cylinder(group, [.278, .263, .055], [0, -.0725, 0], diffuser);
  const light = new THREE.SpotLight('#ffffff', 0, 0, Math.PI * .46, .70, 2);
  light.position.y = -.12;
  light.target.position.y = -3.90;
  light.castShadow = true;
  light.shadow.camera.far = 10;
  light.shadow.bias = -.00015;
  light.shadow.normalBias = .006;
  light.shadow.radius = 3;
  light.shadow.autoUpdate = false;
  // A diffuse contribution approximates light bouncing into the corners.
  const bounce = new THREE.AmbientLight('#ffffff', 0);
  group.add(light, light.target, bounce);
  return { group, light, bounce, diffuser };
}
