import { createGuidedDenoiser } from './denoise.js';
import { EXPORT_SIZES, renderRealisticExport } from './realistic-export.js';
import { createOidnPreview } from './realistic-preview.js';

export const PREVIEW_SETTINGS = { samples: 8, scale: .45, bounces: 3, tiles: 2 };
const OIDN_PREVIEW_SETTINGS = { samples: 12, scale: .75, bounces: 4 };

export const EXPORT_PRESETS = {
  quick: { samples: 10, bounces: 4 },
  detailed: { samples: 48, bounces: 6 },
  maximum: { samples: 96, bounces: 8 },
};

const exportCancelled = Symbol('export cancelled');

export function createPhotoreal(renderer, scene, camera, preview, status, reportExport, texturesReady) {
  const gl = renderer.getContext();
  let tracer, denoiser, oidnPreview, library, starting;
  let webGpuUnavailable = false;
  let enabled = false, failed = false, exporting = false, cancelled = false;
  let cancelPreparation;
  let pending = true, materialsChanged = true, lightsChanged = true, changed = performance.now();
  let contextGeneration = 0;

  function report(text) {
    if (status.textContent !== text) status.textContent = text;
  }

  function checkPreviewContext(generation) {
    if (generation !== contextGeneration || gl.isContextLost()) {
      throw new Error('The WebGL preview context was lost.');
    }
  }

  function checkCancelled() {
    if (cancelled) throw exportCancelled;
  }

  async function prepareScene(checkActive) {
    checkActive();
    await texturesReady();
    checkActive();
  }

  function releaseTracer() {
    oidnPreview?.dispose().catch(error => console.error('Realistic preview cleanup failed', error));
    oidnPreview = null;
    denoiser?.dispose();
    tracer?.dispose();
    denoiser = tracer = null;
  }

  function start() {
    if (tracer || oidnPreview) return Promise.resolve();
    if (starting) return starting;
    const generation = contextGeneration;
    starting = (async () => {
      report('Preparing realistic lighting…');
      try {
        await prepareScene(() => checkPreviewContext(generation));
        checkPreviewContext(generation);
        if (exporting) return;
        if (navigator.gpu && !webGpuUnavailable) {
          try {
            const candidate = await createOidnPreview(renderer.domElement, scene, camera, OIDN_PREVIEW_SETTINGS, report);
            if (generation !== contextGeneration || gl.isContextLost() || exporting) {
              await candidate.dispose();
              checkPreviewContext(generation);
              return;
            }
            oidnPreview = candidate;
            pending = materialsChanged = lightsChanged = true;
            return;
          } catch (error) {
            checkPreviewContext(generation);
            if (exporting) return;
            webGpuUnavailable = true;
            console.warn('WebGPU preview unavailable, using WebGL', error);
          }
        }
        library = await (library ?? import('three-gpu-pathtracer'));
        checkPreviewContext(generation);
        if (exporting) return;
        if (!renderer.extensions.has('EXT_color_buffer_float')) {
          throw new Error('This GPU does not support the floating point buffers required for the realistic preview.');
        }
        tracer = new library.WebGLPathTracer(renderer);
        tracer.renderToCanvas = false;
        tracer.renderDelay = 0;
        tracer.filterGlossyFactor = .5;
        tracer.setScene(scene, camera);
        checkPreviewContext(generation);
        denoiser = createGuidedDenoiser(renderer, preview, camera);
        pending = true;
        materialsChanged = lightsChanged = false;
      } catch (error) {
        if (generation === contextGeneration) releaseTracer();
        throw error;
      } finally {
        if (generation === contextGeneration) starting = null;
      }
    })();
    return starting;
  }

  function configurePreview() {
    tracer.bounces = PREVIEW_SETTINGS.bounces;
    tracer.filterGlossyFactor = .5;
    tracer.tiles.set(PREVIEW_SETTINGS.tiles, PREVIEW_SETTINGS.tiles);
    tracer.renderScale = PREVIEW_SETTINGS.scale / renderer.getPixelRatio();
  }

  function sync() {
    scene.updateMatrixWorld(true);
    tracer.setCamera(camera);
    if (materialsChanged) tracer.updateMaterials();
    if (lightsChanged) tracer.updateLights();
    materialsChanged = lightsChanged = false;
    pending = false;
  }

  function previewFailed(error, generation) {
    if (error === exportCancelled || generation !== contextGeneration || gl.isContextLost()) return;
    console.error('Realistic preview failed', error);
    failed = true;
    releaseTracer();
    if (enabled) report('Realistic preview unavailable');
  }

  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextGeneration++;
    starting = null;
    releaseTracer();
    report('Graphics context lost. Waiting for the browser to restore it…');
  });

  renderer.domElement.addEventListener('webglcontextrestored', () => {
    pending = true;
    materialsChanged = lightsChanged = true;
    failed = false;
    webGpuUnavailable = false;
    changed = performance.now();
    report(enabled ? 'Preparing realistic lighting…' : 'Fast preview');
  });

  return {
    get exporting() { return exporting; },
    cancel() {
      cancelled = true;
      cancelPreparation?.(exportCancelled);
    },
    setEnabled(value) {
      enabled = value;
      failed = false;
      changed = performance.now();
      pending = true;
      if (!value) oidnPreview?.hide();
      if (!value && !gl.isContextLost()) report('Fast preview');
    },
    invalidate(kind = 'scene') {
      oidnPreview?.hide();
      if (enabled && oidnPreview && !exporting) report('Updating realistic preview…');
      pending = true;
      materialsChanged ||= kind === 'scene';
      lightsChanged ||= kind !== 'camera';
      changed = performance.now();
    },
    frame() {
      if (!enabled || failed || exporting || gl.isContextLost() || performance.now() - changed < 200) return;
      const generation = contextGeneration;
      if (!tracer && !oidnPreview) {
        if (!starting) start().catch(error => previewFailed(error, generation));
        return;
      }
      try {
        if (oidnPreview) {
          if (pending) {
            oidnPreview.sync({ materialsChanged, lightsChanged });
            pending = materialsChanged = lightsChanged = false;
          }
          oidnPreview.frame();
          return;
        }
        if (pending) {
          configurePreview();
          sync();
        }
        if (tracer.samples >= PREVIEW_SETTINGS.samples) return;
        tracer.renderSample();
        if (tracer.samples >= PREVIEW_SETTINGS.samples) {
          denoiser.render(tracer.target.texture, tracer.target.width, tracer.target.height);
          report('WebGL realistic preview ready · export adds detail');
        } else {
          report(tracer.isCompiling ? 'Preparing realistic lighting…' : `Refining light · ${Math.floor(tracer.samples)} / ${PREVIEW_SETTINGS.samples}`);
        }
      } catch (error) {
        previewFailed(error, generation);
      }
    },
    async exportImage(preset, resolution) {
      if (exporting) return;
      exporting = true;
      cancelled = false;
      try {
        oidnPreview?.pause();
        reportExport({ stage: 'preparing' });
        await Promise.race([
          prepareScene(checkCancelled),
          new Promise((_, reject) => { cancelPreparation = reject; }),
        ]);
        cancelPreparation = null;
        checkCancelled();
        const settings = EXPORT_PRESETS[preset] ?? EXPORT_PRESETS.quick;
        const dimensions = EXPORT_SIZES[resolution] ?? EXPORT_SIZES['1080'];
        const exportCamera = camera.clone();
        exportCamera.aspect = dimensions.width / dimensions.height;
        exportCamera.updateProjectionMatrix();
        const png = await renderRealisticExport(scene, exportCamera, settings, dimensions, checkCancelled, reportExport);
        checkCancelled();
        return png;
      } catch (error) {
        if (error !== exportCancelled) throw error;
        reportExport({ stage: 'cancelled' });
      } finally {
        cancelPreparation = null;
        exporting = false;
        pending = true;
        changed = performance.now();
      }
    },
  };
}
