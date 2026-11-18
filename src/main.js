import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createPhotoreal } from './photoreal.js';
import { createPipeline } from './render-pipeline.js';
import { createRoom } from './scene/room.js';

export async function startStudio({ viewport, settings: initialSettings, onStatus, onReady, onRealisticReady, onExport }) {
  let settings = { ...initialSettings };
  RectAreaLightUniformsLib.init();
  const renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(.6);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  viewport.appendChild(renderer.domElement);

  let dirty = true, cameraDirty = true, lightingDirty = true;
  let firstFrame = true, qualityStage = 0, qualityAt = Infinity, reflectionVersion = -1;
  let previousLighting, materialsDirty = false;
  let textureError;

  const { scene, lighting, backdrop, ready } = createRoom(
    import.meta.env.BASE_URL + 'assets/',
    renderer.capabilities.getMaxAnisotropy(),
    error => {
      if (error) {
        textureError = error;
        onStatus(error.message);
        return;
      }
      materialsDirty = true;
    },
  );
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, .1, 30);
  const pipeline = createPipeline(renderer, scene, camera, lighting.rasterLights);
  const photoreal = createPhotoreal(renderer, scene, camera, pipeline, onStatus, onExport, ready);
  photoreal.setNoise(settings.noise);
  const gl = renderer.getContext();
  const renderSize = new THREE.Vector2();

  function applyLighting() {
    const { view, mood, ceiling: ceilingMode, weather, outside, desk: deskOn, shelf: shelfOn, fill: fillOn } = settings;
    const lightingSettings = [mood, ceilingMode, outside ? weather : '', outside, deskOn, shelfOn, fillOn];
    const changed = lightingSettings.some((value, i) => value !== previousLighting?.[i]);
    const materialChanged = lightingSettings.slice(0, -1).some((value, i) => value !== previousLighting?.[i]);
    const previousBackdrop = backdrop.material.emissiveMap;
    lighting.update({ mood, ceilingMode, weather, outside, deskOn, shelfOn, fillOn });
    backdrop.update(view, mood);
    if (qualityStage > 0 && lighting.shadowsNeedUpdate) renderer.shadowMap.needsUpdate = true;
    const backdropChanged = previousBackdrop !== backdrop.material.emissiveMap;
    const reflectionsChanged = changed || (outside && backdropChanged);
    if (reflectionsChanged) pipeline.invalidateReflections({ immediate: changed && !firstFrame });
    if (backdropChanged || materialChanged) photoreal.invalidate('scene');
    else if (changed) photoreal.invalidate('lighting');
    previousLighting = lightingSettings;
    lightingDirty = false;
    return reflectionsChanged;
  }

  function applyCamera() {
    const { horizontal: x, height: y, pan, tilt, zoom: fov } = settings;
    camera.position.set(.3 + x * .5, 1.65 + y, 2.55);
    camera.fov = fov;
    camera.lookAt(-.55 + x * .35, 1.7 + y, -2.8);
    camera.rotateOnWorldAxis(camera.up, -THREE.MathUtils.degToRad(pan));
    camera.rotateX(THREE.MathUtils.degToRad(tilt));
    camera.updateProjectionMatrix();
    cameraDirty = false;
    dirty = true;
    photoreal.invalidate('camera');
  }

  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    renderer.getSize(renderSize);
    if (!width || !height) return;
    if (renderSize.x !== width || renderSize.y !== height) renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    pipeline.resize(width, height, renderer.getPixelRatio());
    dirty = true;
  }

  function syncControls() {
    const reflectionsChanged = lightingDirty && applyLighting();
    if (cameraDirty) applyCamera();
    if (materialsDirty) {
      if (!reflectionsChanged) pipeline.invalidateReflections();
      photoreal.invalidate('scene');
      materialsDirty = false;
      dirty = true;
    }
    dirty ||= reflectionsChanged;
  }

  const resizeObserver = new ResizeObserver(() => {
    if (photoreal.exporting) return;
    resize();
    photoreal.invalidate('camera');
  });
  resizeObserver.observe(viewport);

  renderer.domElement.addEventListener('webglcontextrestored', () => {
    pipeline.resetReflections();
    lighting.invalidateShadows();
    renderer.shadowMap.needsUpdate = true;
    dirty = true;
  });

  syncControls();
  resize();
  await pipeline.compile();

  function refinePreview(now) {
    qualityStage++;
    if (qualityStage === 1) renderer.shadowMap.needsUpdate = true;
    if (qualityStage === 2) {
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
      resize();
    }
    pipeline.setEffects({ ambientOcclusion: qualityStage >= 2, antialiasing: qualityStage >= 3 });
    qualityAt = qualityStage < 3 ? now + 80 : Infinity;
    dirty = true;
  }

  renderer.setAnimationLoop(now => {
    if (photoreal.exporting || gl.isContextLost()) return;
    syncControls();
    if (!dirty && now >= qualityAt) refinePreview(now);
    if (pipeline.reflectionVersion !== reflectionVersion) {
      reflectionVersion = pipeline.reflectionVersion;
      dirty = true;
    }
    if (dirty) {
      pipeline.render();
      dirty = false;
      if (firstFrame) {
        firstFrame = false;
        onStatus(textureError?.message ?? 'Fast preview');
        onReady();
        qualityAt = now + 160;
      }
    } else if (qualityStage >= 3 && pipeline.advanceReflections()) {
      return;
    }
    if (qualityStage >= 3) {
      onRealisticReady();
      photoreal.frame();
    }
  });
  return {
    update(next) {
      const lightingKeys = ['view', 'mood', 'ceiling', 'weather', 'outside', 'desk', 'shelf', 'fill'];
      const cameraKeys = ['horizontal', 'height', 'pan', 'tilt', 'zoom'];
      lightingDirty ||= lightingKeys.some(key => settings[key] !== next[key]);
      cameraDirty ||= cameraKeys.some(key => settings[key] !== next[key]);
      if (settings.noise !== next.noise) photoreal.setNoise(next.noise);
      if (settings.realistic !== next.realistic) {
        photoreal.setEnabled(next.realistic);
        dirty = true;
      }
      settings = { ...next };
    },
    async exportImage(quality, resolution) {
      syncControls();
      try { return await photoreal.exportImage(quality, resolution); }
      finally { resize(); }
    },
    cancelExport() { photoreal.cancel(); },
    dispose() { resizeObserver.disconnect(); renderer.setAnimationLoop(null); renderer.dispose(); },
  };
}
