import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Depth, normals and the clean preview help keep the filter on the same surface.
export function createGuidedDenoiser(renderer, preview, camera) {
  const targets = [0,1].map(() => new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false}));
  const material = new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,
    uniforms:{inputMap:{value:null},normalMap:{value:null},depthMap:{value:null},guideMap:{value:null},pixel:{value:new THREE.Vector2()},stepSize:{value:1},near:{value:.1},far:{value:30},preserveEdges:{value:false}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      varying vec2 vUv;
      uniform sampler2D inputMap,normalMap,depthMap,guideMap;
      uniform vec2 pixel;
      uniform float stepSize,near,far;
      uniform bool preserveEdges;
      float distanceAt(vec2 uv){float d=texture2D(depthMap,uv).r;return near*far/(far-d*(far-near));}
      void main(){
        vec3 normal=normalize(texture2D(normalMap,vUv).xyz*2.-1.);
        vec3 guide=texture2D(guideMap,vUv).rgb;
        float depth=distanceAt(vUv),total=0.;vec3 sum=vec3(0.);
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
          vec2 uv=clamp(vUv+vec2(float(x),float(y))*pixel*stepSize,pixel*.5,1.-pixel*.5);
          vec3 n=normalize(texture2D(normalMap,uv).xyz*2.-1.);
          vec3 difference=texture2D(guideMap,uv).rgb-guide;
          float w=(x==0?2.:1.)*(y==0?2.:1.);
          w*=pow(max(dot(normal,n),0.),32.);
          w*=exp(-abs(distanceAt(uv)-depth)/(.012+.008*stepSize));
          w*=exp(-dot(difference,difference)/(preserveEdges ? .006 : .025));
          sum+=texture2D(inputMap,uv).rgb*w;total+=w;
        }
        vec3 filtered=sum/max(total,.00001);
        if(preserveEdges){
          // A raster guide sees one surface at the pixel center. Keep more of the
          // tracer's subpixel coverage where neighboring guide samples disagree.
          float confidence=smoothstep(4.,14.,total);
          filtered=mix(texture2D(inputMap,vUv).rgb,filtered,confidence);
        }
        gl_FragColor=vec4(filtered,1.);
      }`,
  });
  const filter=new FullScreenQuad(material);
  const output=new FullScreenQuad(new THREE.MeshBasicMaterial({depthTest:false,depthWrite:false}));
  return {
    dispose() {
      for (const target of targets) target.dispose();
      material.dispose();
      output.material.dispose();
      filter.dispose();
      output.dispose();
    },
    render(texture,width,height,{passes=5,preserveEdges=false}={}) {
      const previous=renderer.getRenderTarget();
      try{
        let input=texture;
        if(passes>0){
          // Refresh the guides at the current camera/export size.
          preview.render();
          const guides=preview.guides;
          const u=material.uniforms;u.normalMap.value=guides.normal;u.depthMap.value=guides.depth;u.guideMap.value=guides.color;
          u.near.value=camera.near;u.far.value=camera.far;u.pixel.value.set(1/width,1/height);
          u.preserveEdges.value=preserveEdges;
          for(const target of targets) if(target.width!==width||target.height!==height)target.setSize(width,height);
          for(let i=0;i<passes;i++){
            const target=targets[i%2];u.inputMap.value=input;u.stepSize.value=2**i;
            renderer.setRenderTarget(target);filter.render(renderer);input=target.texture;
          }
        }
        renderer.setRenderTarget(null);output.material.map=input;output.render(renderer);
      }finally{renderer.setRenderTarget(previous);}
    },
  };
}
