import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createReadingChair } from '../src/scene/models/reading-chair.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#f8f8f6');
const chair = createReadingChair();
scene.add(chair);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshStandardMaterial({color:'#f8f8f6',roughness:1}));
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);
scene.add(new THREE.HemisphereLight('#ffffff','#b8ae9f',2));
const light = new THREE.DirectionalLight('#fff9ec',3); light.position.set(-3,5,4); light.castShadow=true;
light.shadow.mapSize.set(2048,2048); light.shadow.camera.left=-2; light.shadow.camera.right=2; light.shadow.camera.top=2; light.shadow.camera.bottom=-2;
light.shadow.normalBias=.003; light.shadow.radius=5; scene.add(light);
const fill = new THREE.DirectionalLight('#f3f3f2',1.5); fill.position.set(4,3,-2); scene.add(fill);
const camera = new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.1,100);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0,.47,-.04);
const views = { front:[1.02,1.02,2.8], rear:[-1.45,1.08,-2.55], side:[2.72,.86,0] };
function setView(name) { camera.position.set(...views[name]); controls.update(); }
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
setView(new URLSearchParams(location.search).get('view') in views ? new URLSearchParams(location.search).get('view') : 'front');
let tracer, realistic=false, initializing=false;
const status=document.querySelector('#status'), lighting=document.querySelector('#lighting');
controls.addEventListener('change',()=>{if(tracer && realistic){tracer.updateCamera();tracer.reset();}});
lighting.onclick=async()=>{
  if(initializing)return;
  realistic=!realistic; lighting.setAttribute('aria-pressed',String(realistic));
  lighting.textContent=realistic?'Fast lighting':'Realistic lighting';
  if(!realistic){light.intensity=3;fill.intensity=1.5;scene.environmentIntensity=1;status.textContent='';return;}
  light.intensity=.5; fill.intensity=.5; scene.environmentIntensity=.75;
  if(tracer){tracer.updateLights();tracer.updateEnvironment();tracer.updateCamera();tracer.reset();return;}
  initializing=true; status.textContent='Preparing…';
  try {
    const {WebGLPathTracer,GradientEquirectTexture}=await import('three-gpu-pathtracer');
    const sky=new GradientEquirectTexture(128); sky.topColor.set('#edf2f5'); sky.bottomColor.set('#d6d0c3'); sky.update();
    scene.environment=sky; tracer=new WebGLPathTracer(renderer);
    tracer.renderScale=.7/renderer.getPixelRatio(); tracer.bounces=3; tracer.tiles.set(2,2);
    tracer.setScene(scene,camera); tracer.reset();
  } catch(error) {
    console.error(error); realistic=false; light.intensity=3; fill.intensity=1.5; scene.environmentIntensity=1; lighting.setAttribute('aria-pressed','false');
    lighting.textContent='Realistic lighting'; status.textContent='Realistic lighting unavailable';
  } finally {initializing=false;}
};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);if(tracer){tracer.updateCamera();tracer.reset();}});
renderer.setAnimationLoop(()=>{
  if(realistic && tracer && !initializing){
    if(tracer.samples<48){tracer.renderSample();status.textContent=`Refining ${Math.floor(tracer.samples)} / 48`;}
    else status.textContent='Ready';
  } else renderer.render(scene,camera);
});
