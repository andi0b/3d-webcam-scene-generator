import * as THREE from 'three';

// Two color temperatures in sRGB, with separate output levels.
const ceilingModes = {
  off: { color: '#ffffff', intensity: 0, bounce: 0, glow: 0 },
  dimmed: { color: '#ffb367', intensity: 12, bounce: .18, glow: .8 },
  low: { color: '#ffb367', intensity: 19.2, bounce: .288, glow: 1.28 },
  high: { color: '#ffd3a6', intensity: 49.6, bounce: .64, glow: 3.84 },
};
const sunPresets = {
  day: { color: '#fff0d8', intensity: 4.65, height: 4.87, z: 3.6 },
  golden: { color: '#ffc385', intensity: 4.125, height: 2.42, z: 3.6 },
  night: { color: '#9eafd8', intensity: .108, height: 4.5, z: .4 },
};
const weatherModes = {
  sunny: { direct: 1, diffuse: 1 },
  cloudy: { direct: 0, diffuse: .8 },
  foggy: { direct: 0, diffuse: .4 },
};

export function createLighting(scene, { sideWindow, clerestory, ceiling, deskLamp, shelfLamp, shelfWash, backdrop }) {
  const sun = new THREE.DirectionalLight();
  sun.target.position.set(.5, 1.1, -2.8);
  sun.castShadow = true;
  sun.shadow.autoUpdate = false;
  Object.assign(sun.shadow.camera, { left: -4, right: 7.25, top: 4.5, bottom: -4.5, near: .5, far: 16 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.00015;
  sun.shadow.normalBias = .006;
  sun.shadow.radius = 1;

  const fill = new THREE.RectAreaLight('#f1ede4', .8, 3, 2);
  fill.position.set(0, 2.4, 1.5);
  fill.lookAt(0, 1.7, -3);
  scene.add(sun, sun.target, fill);
  const areaLights = [...sideWindow.lights, clerestory.light, deskLamp.light, shelfLamp.light, shelfWash, fill];

  return {
    areaLights,
    setShadowResolution(exporting) {
      sun.shadow.mapSize.setScalar(exporting ? 3072 : 768);
      ceiling.light.shadow.mapSize.setScalar(exporting ? 1024 : 256);
      sun.shadow.needsUpdate = ceiling.light.shadow.needsUpdate = true;
    },
    get shadowsNeedUpdate() {
      return (sun.visible && sun.shadow.needsUpdate) || (ceiling.light.visible && ceiling.light.shadow.needsUpdate);
    },
    update({ mood, weather, ceilingMode, outside, deskOn, shelfOn, fillOn }) {
      const isNight = mood === 'night';
      const ceilingSettings = ceilingModes[ceilingMode];
      ceiling.light.color.set(ceilingSettings.color);
      ceiling.light.intensity = ceilingSettings.intensity;
      ceiling.bounce.color.copy(ceiling.light.color);
      ceiling.bounce.intensity = ceilingSettings.bounce;
      ceiling.diffuser.emissive.copy(ceiling.light.color);
      ceiling.diffuser.emissiveIntensity = ceilingSettings.glow;

      const sunlight = sunPresets[mood];
      const conditions = weatherModes[weather];
      const outsideDiffuse = outside ? conditions.diffuse : 0;
      sun.intensity = outside ? sunlight.intensity * conditions.direct : 0;
      sun.color.set(sunlight.color);
      if (sun.position.y !== sunlight.height || sun.position.z !== sunlight.z) {
        sun.position.set(-6, sunlight.height, sunlight.z);
        sun.shadow.needsUpdate = true;
      }

      const windowColor = isNight ? '#a8bcf1' : mood === 'golden' ? '#ffe2bd' : '#eef4ff';
      const windowIntensity = isNight ? .288 : mood === 'golden' ? 12.6 : 15.45;
      for (const light of sideWindow.lights) {
        light.color.set(windowColor);
        light.intensity = windowIntensity * outsideDiffuse;
      }
      clerestory.light.color.set(windowColor);
      clerestory.light.intensity = windowIntensity * outsideDiffuse * .28;
      clerestory.glass.emissive.copy(clerestory.light.color);
      clerestory.glass.emissiveIntensity = clerestory.light.intensity * .18;
      backdrop.material.emissiveIntensity = outsideDiffuse;

      deskLamp.light.intensity = deskOn ? 75 : 0;
      shelfLamp.light.intensity = shelfOn ? 5 : 0;
      shelfWash.intensity = shelfOn ? 8 : 0;
      fill.intensity = fillOn ? (isNight ? .12 : .8) : 0;
      // The tracer picks from visible lights uniformly. Disabled lights would waste samples.
      for (const light of [ceiling.light, sun, ...areaLights]) {
        light.visible = light.intensity > 0;
      }
      deskLamp.bulb.color.set(deskOn ? '#ffe0ad' : '#77716b');
      deskLamp.bulb.emissiveIntensity = deskOn ? 1.5 : 0;
      shelfLamp.globe.color.set(shelfOn ? '#ffe1b0' : '#8b8174');
      shelfLamp.globe.emissiveIntensity = shelfOn ? 1.5 : 0;
    },
  };
}
