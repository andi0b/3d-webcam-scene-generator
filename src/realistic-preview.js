import { createOidnRenderer } from './realistic-export.js';

export async function createOidnPreview(fastCanvas, scene, camera, settings, report) {
  const canvas = document.createElement('canvas');
  canvas.className = 'realistic-preview';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.visibility = 'hidden';
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
    tracer.setScene(scene, traceCamera);
    if (failure) throw failure;
    fastCanvas.after(canvas);
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
    sync({ materialsChanged, lightsChanged }) {
      if (failure) throw failure;
      const { width, height } = fastCanvas;
      if (!width || !height) return;
      if (canvas.width !== width || canvas.height !== height) renderer.setSize(width, height, false);
      traceCamera.copy(camera);
      tracer.updateCamera();
      if (materialsChanged) tracer.updateMaterials();
      if (lightsChanged) {
        scene.updateMatrixWorld(true);
        tracer.updateLights();
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
        canvas.style.visibility = 'visible';
        rendering = false;
        report('Realistic preview ready');
      }
    },
    hide() {
      canvas.style.visibility = 'hidden';
      pause();
    },
    pause,
    dispose() {
      rendering = false;
      canvas.remove();
      return pipeline.dispose();
    },
  };
}
