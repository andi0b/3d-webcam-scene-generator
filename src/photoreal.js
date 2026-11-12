import { createGuidedDenoiser } from './denoise.js';
import { EXPORT_SIZES, nextFrame, renderRealisticExport } from './realistic-export.js';

export const PREVIEW_SETTINGS = { samples: 8, scale: .45, bounces: 3, tiles: 2 };

export const EXPORT_PRESETS = {
  quick: { samples: 16, bounces: 4 },
  detailed: { samples: 96, bounces: 4 },
  maximum: { samples: 256, bounces: 6 },
};

const exportCancelled = Symbol('export cancelled');

export function createPhotoreal(renderer, scene, camera, preview, status, exportStatus) {
  const gl = renderer.getContext();
  let tracer, denoiser, library, starting;
  let enabled = false, failed = false, exporting = false, cancelled = false;
  let pending = true, sceneChanged = true, changed = performance.now();
  let contextGeneration = 0;

  function report(text) {
    if (status.textContent !== text) status.textContent = text;
  }

  function reportExport(text) {
    if (exportStatus.textContent !== text) exportStatus.textContent = text;
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
    library = await (library ?? import('three-gpu-pathtracer'));
    checkActive();

    // Wait for the active textures before building either tracer's texture atlas.
    const maps = new Set();
    scene.traverse(object => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) {
          if (value?.isTexture) maps.add(value);
        }
      }
    });
    const textures = [...maps];
    const deadline = performance.now() + 15000;
    while (textures.some(texture => !texture.image || texture.image.complete === false)) {
      if (performance.now() > deadline) throw new Error('Scene textures did not finish loading.');
      await nextFrame();
      checkActive();
    }
    if (textures.some(({ image }) => image.naturalWidth === 0)) {
      throw new Error('A scene texture failed to load.');
    }
  }

  function releaseTracer() {
    denoiser?.dispose();
    tracer?.dispose();
    denoiser = tracer = null;
  }

  function start() {
    if (tracer) return Promise.resolve();
    if (starting) return starting;
    const generation = contextGeneration;
    starting = (async () => {
      report('Preparing realistic lighting…');
      try {
        await prepareScene(() => checkPreviewContext(generation));
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
        sceneChanged = false;
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
    if (sceneChanged) {
      tracer.updateMaterials();
      tracer.updateLights();
      tracer.updateEnvironment();
      sceneChanged = false;
    }
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
    sceneChanged = true;
    failed = false;
    changed = performance.now();
    report(enabled ? 'Preparing realistic lighting…' : 'Fast preview');
  });

  return {
    get exporting() { return exporting; },
    get enabled() { return enabled; },
    cancel() { cancelled = true; },
    setEnabled(value) {
      enabled = value;
      failed = false;
      changed = performance.now();
      pending = true;
      if (!value && !gl.isContextLost()) report('Fast preview');
    },
    invalidate(kind = 'scene') {
      pending = true;
      sceneChanged ||= kind !== 'camera';
      changed = performance.now();
    },
    frame() {
      if (!enabled || failed || exporting || gl.isContextLost() || performance.now() - changed < 200) return;
      const generation = contextGeneration;
      if (!tracer) {
        if (!starting) start().catch(error => previewFailed(error, generation));
        return;
      }
      try {
        if (pending) {
          configurePreview();
          sync();
        }
        if (tracer.samples >= PREVIEW_SETTINGS.samples) return;
        tracer.renderSample();
        if (tracer.samples >= PREVIEW_SETTINGS.samples) {
          denoiser.render(tracer.target.texture, tracer.target.width, tracer.target.height);
          report('Quick realistic preview ready · export adds detail');
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
        reportExport('Preparing export…');
        await prepareScene(checkCancelled);
        checkCancelled();
        const settings = EXPORT_PRESETS[preset] ?? EXPORT_PRESETS.quick;
        const dimensions = EXPORT_SIZES[resolution] ?? EXPORT_SIZES['1080'];
        const exportCamera = camera.clone();
        exportCamera.aspect = dimensions.width / dimensions.height;
        exportCamera.updateProjectionMatrix();
        const png = await renderRealisticExport(scene, exportCamera, settings, dimensions, checkCancelled, reportExport);
        checkCancelled();
        const url = URL.createObjectURL(png);
        const link = document.createElement('a');
        link.download = 'roomlight-realistic.png';
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        reportExport('Download started');
      } catch (error) {
        if (error !== exportCancelled) throw error;
        reportExport('Export cancelled');
      } finally {
        exporting = false;
        pending = true;
        changed = performance.now();
      }
    },
  };
}
