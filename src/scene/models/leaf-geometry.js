import * as THREE from 'three';

// A gridded, cupped heart-shaped blade, with a folded midrib and drooping tip.
function createLeafGeometry() {
  const positions = [], uvs = [], indices = [], rows = 16, cols = 8;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const width = .48 * Math.pow(Math.sin(Math.PI * t), .65) * (1.15 - .65 * t);
    for (let i = 0; i <= cols; i++) {
      const u = i / cols * 2 - 1;
      positions.push(u * width, t, .13 * Math.sin(t * Math.PI) * (1 - Math.abs(u)) - .17 * t * t + .035 * u * u);
      uvs.push(i / cols, t);
      if (j < rows && i < cols) {
        const a = j * (cols + 1) + i;
        indices.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

export const leafGeometry = createLeafGeometry();
