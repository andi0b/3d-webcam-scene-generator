import { applyWebcamNoise } from './webcam-noise.js';
import { withoutPreviewOnlyLights } from './realistic-lights.js';
import { exposureMultiplier } from './exposure.js';

export const EXPORT_SIZES = {
  '3k': { width: 3072, height: 1728 },
  '1080': { width: 1920, height: 1080 },
  '720': { width: 1280, height: 720 },
  '480': { width: 854, height: 480 },
};

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

export async function createOidnRenderer(canvas, settings, onFailure, checkCancelled = () => {}) {
  if (!navigator.gpu) {
    throw new Error('Realistic lighting requires WebGPU. Open Roomlight on localhost or HTTPS in a browser with WebGPU enabled.');
  }

  const [{ WebGPURenderer, ACESFilmicToneMapping }, { WebGPUPathTracer, OIDNDenoiser, FSRUpscaler }, { initUNetFromURL }] =
    await Promise.all([import('three/webgpu'), import('three-gpu-pathtracer/webgpu'), import('oidn-webgpu')]);
  checkCancelled();

  const renderer = new WebGPURenderer({ canvas, alpha: false, antialias: false, trackTimestamp: true });
  let tracer, denoiser, initialized = false, disposed = false, failure;
  const onDeviceLost = renderer.onDeviceLost.bind(renderer);
  const onError = renderer.onError.bind(renderer);
  const fail = error => {
    if (disposed || failure) return;
    failure = error;
    onFailure(error);
  };
  renderer.onDeviceLost = info => {
    if (disposed) return;
    fail(new Error('The WebGPU device was lost.'));
    onDeviceLost(info);
  };
  renderer.onError = info => {
    if (disposed) return;
    fail(new Error(`WebGPU rendering failed: ${info.message || info.type}`));
    onError(info);
  };

  async function dispose() {
    if (disposed) return;
    disposed = true;
    try {
      tracer?.dispose();
      denoiser?.dispose();
    } finally {
      if (initialized) await renderer.dispose();
    }
  }

  try {
    await renderer.init();
    initialized = true;
    checkCancelled();
    if (failure) throw failure;
    if (!renderer.backend.isWebGPUBackend) {
      throw new Error('The browser could not start WebGPU on this GPU.');
    }
    renderer.setPixelRatio(1);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = settings.exposure ?? exposureMultiplier();

    tracer = new WebGPUPathTracer(renderer);
    tracer.renderScale = settings.renderScale ?? 1;
    tracer.maxSamples = settings.samples;
    tracer.maxBounces = settings.bounces;
    tracer.renderDelay = 0;
    tracer.fadeDuration = 0;
    tracer.dynamicLowRes = false;
    tracer.asyncCompile = true;
    tracer.renderToCanvas = false;

    const weights = `${import.meta.env.BASE_URL}assets/oidn/`;
    denoiser = new OIDNDenoiser({
      initUNetFromURL,
      auxWeightsUrl: `${weights}rt_hdr_alb_nrm.tza`,
      colorWeightsUrl: `${weights}rt_hdr.tza`,
      maxTileSize: 256,
    });
    denoiser.addEventListener('error', ({ error }) => {
      fail(new Error(`Open Image Denoise failed: ${error.message || error}`));
    });
    tracer.setDenoiser(denoiser);
    denoiser = null; // The tracer owns the attached denoiser.
    if (tracer.renderScale < 1) {
      const { Upscaler } = await import('@pmndrs/upscaler');
      checkCancelled();
      if (failure) throw failure;
      tracer.setUpscaler(new FSRUpscaler({ Upscaler }));
    }
    return { renderer, tracer, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}

export async function renderRealisticExport(scene, camera, settings, { width, height }, checkCancelled, report) {
  const canvas = document.createElement('canvas');
  let pipeline, failure;
  function checkActive() {
    checkCancelled();
    if (failure) throw failure;
  }
  try {
    report({ stage: 'preparing' });
    pipeline = await createOidnRenderer(canvas, settings, error => { failure = error; }, checkCancelled);
    checkActive();
    const { renderer, tracer } = pipeline;
    renderer.setSize(width, height, false);
    let lastProgressAt = performance.now();
    let lastProgress;
    tracer.addEventListener('progress', ({ stage, progress, samples }) => {
      const position = `${stage}/${samples?.avg ?? progress}`;
      if (position !== lastProgress) {
        lastProgressAt = performance.now();
        lastProgress = position;
      }
      if (stage === 'compiling') report({ stage: 'preparing' });
      if (stage === 'rendering') report({ stage: 'rendering', progress });
      if (stage === 'denoising') report({ stage: 'finishing' });
    });

    report({ stage: 'preparing' });
    await nextFrame();
    checkActive();
    withoutPreviewOnlyLights(scene, () => tracer.setScene(scene, camera));
    lastProgressAt = performance.now();

    while (true) {
      checkActive();
      tracer.renderSample();
      checkActive();
      if (tracer.complete) {
        // WebGPU canvas capture must start in the same frame as the final draw.
        report({ stage: 'finishing' });
        tracer.renderToCanvas = true;
        tracer.renderSample();
        checkActive();
        let output = canvas;
        if (settings.noise === 'low' || settings.noise === 'high') {
          output = document.createElement('canvas');
          output.width = width;
          output.height = height;
          const context = output.getContext('2d', { alpha: false });
          if (!context) throw new Error('The browser could not apply webcam noise.');
          context.drawImage(canvas, 0, 0);
          const image = context.getImageData(0, 0, width, height);
          context.putImageData(applyWebcamNoise(image, settings.noise), 0, 0);
        }
        const png = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
        checkActive();
        if (!png) throw new Error('The browser could not encode the rendered PNG.');
        return png;
      }
      if (performance.now() - lastProgressAt > 120000) {
        throw new Error('WebGPU export stopped making progress. Try a lower resolution.');
      }
      await nextFrame();
    }
  } finally {
    await pipeline?.dispose();
  }
}
