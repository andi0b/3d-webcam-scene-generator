import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createPhotoreal } from './photoreal.js';
import { createPipeline } from './render-pipeline.js';
import { createRoom } from './scene/room.js';
import { createExportUI } from './export-ui.js';

export async function startStudio() {
  const viewport = document.querySelector('#viewport');
  const loadingStatus = document.querySelector('#preview-loading');
  const renderStatus = document.querySelector('#render-status');
  const exportUI = createExportUI();
  const sidebar = document.querySelector('aside');
  const renderModes = document.querySelector('.render-quality [role=group]');
  const fastMode = document.querySelector('#quality-fast');
  const realisticMode = document.querySelector('#quality-real');
  const exportButton = document.querySelector('#export');
  const exportQuality = document.querySelector('#export-quality');
  const exportResolution = document.querySelector('#export-resolution');
  const webcamNoise = document.querySelector('#webcam-noise');
  const cancelExport = document.querySelector('#cancel-render');
  const guide = document.querySelector('#guide');
  const lightControls = ['ceiling-light', 'weather', 'outside', 'desk', 'shelf', 'fill'].map(id => document.getElementById(id));
  const cameraSliders = ['horizontal', 'height', 'pan', 'tilt', 'zoom'].map(id => document.getElementById(id));

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
        renderStatus.textContent = error.message;
        return;
      }
      materialsDirty = true;
    },
  );
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, .1, 30);
  const pipeline = createPipeline(renderer, scene, camera, lighting.rasterLights);
  const photoreal = createPhotoreal(renderer, scene, camera, pipeline, renderStatus, exportUI.report, ready);
  photoreal.setNoise(webcamNoise.value);
  webcamNoise.addEventListener('change', () => photoreal.setNoise(webcamNoise.value));
  const gl = renderer.getContext();
  const renderSize = new THREE.Vector2();

  function applyLighting() {
    const view = document.querySelector('[data-view].active').dataset.view;
    const mood = document.querySelector('[data-preset].active').dataset.preset;
    const [ceilingMode, weather, outside, deskOn, shelfOn, fillOn] = lightControls.map(
      control => control.type === 'checkbox' ? control.checked : control.querySelector('input:checked').value,
    );
    const settings = [mood, ceilingMode, outside ? weather : '', outside, deskOn, shelfOn, fillOn];
    const changed = settings.some((value, i) => value !== previousLighting?.[i]);
    const materialChanged = settings.slice(0, -1).some((value, i) => value !== previousLighting?.[i]);
    const previousBackdrop = backdrop.material.emissiveMap;
    lighting.update({ mood, ceilingMode, weather, outside, deskOn, shelfOn, fillOn });
    backdrop.update(view, mood);
    if (qualityStage > 0 && lighting.shadowsNeedUpdate) renderer.shadowMap.needsUpdate = true;
    const backdropChanged = previousBackdrop !== backdrop.material.emissiveMap;
    const reflectionsChanged = changed || (outside && backdropChanged);
    if (reflectionsChanged) pipeline.invalidateReflections({ immediate: changed && !firstFrame });
    if (backdropChanged || materialChanged) photoreal.invalidate('scene');
    else if (changed) photoreal.invalidate('lighting');
    previousLighting = settings;
    lightingDirty = false;
    return reflectionsChanged;
  }

  function applyCamera() {
    const [x, y, pan, tilt, fov] = cameraSliders.map(control => Number(control.value));
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

  function showGuide() {
    document.querySelector('#person-guide').classList.toggle('hidden', firstFrame || !guide.checked);
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

  for (const control of document.querySelectorAll('[data-view], [data-preset]')) {
    control.addEventListener('click', () => { lightingDirty = true; });
  }
  for (const control of lightControls) {
    control.addEventListener('change', () => { lightingDirty = true; });
  }
  for (const slider of cameraSliders) {
    slider.addEventListener('input', () => { cameraDirty = true; });
  }
  document.querySelector('#reset').addEventListener('click', () => { cameraDirty = true; });
  guide.addEventListener('change', showGuide);
  new ResizeObserver(() => {
    if (photoreal.exporting) return;
    resize();
    photoreal.invalidate('camera');
  }).observe(viewport);

  fastMode.onclick = () => setRealistic(false);
  realisticMode.onclick = () => setRealistic(true);
  function setRealistic(realistic) {
    photoreal.setEnabled(realistic);
    realisticMode.setAttribute('aria-pressed', String(realistic));
    fastMode.setAttribute('aria-pressed', String(!realistic));
    dirty = true;
  }

  exportButton.onclick = async () => {
    if (photoreal.exporting) return;
    syncControls();
    exportButton.disabled = exportQuality.disabled = exportResolution.disabled = webcamNoise.disabled = true;
    sidebar.inert = renderModes.inert = true;
    exportUI.start();
    try {
      const png = await photoreal.exportImage(
        exportQuality.querySelector('input:checked').value,
        exportResolution.querySelector('input:checked').value,
      );
      if (png) exportUI.complete(png);
    } catch (error) {
      exportUI.error(error);
    } finally {
      exportButton.disabled = exportQuality.disabled = exportResolution.disabled = webcamNoise.disabled = false;
      sidebar.inert = renderModes.inert = false;
      exportUI.finish();
      resize();
    }
  };
  cancelExport.onclick = () => {
    exportUI.cancelling();
    photoreal.cancel();
  };

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
        loadingStatus.hidden = true;
        viewport.setAttribute('aria-busy', 'false');
        renderStatus.textContent = textureError?.message ?? 'Fast preview';
        exportButton.disabled = false;
        showGuide();
        qualityAt = now + 160;
      }
    } else if (qualityStage >= 3 && pipeline.advanceReflections()) {
      return;
    }
    if (qualityStage >= 3) {
      realisticMode.disabled = false;
      photoreal.frame();
    }
  });
}
