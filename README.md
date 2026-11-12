# Roomlight Studio

A small Three.js prototype for composing a 3D webcam background. The room, furnishings and lighting are 3D; the window views are generated photographic backdrops, and the wood and plaster use generated image textures.

## Run

Install Node.js, then run `npm install` and `npm run dev`. Open the HTTPS URL printed in the terminal, usually `https://127.0.0.1:5173`. Vite generates a self-signed development certificate, so the browser may show a certificate warning on the first visit.

Choose a scene and lighting, adjust the camera, and export a PNG to use as a virtual background in your meeting app. Export resolution offers 1920 × 1080, 1280 × 720, and 854 × 480 in either rendering mode.

The export is a still image; it does not create a virtual webcam or remove your camera background. Rendering quality and performance depend on your browser and graphics hardware.


## Realistic lighting

The optional Realistic lighting mode uses `three-gpu-pathtracer` with a lightweight preview: 16 samples, three light bounces, and 55% of the viewport resolution in each dimension, followed by five passes of depth-, normal-, and preview-color-guided filtering and upscaling. This is about 53× less nominal tracing work than the original 128-sample, full-resolution, six-bounce preview; GPU time is not guaranteed to scale proportionally. Camera and lighting changes show the fast preview immediately and restart tracing after a 200 ms pause. Camera-only changes skip material and environment uploads. Export presets remain independent and retain their higher quality. Fast preview is selected initially.

Realistic export requires a WebGPU-capable browser on localhost or HTTPS. It traces at the selected resolution and runs Open Image Denoise with albedo and normals accumulated by the tracer. Quick uses 16 samples and four bounces, Detailed uses 96 samples and four bounces, and Maximum uses 256 samples and six bounces. The previous preview stays visible during export. You can cancel while rendering or denoising. Fast export uses WebGL.

The [path tracer's denoising example](https://github.com/gkjohnson/three-gpu-pathtracer/blob/v0.0.28/example/denoise.js) supplies the two bundled [Intel Open Image Denoise weights](https://github.com/RenderKit/oidn-weights) under [Apache 2.0](public/assets/oidn/LICENSE.txt). The app serves them locally.

The clean raster preview remains visible while preview path tracing accumulates. Realistic export uses a separate WebGPU canvas. The artwork uses RGBA vertex colors because the WebGL path-tracer merger loses RGB colors in a mixed RGB/RGBA scene. Run `node tests/relief-colors.mjs` to check that regression.
