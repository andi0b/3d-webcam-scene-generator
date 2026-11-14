import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

const reflectionDelay = 160;

export function createPipeline(renderer, scene, camera, rasterLights) {
  const previewCube = new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType });
  const exportCube = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const reflectionCamera = new THREE.CubeCamera(.1, camera.far, previewCube);
  reflectionCamera.position.set(-.5, 1.35, -1.35);
  reflectionCamera.coordinateSystem = renderer.coordinateSystem;
  reflectionCamera.updateCoordinateSystem();
  reflectionCamera.updateMatrixWorld();

  const captureBackground = new THREE.Color(0x000000);
  let pmrem = new THREE.PMREMGenerator(renderer);
  let previewEnvironment, exportEnvironment;
  let previewVersion = 0, publishedVersion = -1, exportVersion = -1;
  let face = 0, reflectionRefreshAt = Infinity;
  let preparingEnvironment = false, environmentReady = false, contextGeneration = 0;

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  let pixelRatio = renderer.getPixelRatio();
  let exportSamples;
  composer.addPass(new RenderPass(scene, camera));
  const ao = new SSAOPass(scene, camera, 1, 1, 32);
  ao.kernelRadius = .065;
  ao.minDistance = .00015;
  ao.maxDistance = .003;
  ao.enabled = false;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  const smaa = new SMAAPass();
  smaa.enabled = false;
  composer.addPass(smaa);

  function withRasterLights(render) {
    const disabled = rasterLights.filter(light => !light.visible);
    for (const light of disabled) light.visible = true;
    try {
      return render();
    } finally {
      for (const light of disabled) light.visible = false;
    }
  }

  function withSceneEnvironment(environment, intensity, render) {
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = environment;
    scene.environmentIntensity = intensity;
    try {
      return render();
    } finally {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
    }
  }

  function capture(render) {
    const background = scene.background;
    scene.background = captureBackground;
    try {
      return withRasterLights(() => withSceneEnvironment(null, 0, render));
    } finally {
      scene.background = background;
    }
  }

  function compile(environment = null) {
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(composer.readBuffer);
    try {
      return withRasterLights(() => withSceneEnvironment(environment, 0, () => renderer.compileAsync(scene, camera)));
    } finally {
      renderer.setRenderTarget(previous);
    }
  }

  function captureFace() {
    const previous = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousMip = renderer.getActiveMipmapLevel();
    try {
      renderer.setRenderTarget(previewCube, face);
      capture(() => renderer.render(scene, reflectionCamera.children[face]));
      face++;
    } finally {
      renderer.setRenderTarget(previous, previousFace, previousMip);
    }
  }

  function filterPreview() {
    const version = previewVersion;
    previewEnvironment = pmrem.fromCubemap(previewCube.texture, previewEnvironment);
    if (!environmentReady) {
      const generation = contextGeneration;
      preparingEnvironment = true;
      compile(previewEnvironment.texture).then(() => {
        if (generation !== contextGeneration) return;
        environmentReady = true;
        preparingEnvironment = false;
        if (version === previewVersion) publishedVersion = version;
      }).catch(error => {
        if (generation !== contextGeneration) return;
        preparingEnvironment = false;
        if (version === previewVersion) reflectionRefreshAt = Infinity;
        console.warn('Could not prepare preview reflections', error);
      });
      return;
    }
    publishedVersion = version;
  }

  function captureExport() {
    capture(() => {
      reflectionCamera.renderTarget = exportCube;
      reflectionCamera.update(renderer, scene);
    });
    exportEnvironment = pmrem.fromCubemap(exportCube.texture, exportEnvironment);
    exportVersion = previewVersion;
  }

  function render({ forExport = false } = {}) {
    if (forExport) {
      if (exportSamples === undefined) {
        const gl = renderer.getContext();
        const color = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) ?? [];
        const depth = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES) ?? [];
        exportSamples = Math.max(0, ...color.filter(count => count <= 4 && depth.includes(count)));
      }
      if (exportVersion !== previewVersion) captureExport();
    }
    // Keep the last complete map while the next set of cube faces is captured.
    const environment = forExport ? exportEnvironment : publishedVersion >= 0 ? previewEnvironment : null;
    const samples = forExport ? exportSamples : 0;
    for (const target of [composer.readBuffer, composer.writeBuffer]) {
      if (target.samples === samples) continue;
      target.samples = samples;
      target.dispose();
    }
    withRasterLights(() => withSceneEnvironment(environment?.texture ?? null, environment ? .75 : 0, () => {
      ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
      composer.render();
    }));
  }

  return {
    get guides() {
      return { normal: ao.normalRenderTarget.texture, depth: ao.normalRenderTarget.depthTexture, color: composer.readBuffer.texture };
    },
    get reflectionVersion() { return publishedVersion; },
    compile,
    invalidateReflections({ immediate = false } = {}) {
      previewVersion++;
      face = 0;
      reflectionRefreshAt = immediate ? 0 : performance.now() + reflectionDelay;
    },
    advanceReflections() {
      if (publishedVersion === previewVersion || preparingEnvironment || performance.now() < reflectionRefreshAt) return false;
      if (face < reflectionCamera.children.length) captureFace();
      else filterPreview();
      return true;
    },
    resetReflections() {
      contextGeneration++;
      preparingEnvironment = environmentReady = false;
      publishedVersion = -1;
      previewEnvironment?.dispose();
      exportEnvironment?.dispose();
      previewEnvironment = exportEnvironment = null;
      previewCube.dispose();
      exportCube.dispose();
      pmrem.dispose();
      pmrem = new THREE.PMREMGenerator(renderer);
      this.invalidateReflections();
    },
    setEffects({ ambientOcclusion, antialiasing }) {
      ao.enabled = ambientOcclusion;
      smaa.enabled = antialiasing;
    },
    resize(w, h, ratio) {
      if (pixelRatio !== ratio) {
        pixelRatio = ratio;
        composer.setPixelRatio(ratio);
      }
      composer.setSize(w, h);
    },
    render,
  };
}
