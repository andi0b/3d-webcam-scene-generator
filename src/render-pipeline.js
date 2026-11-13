import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

export function createPipeline(renderer, scene, camera, areaLights) {
  const previewReflections = {
    target: new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType }),
    dirty: true,
    ready: false,
  };
  const exportReflections = {
    target: new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType }),
    dirty: true,
    ready: false,
  };
  const reflectionCamera = new THREE.CubeCamera(.1, camera.far, previewReflections.target);
  reflectionCamera.position.set(-.5, 1.35, -1.35);
  const captureBackground = new THREE.Color(0x000000);
  let reflectionRefreshAt = 0;
  const previewReflectionsDue = () => previewReflections.dirty && performance.now() >= reflectionRefreshAt;
  // Offscreen MSAA requires a sample count supported by both attachments.
  const gl = renderer.getContext();
  const colorSamples = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) ?? [];
  const depthSamples = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES) ?? [];
  const samples = Math.max(0, ...colorSamples.filter(count => count <= 4 && depthSamples.includes(count)));
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new SSAOPass(scene, camera, 512, 512, 32);
  ao.kernelRadius = .065;
  ao.minDistance = .00015;
  ao.maxDistance = .003;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  composer.addPass(new SMAAPass());
  return {
    get guides(){return {normal:ao.normalRenderTarget.texture,depth:ao.normalRenderTarget.depthTexture,color:composer.readBuffer.texture};},
    get previewReflectionsDue() { return previewReflectionsDue(); },
    invalidateReflections({ immediate = false } = {}) {
      previewReflections.dirty = exportReflections.dirty = true;
      reflectionRefreshAt = immediate ? 0 : performance.now() + 160;
    },
    resize(w, h, ratio) { composer.setPixelRatio(ratio); composer.setSize(w, h); },
    render({ forExport = false } = {}) {
      const { environment, environmentIntensity } = scene;
      const reflections = forExport ? exportReflections : previewReflections;
      // Zero-intensity area lights preserve the preview shader layout between toggles.
      const disabledLights = forExport ? [] : areaLights.filter(light => !light.visible);
      for (const light of disabledLights) light.visible = true;
      try {
        if (reflections.dirty && (forExport || previewReflectionsDue())) {
          const background = scene.background;
          // Capture direct lighting once. Three.js filters the cubemap for each material's roughness.
          scene.environment = null;
          scene.background = captureBackground;
          try {
            reflectionCamera.renderTarget = reflections.target;
            reflectionCamera.update(renderer, scene);
            reflections.dirty = false;
            reflections.ready = true;
          } finally {
            scene.background = background;
          }
        }
        scene.environment = reflections.ready ? reflections.target.texture : null;
        // Avoid showing light from the previous settings while the preview capture is pending.
        scene.environmentIntensity = reflections.dirty ? 0 : .75;
        // SSAO caches projection uniforms; keep them current for the FOV slider.
        ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
        ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
        composer.render();
      } finally {
        for (const light of disabledLights) light.visible = false;
        scene.environment = environment;
        scene.environmentIntensity = environmentIntensity;
      }
    },
  };
}
