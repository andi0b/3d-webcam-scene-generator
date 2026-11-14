import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createPhotoreal } from './photoreal.js';
import { EXPORT_SIZES, nextFrame } from './realistic-export.js';
import { createPipeline } from './render-pipeline.js';
import { createRoom } from './scene/room.js';

export async function startStudio() {
  const viewport = document.querySelector('#viewport');
  const loadingStatus = document.querySelector('#preview-loading');
  const renderStatus = document.querySelector('#render-status');
  const exportStatus = document.querySelector('#export-status');
  const sidebar = document.querySelector('aside');
  const renderModes = document.querySelector('.render-quality [role=group]');
  const fastMode = document.querySelector('#quality-fast');
  const realisticMode = document.querySelector('#quality-real');
  const exportButton = document.querySelector('#export');
  const exportQuality = document.querySelector('#export-quality');
  const exportResolution = document.querySelector('#export-resolution');
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

  let dirty = true, cameraDirty = true, lightingDirty = true, exporting = false;
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
  const photoreal = createPhotoreal(renderer, scene, camera, pipeline, renderStatus, exportStatus, ready);
  const gl = renderer.getContext();
  const renderSize = new THREE.Vector2();

  function applyLighting() {
    const view = document.querySelector('[data-view].active').dataset.view;
    const mood = document.querySelector('[data-preset].active').dataset.preset;
    const [ceilingMode, weather, outside, deskOn, shelfOn, fillOn] = lightControls.map(
      control => control.type === 'checkbox' ? control.checked : control.value,
    );
    const settings = [mood, ceilingMode, outside ? weather : '', outside, deskOn, shelfOn, fillOn];
    const changed = settings.some((value, i) => value !== previousLighting?.[i]);
    const materialChanged = settings.slice(0, -1).some((value, i) => value !== previousLighting?.[i]);
    const previousBackdrop = backdrop.material.emissiveMap;
    lighting.update({ mood, ceilingMode, weather, outside, deskOn, shelfOn, fillOn });
    backdrop.update(view, mood);
    if (qualityStage > 0 && lighting.shadowsNeedUpdate) renderer.shadowMap.needsUpdate = true;
    const backdropChanged = previousBackdrop !== backdrop.material.emissiveMap;
    if (changed || (outside && backdropChanged)) {
      pipeline.invalidateReflections();
      dirty = true;
    }
    if (backdropChanged || materialChanged) photoreal.invalidate('scene');
    else if (changed) photoreal.invalidate('lighting');
    previousLighting = settings;
    lightingDirty = false;
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
    if (lightingDirty) applyLighting();
    if (cameraDirty) applyCamera();
    if (materialsDirty) {
      pipeline.invalidateReflections();
      photoreal.invalidate('scene');
      materialsDirty = false;
      dirty = true;
    }
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
    if (exporting) return;
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

  function setExportShadows(forExport) {
    lighting.setShadowResolution(forExport);
    renderer.shadowMap.needsUpdate = true;
  }

  async function renderFastExport(resolution) {
    const { width, height } = EXPORT_SIZES[resolution];
    const ratio = renderer.getPixelRatio();
    try {
      if (gl.isContextLost()) throw new Error('The graphics context was lost. Wait for the preview to return.');
      setExportShadows(true);
      renderer.setDrawingBufferSize(width, height, 1.5);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      pipeline.resize(width, height, 1.5);
      pipeline.setEffects({ ambientOcclusion: true, antialiasing: true });
      pipeline.render({ forExport: true });

      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const context = output.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(renderer.domElement, 0, 0, width, height);
      if (gl.isContextLost()) throw new Error('The graphics context was lost. Try a lower export resolution.');
      return await new Promise(resolve => output.toBlob(resolve, 'image/png'));
    } finally {
      setExportShadows(false);
      pipeline.setEffects({ ambientOcclusion: qualityStage >= 2, antialiasing: qualityStage >= 3 });
      renderer.setPixelRatio(ratio);
    }
  }

  exportButton.onclick = async () => {
    if (exporting) return;
    syncControls();
    const realistic = photoreal.enabled;
    const resolution = exportResolution.value;
    const quality = exportQuality.value;
    exporting = true;
    exportButton.disabled = exportQuality.disabled = exportResolution.disabled = true;
    sidebar.inert = renderModes.inert = true;
    cancelExport.hidden = !realistic;
    exportStatus.textContent = 'Preparing export…';
    try {
      if (realistic) {
        await photoreal.exportImage(quality, resolution);
      } else {
        await nextFrame();
        await ready();
        syncControls();
        const png = await renderFastExport(resolution);
        if (!png) throw new Error('The browser could not encode the PNG.');
        const url = URL.createObjectURL(png);
        const link = document.createElement('a');
        link.download = 'roomlight-background.png';
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        exportStatus.textContent = 'Download started';
      }
    } catch (error) {
      exportStatus.textContent = error.message;
    } finally {
      exporting = false;
      exportButton.disabled = exportQuality.disabled = exportResolution.disabled = false;
      sidebar.inert = renderModes.inert = false;
      cancelExport.hidden = true;
      resize();
    }
  };
  cancelExport.onclick = () => photoreal.cancel();

  renderer.domElement.addEventListener('webglcontextrestored', () => {
    pipeline.resetReflections();
    setExportShadows(false);
    dirty = true;
  });

  lighting.setShadowResolution(false);
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
    if (exporting || gl.isContextLost()) return;
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
