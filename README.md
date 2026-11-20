# Roomlight Studio

A browser-based Three.js studio for composing still-image backgrounds for video calls. The room, furnishings, and lighting are rendered in 3D. The window views use generated photographic backdrops.

[Open Roomlight Studio](https://andi0b.github.io/3d-webcam-scene-generator/)

## Compose a background

1. Choose a city, forest, or mountain view and set the weather and room lighting.
2. Adjust the camera position, angle, and field of view. Use the person guide to frame yourself in the scene.
3. In Decoration, drop an image on a picture or the rollup to apply it, or drop images on the library to save them for later. You can also choose **Upload and use** in an artwork picker. Images are centered and cropped to fit.
4. Save a camera angle or decoration look if you want to reuse it. Load, update, or delete it from its card. The app opens with its shipped settings until you load a saved setup.
5. Export a PNG at 1920 × 1080, 1280 × 720, or 854 × 480 and import it as a virtual background in your meeting app. The person guide is excluded from the export.

Saved setups and uploaded images are stored in this browser on this device. Images larger than 2048 pixels on their longest side are resized when added. Clearing site data removes the local library and profiles.

Fast preview uses WebGL. Realistic preview traces eight samples with three light bounces at 55% of the viewport width and height on WebGPU, then runs Open Image Denoise. If WebGPU cannot initialize, the preview uses WebGL at 45% resolution with guided filtering. Camera and lighting changes show the fast preview immediately and restart tracing after a 200 ms pause.

PNG export always uses realistic lighting in either preview mode and requires a WebGPU-capable browser on HTTPS or localhost. It traces at the selected resolution and runs Open Image Denoise with albedo and normal data. Quick uses 10 samples and four bounces, Detailed uses 48 samples and six bounces, and Maximum uses 96 samples and eight bounces. You can cancel during rendering or denoising.

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

Start Vite with `npm run dev` and open `/tools/prepare-textures.html` on the development URL. The tool processes the source in your browser. Keep originals and intermediate files in `tools/source-assets/`. Put the files used by the app in `public/assets/`, which Vite copies into the published site.

- **Surface normal map** samples the source image’s green channel at half resolution. It uses wrapped gradients with a strength of 1.3 and writes a tangent-space PNG. Encode it as lossless WebP and publish it as `<source-stem>-normal.webp` beside its color image. The room loader treats color images as sRGB and normal maps as linear data. The material’s `normalScale` controls the strength of the finish.
- **WebP color image** preserves the source dimensions and encodes at quality 0.92. Use this for backdrops, surface colors, and artwork when it produces a perceptibly equivalent image with a useful size reduction.
- **Procedural furniture oak** regenerates the original room’s seeded grain and its normal map. The normal map uses the color texture’s red channel at full resolution. Both PNGs are archived in `tools/source-assets/`.

For example, with FFmpeg's libwebp encoder, regenerate the oak normal map without changing its pixel values.

```sh
ffmpeg -i tools/source-assets/oak-normal.png -c:v libwebp -lossless 1 -pix_fmt bgra -compression_level 6 public/assets/oak-normal.webp
```

## Deployment

Every push to `main` triggers the [GitHub Pages workflow](.github/workflows/pages.yml). It installs locked dependencies, builds the site with the GitHub Pages project path, and publishes `dist/`. To deploy manually, run **Deploy to GitHub Pages** from the repository’s Actions tab with `main` selected.

## Denoising weights

The app serves the two bundled [Intel Open Image Denoise weights](https://github.com/RenderKit/oidn-weights) from the [path tracer’s denoising example](https://github.com/gkjohnson/three-gpu-pathtracer/blob/v0.0.28/example/denoise.js) under the [Apache 2.0 license](public/assets/oidn/LICENSE.txt).

### Debug camera

In development, append `?debugCamera=x,y,z,targetX,targetY,targetZ` to the URL to position the camera and aim it at a point in room coordinates. For example, `?debugCamera=-0.5,2,1.6,2.85,1.1,-1.0` looks toward the sideboard. Remove the query parameter and reload to restore normal camera controls. Camera, light, and decoration settings are kept across component hot reloads but are reset on a normal page reload.

Useful inspection views:

- Sideboard front: `?debugCamera=0.1,1.4,-0.8,2.84,0.7,-0.8`
- Sideboard and corner from above: `?debugCamera=1.1,3,1.5,2.8,0.8,-1.0`
- Room-facing oblique: `?debugCamera=-0.5,2,1.6,2.85,1.1,-1.0`
