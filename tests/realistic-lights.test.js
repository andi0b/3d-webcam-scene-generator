import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getLights } from 'three-gpu-pathtracer/src/core/utils/sceneUpdateUtils.js';
import { withoutPreviewOnlyLights } from '../src/realistic-lights.js';

describe('realistic light collection', () => {
  it('excludes preview bounce lights and restores their visibility', () => {
    const scene = new THREE.Scene();
    const bounce = new THREE.RectAreaLight();
    bounce.userData.previewOnly = true;
    const sun = new THREE.SpotLight();
    const disabled = new THREE.RectAreaLight();
    disabled.userData.previewOnly = true;
    disabled.visible = false;
    scene.add(bounce, sun, disabled);

    expect(withoutPreviewOnlyLights(scene, () => getLights(scene))).toEqual([sun]);
    expect(bounce.visible).toBe(true);
    expect(disabled.visible).toBe(false);
    expect(() => withoutPreviewOnlyLights(scene, () => { throw new Error('failed'); })).toThrow('failed');
    expect(bounce.visible).toBe(true);
  });
});
