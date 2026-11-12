# Roomlight Studio

A small Three.js prototype for composing a 3D webcam background. The room, furnishings and lighting are 3D; the window views are generated photographic backdrops, and the wood and plaster use generated image textures.

## Run

Install Node.js, then run `npm install` and `npm run dev`. Open the local URL printed in the terminal. Choose a scene and lighting, adjust the camera, and export a 1920 × 1080 PNG to use as a virtual background in your meeting app.

The export is a still image; it does not create a virtual webcam or remove your camera background. Rendering quality and performance depend on your browser and graphics hardware.


## Realistic lighting

The optional Realistic lighting mode uses `three-gpu-pathtracer` with a lightweight preview: 16 samples, three light bounces, and 55% of the viewport resolution in each dimension, followed by five passes of depth-, normal-, and preview-color-guided filtering and upscaling. This is about 53× less nominal tracing work than the original 128-sample, full-resolution, six-bounce preview; GPU time is not guaranteed to scale proportionally. Camera and lighting changes show the fast preview immediately and restart tracing after a 200 ms pause. Camera-only changes skip material and environment uploads. Export presets remain independent and retain their higher quality. Fast preview is selected initially.

Realistic export defaults to Quick: 48 samples, four bounces, rendered at 1280 × 720, then edge-aware denoised and upscaled to a 1920 × 1080 PNG. Detailed traces 48 samples with four bounces at 1920 × 1080 and uses a smaller filter that retains more texture and edge detail. Maximum preserves the original 256 samples, full resolution, and six bounces without denoising. The fast preview stays visible during export while the app shows progress and offers a Cancel export button. Editing is temporarily disabled to keep the exported scene consistent. The render time depends on the GPU and can take minutes. If initialization fails, the app reports that it is using the fast renderer. A floating-point WebGL2 render target is required for path tracing.

Validation: production build and CPU scene/BVH generation checks. GPU shader compilation, final appearance, and export timing still require verification in a supported browser. The models remain procedural; path tracing improves lighting but does not replace scanned furniture or botanical assets.

The clean raster preview remains visible while path tracing accumulates. Preview and Quick export use five geometry-guided filter passes to reduce noise and upscale the result. Detailed uses three passes and retains more of the original samples at geometric edges. The artwork uses RGBA vertex colors because the path-tracer merger loses RGB colors in a mixed RGB/RGBA scene. Run `node tests/relief-colors.mjs` to check that regression.
