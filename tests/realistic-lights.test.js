import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getLights } from 'three-gpu-pathtracer/src/core/utils/sceneUpdateUtils.js';
import { withoutPreviewOnlyLights } from '../src/realistic-lights.js';
import { createLighting } from '../src/scene/lighting.js';

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

it('uses increasing diffuse light for night weather and preserves the daylight progression', () => {
  const scene = new THREE.Scene();
  const windowLight = new THREE.SpotLight();
  const clerestory = { light: new THREE.RectAreaLight(), glass: new THREE.MeshStandardMaterial() };
  const backdrop = { material: new THREE.MeshStandardMaterial() };
  const lighting = createLighting(scene, {
    sideWindow: { exteriorLight: windowLight },
    clerestory,
    backdrop,
    ceiling: { light: new THREE.SpotLight(), bounce: new THREE.RectAreaLight(), diffuser: new THREE.MeshStandardMaterial() },
    deskLamp: { light: new THREE.PointLight(), bulb: new THREE.MeshStandardMaterial() },
    shelfLamp: { light: new THREE.PointLight(), globe: new THREE.MeshStandardMaterial() },
    shelfWash: new THREE.RectAreaLight(),
  });
  const sun = scene.children.find(object => object.isSpotLight);
  function sample(mood, weather, outside = true) {
    lighting.update({ mood, weather, ceilingMode: 'off', outside, deskOn: false, shelfOn: false, fillOn: false });
    return {
      direct: sun.intensity,
      indirect: windowLight.intensity + clerestory.light.intensity,
      backdrop: backdrop.material.emissiveIntensity,
    };
  }

  const weather = ['sunny', 'cloudy', 'foggy'];
  const [clear, cloudy, foggy] = weather.map(condition => sample('night', condition));
  expect(clear.direct).toBeCloseTo(.108);
  expect(cloudy.direct).toBe(0);
  expect(foggy.direct).toBe(0);
  for (const measure of ['indirect', 'backdrop']) {
    expect(clear[measure]).toBeLessThan(cloudy[measure]);
    expect(cloudy[measure]).toBeLessThan(foggy[measure]);
  }
  expect(foggy.indirect).toBeGreaterThan(5 * clear.indirect);
  for (const mood of ['day', 'golden']) {
    expect(weather.map(condition => sample(mood, condition).backdrop)).toEqual([4, 1, .2]);
    expect(sample(mood, 'sunny').direct).toBeGreaterThan(40);
  }
  expect(sample('night', 'foggy', false)).toEqual({ direct: 0, indirect: 0, backdrop: 0 });
});
