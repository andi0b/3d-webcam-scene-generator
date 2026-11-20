import * as THREE from 'three';
import { light6500K } from '../light-colors.js';
import { cylinder, material } from '../primitives.js';

export function createCeilingFixture() {
  const group = new THREE.Group();
  group.name = 'ceiling-fixture';
  cylinder(group, [.30, .30, .10], [0, 0, 0], material('#c8c5bb', .55, .25));
  const diffuser = material('#eeeae1', .75);
  cylinder(group, [.278, .263, .055], [0, -.0725, 0], diffuser);
  const beamAngle = 200;
  const light = new THREE.SpotLight(light6500K, 0, 0, THREE.MathUtils.degToRad(beamAngle / 2), .70, 2);
  light.position.y = -.12;
  light.target.position.y = -3.90;
  light.castShadow = true;
  // Keep the perspective shadow camera within its previous field of view.
  light.shadow.focus = 165.6 / beamAngle;
  light.shadow.camera.far = 10;
  light.shadow.bias = -.00015;
  light.shadow.normalBias = .006;
  light.shadow.radius = 3;
  light.shadow.autoUpdate = false;
  // A diffuse contribution approximates light bouncing into the corners.
  const bounce = new THREE.AmbientLight(light6500K, 0);
  group.add(light, light.target, bounce);
  return { group, light, bounce, diffuser };
}
