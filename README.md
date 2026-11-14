# Roomlight Studio

A browser-based Three.js studio for composing still-image backgrounds for video calls. The room, furnishings, and lighting are rendered in 3D. The window views use generated photographic backdrops.

[Open Roomlight Studio](https://andi0b.github.io/3d-webcam-scene-generator/)

## Compose a background

1. Choose a city, forest, or mountain view and set the weather and room lighting.
2. Adjust the camera position, angle, and field of view. Use the person guide to frame yourself in the scene.
3. Export a PNG at 1920 × 1080, 1280 × 720, or 854 × 480 and import it as a virtual background in your meeting app. The person guide is excluded from the export.

Fast preview and export use WebGL. Realistic preview traces eight samples with three light bounces at 55% of the viewport width and height on WebGPU, then runs Open Image Denoise. If WebGPU cannot initialize, the preview uses WebGL at 45% resolution with guided filtering. Camera and lighting changes show the fast preview immediately and restart tracing after a 200 ms pause.

Realistic PNG export requires a WebGPU-capable browser on HTTPS or localhost. It traces at the selected resolution and runs Open Image Denoise with albedo and normal data. Quick uses 10 samples and four bounces, Detailed uses 48 samples and six bounces, and Maximum uses 96 samples and eight bounces. You can cancel during rendering or denoising.

## Run locally

Use Node.js 24, the version used by the deployment workflow.

```sh
npm ci
npm run dev
```

Open the HTTPS URL printed by Vite, usually `https://127.0.0.1:5173`. The development server uses a self-signed certificate, so your browser may show a warning on the first visit.

```sh
npm run build
npm run preview
```

`npm run build` creates the static site in `dist/`. Run `node tests/chair-dimensions.mjs` and `node tests/relief-colors.mjs` to check the chair geometry and relief colors.

## Prepare textures

Start Vite with `npm run dev` and open `/tools/prepare-textures.html` on the development URL. Choose an output and download the result into `public/assets/`. The tool processes the source in your browser.

- **Surface normal map** samples the source image’s green channel at half resolution. It uses wrapped gradients with a strength of 1.3 and writes a tangent-space PNG named `<source-stem>-normal.png`. Keep that filename alongside the color image. The room loader treats color images as sRGB and normal maps as linear data. The material’s `normalScale` controls how strongly the finish shows in the room.
- **WebP backdrop** preserves the source dimensions and encodes at quality 0.92. The three window views use `city.webp`, `forest.webp`, and `mountains.webp`. Keep the PNGs as source images if you need to regenerate the WebPs.
- **Procedural furniture oak** regenerates `furniture-oak.png` and `furniture-oak-normal.png` using the seeded grain from the original room. The normal map uses the color texture’s red channel at full resolution. The room repeats both maps.

## Deployment

Every push to `main` triggers the [GitHub Pages workflow](.github/workflows/pages.yml). It installs locked dependencies, builds the site with the GitHub Pages project path, and publishes `dist/`. To deploy manually, run **Deploy to GitHub Pages** from the repository’s Actions tab with `main` selected.

## Denoising weights

The app serves the two bundled [Intel Open Image Denoise weights](https://github.com/RenderKit/oidn-weights) from the [path tracer’s denoising example](https://github.com/gkjohnson/three-gpu-pathtracer/blob/v0.0.28/example/denoise.js) under the [Apache 2.0 license](public/assets/oidn/LICENSE.txt).
