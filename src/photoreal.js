import * as THREE from 'three';
import { createGuidedDenoiser } from './denoise.js';

// Relative to 128 samples × full CSS resolution × 6 bounces:
// 16 × .55² × 3 is ~53× less nominal tracing work (not a timing guarantee).
export const PREVIEW_SETTINGS = { samples: 16, scale: .55, bounces: 3, tiles: 1 };

export const EXPORT_PRESETS = {
  quick: { samples: 48, scale: 2 / 3, bounces: 4, tiles: 2 },
  detailed: { samples: 48, scale: 1, bounces: 4, tiles: 2, filter: { passes: 3, preserveEdges: true } },
  maximum: { samples: 256, scale: 1, bounces: 6, tiles: 3, filter: { passes: 0 } },
};

// Loaded on demand so the interactive renderer is available immediately.
export function createPhotoreal(renderer, scene, camera, preview, status) {
  let tracer, denoiser, starting, ready = false, enabled = false, failed = false, changed = performance.now();
  let pending = true, sceneChanged = true, exporting = false, cancelled = false;
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const report = text => { status.textContent = text; };
  async function start() {
    if (starting) return starting;
    starting = (async () => {
      report('Preparing realistic lighting…');
      const { WebGLPathTracer, GradientEquirectTexture } = await import('three-gpu-pathtracer');
      if (!renderer.extensions.has('EXT_color_buffer_float')) throw new Error('Floating point rendering is unavailable');
      const sky = new GradientEquirectTexture(128);
      sky.topColor.set('#dae6f2'); sky.bottomColor.set('#b7a58b'); sky.update();
      // The raster preview used a prefiltered cubemap; the tracer needs an equirectangular source.
      scene.environment = sky;
      tracer = new WebGLPathTracer(renderer);
      denoiser = createGuidedDenoiser(renderer,preview,camera);
      tracer.filterGlossyFactor = .5;
      tracer.textureSize.set(1024, 1024);
      configurePreview();
      // Texture loading is asynchronous; don't build an atlas from empty images.
      const maps = new Set();
      scene.traverse(object => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) if (material) {
          for (const value of Object.values(material)) if (value?.isTexture) maps.add(value);
        }
      });
      const deadline = performance.now() + 15000;
      while ([...maps].some(texture => !texture.image || texture.image.complete === false)) {
        if (performance.now() > deadline) throw new Error('Scene textures did not finish loading');
        await nextFrame();
      }
      await nextFrame();
      tracer.setScene(scene, camera);
      ready = true;
      pending = true;
    })().catch(error => {
      console.error('Realistic rendering unavailable', error);
      failed = true; tracer?.dispose(); tracer = null;
      report('Realistic rendering unavailable — using fast preview');
      preview.render();
    });
    return starting;
  }
  function configurePreview() {
    tracer.bounces = PREVIEW_SETTINGS.bounces;
    tracer.tiles.set(PREVIEW_SETTINGS.tiles, PREVIEW_SETTINGS.tiles);
    tracer.renderScale = PREVIEW_SETTINGS.scale / renderer.getPixelRatio();
    // Keep the clean interactive image visible until the filtered result is ready.
    tracer.renderToCanvas = false;
    tracer.renderDelay = 0;
  }
  function sync(forceScene = false) {
    scene.updateMatrixWorld(true);
    tracer.updateCamera();
    // Camera moves must not rebuild the texture atlas or upload all scene materials.
    if (sceneChanged || forceScene) {
      tracer.updateMaterials(); tracer.updateLights(); tracer.updateEnvironment();
      sceneChanged = false;
    }
    pending = false;
  }
  return {
    get exporting() { return exporting; },
    get enabled() { return enabled && !failed; },
    cancel() { cancelled = true; },
    setEnabled(value) {
      enabled = value; changed = performance.now(); pending = true;
      if (!value) { preview.render(); report('Fast preview'); }
    },
    invalidate(kind = 'scene') { pending = true; sceneChanged ||= kind !== 'camera'; changed = performance.now(); },
    frame() {
      if (!enabled || failed || exporting) return;
      if (performance.now() - changed < 200) return;
      if (!ready) { start(); return; }
      try {
        if (pending) { configurePreview(); sync(); }
        if (tracer.samples < PREVIEW_SETTINGS.samples) {
          tracer.renderSample();
          if (tracer.samples >= PREVIEW_SETTINGS.samples) {
            denoiser.render(tracer.target.texture,tracer.target.width,tracer.target.height);
            report('Quick realistic preview ready · export adds detail');
          } else report(tracer.isCompiling ? 'Preparing realistic lighting…' : `Refining light · ${Math.floor(tracer.samples)} / ${PREVIEW_SETTINGS.samples}`);
        }
      } catch(error) {
        console.error(error); failed = true; preview.render(); report('Realistic rendering unavailable — using fast preview');
      }
    },
    async exportImage(preset = 'quick') {
      if (exporting) return;
      const settings = EXPORT_PRESETS[preset] || EXPORT_PRESETS.quick;
      cancelled = false;
      await start();
      if (!tracer || failed) throw new Error('Realistic rendering is unavailable. Select Fast preview to export.');
      if (cancelled) { report('Export cancelled'); return; }
      exporting = true;
      const ratio = renderer.getPixelRatio(), size = renderer.getSize(new THREE.Vector2());
      const aspect = camera.aspect;
      const startedAt = performance.now();
      try {
        renderer.setPixelRatio(1); renderer.setSize(1920,1080,false);
        camera.aspect = 16 / 9; camera.updateProjectionMatrix();
        preview.resize(1920,1080,1);
        preview.render();
        tracer.renderScale = settings.scale; tracer.bounces = settings.bounces;
        tracer.tiles.set(settings.tiles, settings.tiles);
        // Accumulate offscreen so every tile doesn't copy the entire image to the canvas.
        sync(true);
        // Yield between tiles so progress and Cancel stay responsive.
        while (tracer.samples < settings.samples) {
          if (cancelled) return;
          if (renderer.getContext().isContextLost()) throw new Error('Graphics context lost. Reload the page to render again.');
          tracer.renderSample();
          report(`Rendering export · ${Math.floor(tracer.samples / settings.samples * 100)}% · ${Math.round((performance.now() - startedAt) / 1000)}s`);
          await nextFrame();
        }
        denoiser.render(tracer.target.texture,tracer.target.width,tracer.target.height,settings.filter);
        const link = document.createElement('a'); link.download = 'roomlight-realistic.png';
        link.href = renderer.domElement.toDataURL('image/png'); link.click();
      } finally {
        exporting = false;
        renderer.setPixelRatio(ratio); renderer.setSize(size.x,size.y,false);
        camera.aspect = aspect; camera.updateProjectionMatrix(); preview.resize(size.x,size.y,ratio);
        configurePreview();
        pending = true; changed = performance.now(); preview.render();
        report(cancelled ? 'Export cancelled' : 'Refining light…');
      }
    },
  };
}
