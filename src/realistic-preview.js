import { createOidnRenderer } from './realistic-export.js';
import { withoutPreviewOnlyLights } from './realistic-lights.js';

export async function createOidnPreview(fastCanvas, scene, camera, settings, report, showFrame) {
  const canvas = document.createElement('canvas');
  let failure;
  const pipeline = await createOidnRenderer(canvas, settings, error => { failure = error; });
  const { renderer, tracer } = pipeline;
  const traceCamera = camera.clone();
  let rendering = false;

  tracer.renderScale = settings.scale;
  tracer.addEventListener('progress', ({ stage, samples }) => {
    if (!rendering) return;
    if (stage === 'compiling') report('Preparing realistic lighting…');
    if (stage === 'rendering') report(`Refining light · ${Math.floor(samples?.avg ?? 0)} / ${settings.samples}`);
    if (stage === 'denoising') report('Denoising realistic preview…');
  });

  try {
    withoutPreviewOnlyLights(scene, () => tracer.setScene(scene, traceCamera));
    if (failure) throw failure;
  } catch (error) {
    await pipeline.dispose();
    throw error;
  }

  function pause() {
    if (!rendering) return;
    rendering = false;
    tracer.reset();
  }

  return {
    sync({ materialsChanged, lightsChanged, visibilityChanged }) {
      if (failure) throw failure;
      const { width, height } = fastCanvas;
      if (!width || !height) return;
      if (canvas.width !== width || canvas.height !== height) renderer.setSize(width, height, false);
      traceCamera.copy(camera);
      tracer.updateCamera();
      if (materialsChanged) tracer.updateMaterials();
      if (visibilityChanged) tracer.updateTransforms();
      if (lightsChanged) {
        scene.updateMatrixWorld(true);
        withoutPreviewOnlyLights(scene, () => tracer.updateLights());
      }
      tracer.renderToCanvas = false;
      rendering = true;
      report('Preparing realistic lighting…');
    },
    frame() {
      if (failure) throw failure;
      if (!rendering) return;
      tracer.renderSample();
      if (failure) throw failure;
      if (tracer.complete) {
        tracer.renderToCanvas = true;
        tracer.renderSample();
        if (failure) throw failure;
        showFrame(canvas);
        rendering = false;
        report('Realistic preview ready');
      }
    },
    pause,
    dispose() {
      rendering = false;
      return pipeline.dispose();
    },
  };
}
