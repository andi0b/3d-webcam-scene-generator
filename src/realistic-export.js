export const EXPORT_SIZES = {
  '1080': { width: 1920, height: 1080 },
  '720': { width: 1280, height: 720 },
  '480': { width: 854, height: 480 },
};

export const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

export async function renderRealisticExport(scene, camera, settings, { width, height }, checkCancelled, report) {
  if (!navigator.gpu) {
    throw new Error('Realistic export requires WebGPU. Open Roomlight on localhost or HTTPS in a browser with WebGPU enabled.');
  }

  const [{ WebGPURenderer, ACESFilmicToneMapping }, { WebGPUPathTracer, OIDNDenoiser }, { initUNetFromURL }] =
    await Promise.all([import('three/webgpu'), import('three-gpu-pathtracer/webgpu'), import('oidn-webgpu')]);
  checkCancelled();

  // Keep the WebGL preview canvas and its render targets at viewport size.
  const canvas = document.createElement('canvas');
  const renderer = new WebGPURenderer({ canvas, alpha: false, antialias: false, trackTimestamp: true });
  let tracer, denoiser, initialized = false, failure;
  const onDeviceLost = renderer.onDeviceLost.bind(renderer);
  const onError = renderer.onError.bind(renderer);
  renderer.onDeviceLost = info => {
    failure = new Error('The WebGPU device was lost. Try the export again at a lower resolution.');
    onDeviceLost(info);
  };
  renderer.onError = info => {
    failure ??= new Error(`WebGPU export failed: ${info.message || info.type}`);
    onError(info);
  };

  function checkActive() {
    checkCancelled();
    if (failure) throw failure;
  }

  try {
    report('Starting WebGPU…');
    await renderer.init();
    initialized = true;
    checkActive();
    if (!renderer.backend.isWebGPUBackend) {
      throw new Error('The browser could not start WebGPU on this GPU. Select Fast preview to export with WebGL.');
    }
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    tracer = new WebGPUPathTracer(renderer);
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
      failure ??= new Error(`Open Image Denoise failed: ${error.message || error}`);
    });
    tracer.setDenoiser(denoiser);
    denoiser = null; // The tracer owns the attached denoiser.

    let lastProgressAt = performance.now();
    let lastProgress;
    tracer.addEventListener('progress', ({ stage, progress, samples }) => {
      const position = `${stage}/${samples?.avg ?? progress}`;
      if (position !== lastProgress) {
        lastProgressAt = performance.now();
        lastProgress = position;
      }
      const percent = Math.floor((progress ?? 0) * 100);
      if (stage === 'compiling') report('Compiling WebGPU shaders…');
      if (stage === 'rendering') report(`Rendering ${height}p · ${percent}%`);
      if (stage === 'denoising') report(`Denoising ${height}p · ${percent}%`);
    });

    report('Preparing the scene…');
    await nextFrame();
    checkActive();
    tracer.setScene(scene, camera);
    lastProgressAt = performance.now();

    while (true) {
      checkActive();
      tracer.renderSample();
      checkActive();
      if (tracer.complete) {
        // Present only the finished OIDN result on the export canvas.
        // Request the PNG in the same frame, while that canvas image is current.
        report('Encoding PNG…');
        tracer.renderToCanvas = true;
        tracer.renderSample();
        checkActive();
        const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
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
    try {
      tracer?.dispose();
      denoiser?.dispose();
    } finally {
      if (initialized) await renderer.dispose();
    }
  }
}
