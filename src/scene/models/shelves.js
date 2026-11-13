import * as THREE from 'three';
import { box, material, oakBox } from '../primitives.js';
import { createBook } from './book.js';
import { createPlant } from './plant.js';

export function createShelves(wood) {
  const group = new THREE.Group();
  group.name = 'shelves';
  oakBox(group, [1.65, .065, .34], [0, 2.765, 0], wood, .014);
  oakBox(group, [.98, .065, .30], [.09, 1.865, -.02], wood, .014);
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
    book.position.set(-.08 + index * .145, 2.8, .04);
    group.add(book);
  }
  const pothos = createPlant({ seed: 8031, scale: .72, trailing: true });
  pothos.position.set(-.53, 2.8, .04);
  const lowerPlant = createPlant({ seed: 7920, scale: .58 });
  lowerPlant.position.set(.12, 1.9, .02);

  const wash = new THREE.RectAreaLight('#ffce92', 3.5, 1.4, .055);
  wash.position.set(0, 2.72, .13);
  wash.lookAt(0, 1.9, -.16);
  group.add(pothos, lowerPlant, wash);
  return { group, wash };
}
