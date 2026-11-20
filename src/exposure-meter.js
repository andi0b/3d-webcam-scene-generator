import { ShaderMaterial, Vector2, WebGLRenderTarget } from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { exposureMultiplier } from './exposure.js';

const meterWidth = 32;
const meterHeight = 18;
const minimumLogLuminance = -12;
const logLuminanceRange = 28;

export function estimateExposureEV(pixels, width = meterWidth, height = meterHeight) {
  const histogram = new Uint32Array(256);
  let totalWeight = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // WebGL readback rows start at the bottom of the frame.
      const inUpperRight = (x + .5) / width + (y + .5) / height > 1;
      const weight = inUpperRight ? 4 : 1;
      histogram[pixels[(y * width + x) * 4]] += weight;
      totalWeight += weight;
    }
  }
  let cumulativeWeight = 0;
  let medianBin;
  for (let bin = 0; bin < histogram.length; bin++) {
    cumulativeWeight += histogram[bin];
    if (medianBin === undefined && cumulativeWeight >= totalWeight * .5) medianBin = bin;
    if (cumulativeWeight >= totalWeight * .9) {
      const midtone = minimumLogLuminance + medianBin / 255 * logLuminanceRange;
      const highlight = minimumLogLuminance + bin / 255 * logLuminanceRange;
      const target = Math.min(Math.log2(.18 / exposureMultiplier()) - midtone, Math.log2(1.2 / exposureMultiplier()) - highlight);
      return Math.min(.5, target);
    }
  }
}

export class ExposureMeter extends Pass {
  constructor() {
    super();
    this.enabled = false;
    this.needsSwap = false;
    this.target = new WebGLRenderTarget(meterWidth, meterHeight, { depthBuffer: false });
    this.quad = new FullScreenQuad(new ShaderMaterial({
      uniforms: {
        source: { value: null },
        offset: { value: new Vector2(.25 / meterWidth, .25 / meterHeight) },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D source;
        uniform vec2 offset;
        varying vec2 vUv;
        void main() {
          vec3 color = (
            texture2D(source, vUv - offset).rgb +
            texture2D(source, vUv + offset).rgb +
            texture2D(source, vUv + vec2(offset.x, -offset.y)).rgb +
            texture2D(source, vUv + vec2(-offset.x, offset.y)).rgb
          ) * 0.25;
          float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
          float logLuminance = log2(max(luminance, exp2(${minimumLogLuminance}.0)));
          float encoded = (logLuminance - (${minimumLogLuminance}.0)) / ${logLuminanceRange}.0;
          gl_FragColor = vec4(encoded, 0.0, 0.0, 1.0);
        }
      `,
    }));
  }

  render(renderer, _writeBuffer, readBuffer) {
    const previous = renderer.getRenderTarget();
    this.quad.material.uniforms.source.value = readBuffer.texture;
    renderer.setRenderTarget(this.target);
    try {
      this.quad.render(renderer);
      const pixels = new Uint8Array(meterWidth * meterHeight * 4);
      this.reading = renderer.readRenderTargetPixelsAsync(this.target, 0, 0, meterWidth, meterHeight, pixels)
        .then(pixels => estimateExposureEV(pixels));
    } finally {
      renderer.setRenderTarget(previous);
    }
  }

  dispose() {
    this.quad.material.dispose();
    this.quad.dispose();
    this.target.dispose();
  }
}
