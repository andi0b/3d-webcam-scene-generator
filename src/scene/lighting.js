import * as THREE from 'three';

// A 2700 K blackbody approximated in sRGB.
const warm2700K = '#ffad59';
const ceilingModes = {
  off: { color: '#ffffff', intensity: 0, bounce: 0, glow: 0 },
  dimmed: { color: warm2700K, intensity: 12, bounce: .18, glow: .8 },
  low: { color: '#ffb367', intensity: 19.2, bounce: .288, glow: 1.28 },
  high: { color: '#ffd3a6', intensity: 38.4, bounce: .576, glow: 2.56 },
};
const sunPresets = {
  day: { color: '#fff0d8', intensity: 4.1, direction: [-1, .49, .51], radius: .60 },
  golden: { color: '#ffc385', intensity: 4.125, direction: [-1, .27, .46], radius: .65 },
  night: { color: '#9eafd8', intensity: .108, direction: [-6.5, 3.4, 3.2], radius: .30 },
};
const sunDistance = 36;
const daylightWeather = {
  sunny: { direct: 10, diffuse: 4 },
  cloudy: { direct: 0, diffuse: 1 },
  foggy: { direct: 0, diffuse: .2 },
};
const nightWeather = {
  sunny: { direct: 1, diffuse: .18, backdrop: .20, windowColor: '#a8bcf1' },
  cloudy: { direct: 0, diffuse: .72, backdrop: .65, windowColor: '#b8c1dc' },
  foggy: { direct: 0, diffuse: 1.1, backdrop: 3, windowColor: '#ced0db' },
};

export function createLighting(scene, { sideWindow, clerestory, ceiling, deskLamp, shelfLamp, shelfWash, backdrop }) {
  // Both path tracers sample the spotlight's disc. A distant disc with no
  // falloff gives nearly parallel rays and softens edges away from the caster.
  const sun = new THREE.SpotLight('#ffffff', 0, 0, Math.PI / 4, .15, 0);
  sun.target.position.set(.5, 1.1, -2.8);
  sun.castShadow = true;
  sun.shadow.autoUpdate = false;
  sun.shadow.mapSize.setScalar(768);
  ceiling.light.shadow.mapSize.setScalar(256);
  sun.shadow.needsUpdate = ceiling.light.shadow.needsUpdate = true;
  sun.shadow.focus = .22;
  Object.assign(sun.shadow.camera, { near: sunDistance - 8, far: sunDistance + 8 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.00015;
  sun.shadow.normalBias = .006;
  sun.shadow.radius = 2;
  let sunMood;

  const fill = new THREE.RectAreaLight('#f1ede4', .8, 3, 2);
  fill.position.set(0, 2.4, 1.5);
  fill.lookAt(0, 1.7, -3);
  // Broad sources approximate diffuse light scattered by the room surfaces.
  const wallBounceLight = new THREE.RectAreaLight('#f5eee4', 0, 5.8, 3.1);
  wallBounceLight.position.set(.2, 2, 2.85);
  const floorBounceLight = new THREE.RectAreaLight('#f0e3cf', 0, 5.8, 4.4);
  wallBounceLight.userData.previewOnly = floorBounceLight.userData.previewOnly = true;
  floorBounceLight.position.set(.2, .035, -.2);
  floorBounceLight.rotation.x = Math.PI / 2;
  scene.add(sun, sun.target, fill, wallBounceLight, floorBounceLight);
  shelfLamp.light.color.set(warm2700K);
  shelfWash.color.set(warm2700K);
  shelfLamp.globe.emissive.set(warm2700K);
  const exteriorLight = sideWindow.exteriorLight;
  const shadowLights = [ceiling.light, sun, exteriorLight];
  const rasterLights = [
    ...shadowLights, clerestory.light, deskLamp.light, shelfLamp.light, shelfWash, fill, wallBounceLight, floorBounceLight,
  ];

  return {
    rasterLights,
    invalidateShadows() {
      for (const light of shadowLights) light.shadow.needsUpdate = true;
    },
    get shadowsNeedUpdate() {
      return shadowLights.some(light => light.shadow.needsUpdate);
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
      const conditions = (isNight ? nightWeather : daylightWeather)[weather];
      const outsideDiffuse = outside ? conditions.diffuse : 0;
      sun.intensity = outside ? sunlight.intensity * conditions.direct : 0;
      sun.color.set(sunlight.color);
      if (mood !== sunMood) {
        sun.position.fromArray(sunlight.direction).setLength(sunDistance).add(sun.target.position);
        sun.radius = sunlight.radius;
        sun.shadow.needsUpdate = true;
        sunMood = mood;
      }

      const windowColor = conditions.windowColor ?? (mood === 'golden' ? '#ffe2bd' : '#eef4ff');
      const windowIntensity = isNight ? .288 : mood === 'golden' ? 12.6 : 15.45;
      const windowFill = !isNight && conditions.direct ? .75 : 1;
      exteriorLight.color.set(windowColor);
      exteriorLight.intensity = 3.7 * windowIntensity * outsideDiffuse * windowFill;
      clerestory.light.color.set(windowColor);
      clerestory.light.intensity = windowIntensity * outsideDiffuse * .28;
      clerestory.glass.emissive.copy(clerestory.light.color);
      clerestory.glass.emissiveIntensity = clerestory.light.intensity * .18;
      backdrop.material.emissiveIntensity = outside ? (conditions.backdrop ?? conditions.diffuse) : 0;

      deskLamp.light.intensity = deskOn ? 75 : 0;
      shelfLamp.light.intensity = shelfOn ? 5 : 0;
      shelfWash.intensity = shelfOn ? 8 : 0;
      fill.intensity = fillOn ? (isNight ? .12 : .8) : 0;
      // Weight the scene's light sources by their contribution to broad room illumination.
      const bounceIntensity = .16 * sun.intensity + .023 * exteriorLight.intensity
        + .018 * ceiling.light.intensity + .002 * deskLamp.light.intensity
        + .012 * shelfWash.intensity + .075 * fill.intensity;
      wallBounceLight.intensity = .60 * bounceIntensity;
      floorBounceLight.intensity = .30 * bounceIntensity;
      // The tracer picks from visible lights uniformly. Disabled lights would waste samples.
      for (const light of rasterLights) {
        light.visible = light.intensity > 0;
      }
      deskLamp.bulb.color.set(deskOn ? '#ffe0ad' : '#77716b');
      deskLamp.bulb.emissiveIntensity = deskOn ? 1.5 : 0;
      shelfLamp.globe.color.set(shelfOn ? warm2700K : '#8b8174');
      shelfLamp.globe.emissiveIntensity = shelfOn ? 1.5 : 0;
    },
  };
}
