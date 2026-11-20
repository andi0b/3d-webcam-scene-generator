import * as THREE from 'three';
import { light2700K } from '../light-colors.js';
import { box, material, oakBox } from '../primitives.js';
import { createBook } from './book.js';
import { createPlant } from './plant.js';
import { createRadio } from './radio.js';

export function createShelves(wood, radioWood) {
  const group = new THREE.Group();
  group.name = 'shelves';
  const lowerShelfY = 1.865;
  const upperShelfY = 2.765;
  const shelfThickness = .065;
  const upperSurfaceY = upperShelfY + shelfThickness / 2;
  oakBox(group, [1.65, shelfThickness, .34], [0, upperShelfY, 0], wood, .014);
  oakBox(group, [.98, shelfThickness, .30], [.09, lowerShelfY, -.02], wood, .014);
  // Shallow shadow gaps suggest floating mounts.
  const mount = material('#57483c', .85);
  box(group, [1.52, .018, .025], [0, 2.72, -.15], mount);
  box(group, [.86, .018, .025], [.09, 1.82, -.15], mount);

  const titles = ['Botanical Living', 'Architecture', 'Quiet Spaces', 'The Modern Home', 'Collected Works'];
  const colors = ['#514943', '#d1c4af', '#71675a', '#a69986', '#3f423c'];
  for (const [index, title] of titles.entries()) {
    const book = createBook({
      title, color: colors[index], height: .36 + (index % 3) * .037, lean: index === 4 ? -.08 : 0,
    });
    book.position.set(-.105 + index * .145, upperSurfaceY + .06 * Math.abs(Math.sin(book.rotation.z)), .04);
    group.add(book);
  }
  const pothos = createPlant({ seed: 8031, scale: .72, trailing: true });
  pothos.position.set(-.53, 2.8, .04);
  const radio = createRadio(radioWood);
  radio.position.set(.09, lowerShelfY + shelfThickness / 2, -.015);

  const wash = new THREE.RectAreaLight(light2700K, 3.5, 1.4, .055);
  wash.position.set(0, 2.72, .13);
  wash.lookAt(0, 1.9, -.16);
  group.add(pothos, radio, wash);
  return { group, wash, upperSurfaceY };
}
