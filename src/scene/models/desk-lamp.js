import * as THREE from 'three';
import { cylinder, material, roundedBox, sphere } from '../primitives.js';

function addArm(group, from, to, finish) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const geometry = new THREE.CylinderGeometry(.018, .018, direction.length(), 12);
  const mesh = new THREE.Mesh(geometry, finish);
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  group.add(mesh);
}

export function createDeskLamp(dark) {
  const group = new THREE.Group();
  group.name = 'desk-lamp';
  const metal = material('#4b4b46', .32, .72);
  cylinder(group, [.20, .22, .045], [0, .04, 0], dark);
  const joints = [[0, .08, 0], [-.24, .51, 0], [.01, .84, 0]];
  const [base, elbow, head] = joints.map(point => new THREE.Vector3(...point));
  addArm(group, base, elbow, dark);
  addArm(group, elbow, head, dark);
  for (const [x, y, z] of joints) {
    sphere(group, .045, [x, y, z], dark);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(.023, .023, .012, 24), metal);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(x, y, .053);
    group.add(screw);
    roundedBox(group, [.023, .003, .002], [x, y, .061], dark, .001);
  }
  const cablePoints = [[0, .05, -.05], [.21, .01, -.20], [.39, -.06, -.28], [.43, -.60, -.30], [.39, -.885, -.32]];
  const wire = new THREE.CatmullRomCurve3(cablePoints.map(point => new THREE.Vector3(...point)));
  const cable = new THREE.Mesh(new THREE.TubeGeometry(wire, 48, .007, 8, false), dark);
  cable.castShadow = true;
  group.add(cable);

  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(.09, .20, .28, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: '#252522', roughness: .35, metalness: .65, side: THREE.DoubleSide }),
  );
  shade.position.set(.07, .78, 0);
  shade.rotation.z = -.45;
  shade.castShadow = true;
  group.add(shade);
  const bulb = new THREE.MeshStandardMaterial({ color: '#fff0d8', emissive: '#ffe0a4', emissiveIntensity: 1.5 });
  sphere(shade, .07, [0, -.065, 0], bulb).castShadow = false;
  const light = new THREE.RectAreaLight('#ffcf95', 0, .26, .26);
  light.position.set(.14, .57, 0);
  light.lookAt(-.22, -.05, .05);
  group.add(light);
  return { group, light, bulb };
}
