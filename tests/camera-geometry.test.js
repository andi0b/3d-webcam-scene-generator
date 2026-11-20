import { describe, expect, test } from 'vitest';
import { PerspectiveCamera, MathUtils } from 'three';
import { CAMERA_BASE_HEIGHT, FLOOR_TOP, cameraHeightCm, horizontalFov } from '../src/camera-geometry.js';

describe('camera measurements', () => {
  test('height is measured from the modeled floor at each slider endpoint', () => {
    for (const offset of [-.63, 0, .63]) {
      expect(cameraHeightCm(offset)).toBeCloseTo((CAMERA_BASE_HEIGHT + offset - FLOOR_TOP) * 100, 8);
    }
    expect(cameraHeightCm(.63)).toBeCloseTo(229.75, 8);
  });

  test('horizontal angle agrees with Three.js projection at the framing endpoints', () => {
    for (const fov of [22, 48, 58]) {
      const camera = new PerspectiveCamera(fov, 16 / 9, .1, 30);
      const projected = MathUtils.radToDeg(2 * Math.atan(1 / camera.projectionMatrix.elements[0]));
      expect(horizontalFov(fov)).toBeCloseTo(projected, 8);
    }
  });
});
