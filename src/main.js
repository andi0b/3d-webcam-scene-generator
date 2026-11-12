import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import './style.css';
import { createPhotoreal } from './photoreal.js';
import { book, deskDetails, readingChair } from './details.js';
import { addPlant, addRelief, createPipeline, surfaceNoise, oakTexture } from './realism.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();

const app = document.querySelector('#app');
app.innerHTML = `<header><div class="brand"><span class="brand-icon">◧</span><div><strong>roomlight</strong><small>BACKGROUND STUDIO</small></div></div><div class="header-note"><span></span> YOUR CREATIVE SPACE</div></header><main><aside><div class="intro"><div class="eyebrow">MAKE YOURSELF AT HOME</div><h1>A little more<br><em>you,</em> on every call.</h1><p>Design a space that feels just right, then take it to your next meeting.</p></div><div class="section"><div class="section-title"><span>01</span><h2>Outside your window</h2></div><div class="choices" id="views"><button class="choice active" data-view="city"><i>▥</i><b>City</b><small>Buildings & trees</small></button><button class="choice" data-view="forest"><i>♧</i><b>Forest</b><small>Quiet greenery</small></button><button class="choice" data-view="mountains"><i>⌁</i><b>Mountains</b><small>Room to breathe</small></button></div></div><div class="section"><div class="section-title"><span>02</span><h2>Set the mood</h2></div><div class="presets"><button data-preset="day" class="active">☀ &nbsp;Daylight</button><button data-preset="golden">◒ &nbsp;Golden hour</button><button data-preset="night">☾ &nbsp;After hours</button></div><div class="light-list"><label><span><b>Outside light</b><small>Sunlight through the window</small></span><input type="checkbox" id="outside" checked><i></i></label><label><span><b>Desk lamp</b><small>A warm pool of light</small></span><input type="checkbox" id="desk" checked><i></i></label><label><span><b>Shelf light</b><small>A little extra glow</small></span><input type="checkbox" id="shelf" checked><i></i></label><label><span><b>Off-camera fill</b><small>Soft light from behind you</small></span><input type="checkbox" id="fill" checked><i></i></label></div></div><div class="section camera"><div class="section-title"><span>03</span><h2>Find your angle</h2><button id="reset">Reset</button></div><p class="camera-help">Match your real webcam: move the camera, then adjust where it points.</p><label>Camera left / right <input id="horizontal" type="range" min="-1" max="1" step="0.01" value="0"></label><label>Camera height <input id="height" type="range" min="-0.45" max="0.45" step="0.01" value="0"></label><label>Look up / down <input id="tilt" type="range" min="-0.6" max="0.6" step="0.01" value="0"></label><label>Field of view <input id="zoom" type="range" min="36" max="58" step="1" value="48"></label><label class="guide-toggle"><span>Show person guide <small>For framing only · excluded from export</small></span><input type="checkbox" id="guide" checked></label></div><div class="aside-footer">MADE FOR YOUR NEXT GOOD CONVERSATION <span>✳</span></div></aside><section class="workspace"><div class="workspace-top"><div><div class="eyebrow">YOUR SPACE, YOUR WAY</div><h2>The preview <span>✳</span></h2></div><div class="live"><i></i> LIVE 3D PREVIEW</div></div><div class="preview-wrap"><div class="canvas-wrap"><div id="viewport"></div><div id="person-guide" aria-hidden="true"><div class="guide-head"></div><div class="guide-body"></div><span>YOUR POSITION</span></div></div><div class="preview-label"><span>01 / THE HOME OFFICE</span><span>16:9 &nbsp; · &nbsp; 3D SCENE</span></div></div><div class="workspace-bottom"><div><strong>Looking good?</strong><p>Export your scene and add it as a virtual background in your meeting app.</p></div><button id="export">Export background <span>↗</span></button></div><div class="tip"><span>✧</span><p><strong>A little tip</strong> &nbsp; Leave some breathing room in the center for you. Your exported image won’t include the preview controls.</p></div><div class="workspace-foot"><span>ROOMLIGHT STUDIO &nbsp; / &nbsp; V 0.1</span><span>DESIGNED FOR REAL CONVERSATIONS</span></div></section></main>`;

document.querySelector('.light-list').insertAdjacentHTML('afterbegin', `
  <label class="ceiling-control">
    <b>Ceiling light</b>
    <select id="ceiling-light">
      <option value="off">Off</option>
      <option value="low" selected>Low · 2900 K</option>
      <option value="high">High · 4000 K</option>
    </select>
  </label>`);
const ceilingControl = document.querySelector('#ceiling-light');

const quality = document.createElement('div');quality.className='render-quality';
quality.innerHTML='<div role="group" aria-label="Render quality"><button id="quality-fast" aria-pressed="true">Fast preview</button><button id="quality-real" aria-pressed="false">Realistic lighting</button></div><label class="export-quality">Export quality <select id="export-quality"><option value="quick">Quick · recommended</option><option value="detailed">Detailed</option><option value="maximum">Maximum · slow</option></select></label><span id="render-status" role="status">Fast preview</span><button id="cancel-render" hidden>Cancel export</button>';
document.querySelector('.preview-wrap').after(quality);
const viewport = document.querySelector('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 1.5), 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; viewport.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#c4aa91');
const camera = new THREE.PerspectiveCamera(43, 16 / 9, .1, 30);
const mat = (color, roughness=1, metalness=0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
const textureLoader = new THREE.TextureLoader();
function loadSurface(url, repeat=2){const t=textureLoader.load(url);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;}
const wall=mat('#ffffff'), wood=mat('#ffffff'), dark=mat('#34322c'), cream=mat('#e0d1ba'), green=mat('#53663b'), gold=mat('#ac8657',.5,.4);wall.color.set('#e1d7c9');wall.bumpMap=surfaceNoise();wall.bumpScale=.002;wood.map=oakTexture();wood.map.anisotropy=renderer.capabilities.getMaxAnisotropy();wood.color.set('#ffffff');wood.roughness=.42;wood.bumpMap=wood.map;wood.bumpScale=.0015;
function box(w,h,d,m,x,y,z, shadow=true){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;scene.add(o);return o;}
function roundedBox(w,h,d,r,m,x,y,z){const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,5,r),m);if(m===wood){const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;for(let i=0;i<p.count;i++){const along=w>h&&w>d?p.getX(i):h>d?p.getY(i):p.getZ(i);const across=w>h&&w>d?p.getZ(i):p.getX(i);uv.setXY(i,across*3,along*.65);}uv.needsUpdate=true;}mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;}
function sphere(r,m,x,y,z){const o=new THREE.Mesh(new THREE.SphereGeometry(r,32,24),m);o.position.set(x,y,z);o.castShadow=true;scene.add(o);return o;}
function cylinder(rt,rb,h,m,x,y,z){const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,48),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
// A complete back wall meets a left wall with a deep, side-facing window opening.
box(7.3,3.95,.18,wall,.4,1.975,-3);
box(7.3,.12,6,mat('#eee8df'),.4,4.01,0);
box(.18,3.95,6,wall,3.65,1.975,0);
box(.18,3.95,.5,wall,-3.25,1.975,-2.75);
box(.18,3.95,3.3,wall,-3.25,1.975,1.35);
box(.18,.72,2.2,wall,-3.25,.36,-1.4);
box(.18,.90,2.2,wall,-3.25,3.50,-1.4);
// Narrow oak planks with staggered joints, bevel-like gaps and varying grain.
// A solid backing keeps the recessed joints from exposing the environment below the room.
box(7.3,.09,6.18,mat('#967955',.76),.4,-.0665,0);
const floorColors=['#e3d7c4','#e8dccb','#dfd3c0','#e6d9c7','#e1d4bf']; const floorMaterials=floorColors.map((color,i)=>{const m=mat(color,.44);m.map=oakTexture(40+i*17);m.map.anisotropy=renderer.capabilities.getMaxAnisotropy();m.bumpMap=m.map;m.bumpScale=.001;return m;});
for(let row=0;row<25;row++){const x=-3.24+row*.285;let z=-3;let segment=row%2?.72:1.42;let part=0;while(z<3){let len=Math.min(segment,3-z);box(.283,.065,len-.002,floorMaterials[(row*7+part*3)%floorMaterials.length],x,-.05,z+len/2,false);z+=len;segment=1.42;part++;}}
box(7.3,.14,.09,cream,.4,.05,-2.87);box(.09,.14,5.9,cream,-3.12,.05,0);
// Layered oak window lining, dark gasket, inset sash and slender glazing beads.
const frameDark=mat('#57483c',.85), sashWood=wood.clone(), hardware=mat('#4b4b46',.32,.72);
roundedBox(.31,.075,2.30,.018,wood,-3.18,.755,-1.4);roundedBox(.31,.075,2.30,.018,wood,-3.18,3.005,-1.4);
roundedBox(.31,2.27,.075,.018,wood,-3.18,1.88,-2.5);roundedBox(.31,2.27,.075,.018,wood,-3.18,1.88,-.3);
// Thin gasket separates the glazed panels from their wooden surround.
box(.035,.055,2.13,frameDark,-3.28,.82,-1.4);box(.035,.055,2.13,frameDark,-3.28,2.94,-1.4);
box(.035,2.15,.055,frameDark,-3.28,1.88,-2.46);box(.035,2.15,.055,frameDark,-3.28,1.88,-.34);
box(.10,.065,2.08,sashWood,-3.20,.86,-1.4);box(.10,.065,2.08,sashWood,-3.20,2.90,-1.4);
box(.10,2.08,.065,sashWood,-3.20,1.88,-2.42);box(.10,2.08,.065,sashWood,-3.20,1.88,-.38);
roundedBox(.13,2.08,.085,.009,sashWood,-3.18,1.88,-1.4);
// Deep plaster reveals and small hinges give the window construction depth.
box(.22,2.24,.035,wall,-3.27,1.88,-2.52);box(.22,2.24,.035,wall,-3.27,1.88,-.28);box(.22,.035,2.24,wall,-3.27,3.02,-1.4);
for(const z of [-2.40,-.40]){cylinder(.018,.018,.09,hardware,-3.10,1.12,z);cylinder(.018,.018,.09,hardware,-3.10,2.65,z);}
// Transparent glass is intentionally subtle so the exterior photograph stays visible.
const glass=new THREE.Mesh(new THREE.PlaneGeometry(2.03,2.02),new THREE.MeshPhysicalMaterial({color:'#d8e1df',transparent:true,opacity:.035,roughness:.06,metalness:0,envMapIntensity:.5,side:THREE.DoubleSide,depthWrite:false}));glass.rotation.y=Math.PI/2;glass.position.set(-3.24,1.88,-1.4);scene.add(glass);
roundedBox(.64,.065,2.48,.025,wood,-3.02,.715,-1.4);box(.025,.025,2.43,sashWood,-2.69,.67,-1.4);
// Separate glazing beads and elastomer seals sit just inside each sash.
for(const center of [-1.94,-.86]) {
 for(const edge of [-1,1]) {
  box(.018,1.97,.012,frameDark,-3.125,1.88,center+edge*.49);
  box(.02,.012,.98,frameDark,-3.125,1.88+edge*.985,center);
 }
}
// Small metal handle on the inside face of the sash.
roundedBox(.025,.17,.055,.009,hardware,-3.11,1.65,-1.45);roundedBox(.045,.19,.022,.008,hardware,-3.065,1.73,-1.45);
// A short horizontal grip, spindle and mounting screws complete the handle.
roundedBox(.065,.025,.115,.01,hardware,-3.055,1.80,-1.405);
for(const y of [1.59,1.71]){const screw=sphere(.006,hardware,-3.091,y,-1.45);screw.scale.x=.4;}
// A background beyond the side window; room, opening and camera remain 3D.
const backdropMat = new THREE.MeshStandardMaterial({color:'#000000',emissive:'#ffffff',emissiveIntensity:1,roughness:1}); const backdrop=box(7,4,.03,backdropMat,-4.2,2,-1.4,false); backdrop.rotation.y=Math.PI/2;
const outsideImages = Object.fromEntries(['city','forest','mountains'].map(name=>{const texture=textureLoader.load('/assets/'+name+'.png');texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return [name,texture];}));
let view='city', mood='day'; function updateBackdrop(reflectedWindowIntensity){backdropMat.emissiveMap=outsideImages[view];backdropMat.emissive.set(mood==='night'?'#424c6a':mood==='golden'?'#ffd5ad':'#ffffff');backdropMat.needsUpdate=true;pipeline.invalidateReflections(reflectedWindowIntensity);}
// Shelving, books, and planters
roundedBox(1.65,.065,.34,.014,wood,-2.04,2.765,-2.74);roundedBox(.98,.065,.30,.014,wood,-1.95,1.865,-2.76);
// Shallow shadow gaps read as floating shelf mounting rather than solid slabs.
box(1.52,.018,.025,frameDark,-2.04,2.72,-2.89);box(.86,.018,.025,frameDark,-1.95,1.82,-2.89);
// Books have individual covers, page blocks and subtle spine details.
const bookTones=['#514943','#d1c4af','#71675a','#a69986','#3f423c','#b4aa98','#777269','#d8cbb7'];
['Botanical Living','Architecture','Quiet Spaces','The Modern Home','Collected Works'].forEach((title,i)=>book(scene,{x:-2.12+i*.145,y:2.8,z:-2.7,width:.12,height:.36+(i%3)*.037,color:bookTones[i],title,lean:i===4?-.08:0}));
// Dense, curved pothos with veined blades and naturally hanging stems.
addPlant(scene,-2.57,2.8,-2.70,.72,true);
const windowPlant = addPlant(scene, -2.87, .754, -1.25, .8, true, { overhang: .10 });
windowPlant.rotation.y = Math.PI / 2;
addPlant(scene,-1.92,1.9,-2.72,.58,false);
// Slim oak frame and tactile mountain relief, balanced to the right of the person.
roundedBox(2.40,1.28,.055,.009,wood,1.40,1.99,-2.855);
box(2.32,1.20,.025,dark,1.40,1.99,-2.818);
addRelief(scene,1.40,1.99,-2.80,2.28,1.16);
// Desk and lamp
// Rounded top and inset tapered-looking legs keep the desk visually light.
roundedBox(2.3,.095,1.02,.045,mat('#e0d1ba',.53),2.45,.87,-1.95);
const deskLeg=mat('#9b795b',.78);for(const x of [1.48,3.35])for(const z of [-2.30,-1.60]){const leg=roundedBox(.065,.82,.065,.018,deskLeg,x,.41,z);leg.rotation.z=x<2?-0.025:0.025;}
roundedBox(2.0,.10,.055,.012,deskLeg,2.42,.77,-2.34);
for(let i=0;i<3;i++)book(scene,{x:1.78+(i%2)*.035,y:.92+i*.048,z:-2.1+(i%2)*.035,width:.048,height:.53,depth:.34,color:['#51463a','#a89a81','#ddd0b8'][i],title:['STUDIO','FORM & SPACE','NOTES'][i],flat:true});
deskDetails(scene,wood,dark,hardware);
// Articulated metal task lamp: base, two arms, joints and a tapered shade.
function rodBetween(a,b,r,material){const direction=new THREE.Vector3().subVectors(b,a);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,direction.length(),12),material);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());mesh.castShadow=true;scene.add(mesh);return mesh;}
cylinder(.2,.22,.045,dark,3.04,.96,-2.1);const joint1=new THREE.Vector3(3.04,1,-2.1),joint2=new THREE.Vector3(2.8,1.43,-2.1),joint3=new THREE.Vector3(3.05,1.76,-2.1);rodBetween(joint1,joint2,.018,dark);rodBetween(joint2,joint3,.018,dark);[joint1,joint2,joint3].forEach(p=>sphere(.045,dark,p.x,p.y,p.z));
const shade=new THREE.Mesh(new THREE.CylinderGeometry(.09,.2,.28,48,1,true),new THREE.MeshStandardMaterial({color:'#252522',roughness:.35,metalness:.65,side:THREE.DoubleSide}));shade.position.set(3.11,1.7,-2.1);shade.rotation.z=-.45;shade.castShadow=true;scene.add(shade);const bulb=sphere(.075,new THREE.MeshStandardMaterial({color:'#fff0d8',emissive:'#ffe0a4',emissiveIntensity:1.5}),3.17,1.58,-2.1);
const globe=sphere(.13,new THREE.MeshStandardMaterial({color:'#fff0d8',emissive:'#ffdc9b',emissiveIntensity:1.5,roughness:.35}),-1.38,2.94,-2.64);globe.castShadow=false;bulb.castShadow=false;globe.material.castShadow=false;bulb.material.castShadow=false;cylinder(.1,.11,.09,dark,-1.38,2.82,-2.64);
const chair = readingChair(scene, wood);
chair.scale.multiplyScalar(1.38);
// The runners start above the model origin; lower them onto the floorboards.
chair.position.set(-1.69, -.0515, -1.74);
chair.rotation.y = .40;
// A flush opal diffuser and a wide ceiling light for the whole room.
const ceilingX = -.45, ceilingZ = -1.22;
cylinder(.30,.30,.10,mat('#c8c5bb',.55,.25),ceilingX,3.90,ceilingZ);
const ceilingDiffuser = mat('#eeeae1',.75);
cylinder(.278,.263,.055,ceilingDiffuser,ceilingX,3.8275,ceilingZ);
const ceilingLight = new THREE.SpotLight('#ffffff',0,0,Math.PI * .46,.70,2);
ceilingLight.position.set(ceilingX,3.78,ceilingZ);
ceilingLight.target.position.set(ceilingX,0,ceilingZ);
ceilingLight.castShadow = true;
ceilingLight.shadow.mapSize.set(1024,1024);
ceilingLight.shadow.camera.far = 10;
ceilingLight.shadow.bias = -.00015;
ceilingLight.shadow.normalBias = .006;
ceilingLight.shadow.radius = 3;
ceilingLight.shadow.autoUpdate = false;
ceilingLight.shadow.needsUpdate = true;
// A diffuse contribution stands in for light bouncing into the corners in the live renderer.
const ceilingBounce = new THREE.AmbientLight('#ffffff',0);
scene.add(ceilingLight,ceilingLight.target,ceilingBounce);
// Approximate the two color temperatures in sRGB, with separate output levels.
const ceilingModes = {
  off: { color:'#ffffff', intensity:0, bounce:0, glow:0 },
  low: { color:'#ffb367', intensity:12, bounce:.18, glow:.8 },
  high: { color:'#ffd3a6', intensity:31, bounce:.40, glow:2.4 },
};

// Daylight and the ceiling fixture provide room light; desk and shelf lamps add accents.
const ambient=new THREE.HemisphereLight('#e3ebf5','#a99d8d',.55);scene.add(ambient);
const sun=new THREE.DirectionalLight('#fff0d8',2.6);sun.position.set(-6,4.5,.4);sun.target.position.set(.5,1.1,-2.8);scene.add(sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.camera.near=.5;sun.shadow.camera.far=16;sun.shadow.bias=-.00015;sun.shadow.normalBias=.006;sun.shadow.radius=2.5;scene.add(sun);
const sunSamples=[sun];
const windowFill=new THREE.RectAreaLight('#e5edff',1.8,1.9,2);windowFill.position.set(-3.0,1.9,-1.4);windowFill.lookAt(1,1.5,-2);scene.add(windowFill);
const deskLight=new THREE.SpotLight('#ffcf95',5,4,Math.PI/3,.8,2);deskLight.position.set(3.18,1.49,-2.08);deskLight.target.position.set(2.55,.86,-1.98);deskLight.castShadow=true;deskLight.shadow.mapSize.set(1024,1024);deskLight.shadow.bias=-.0003;deskLight.shadow.radius=2;scene.add(deskLight,deskLight.target);
const shelfLight=new THREE.RectAreaLight('#ffd39a',5,.32,.32);shelfLight.position.set(-1.38,2.96,-2.43);shelfLight.lookAt(-1.38,2.8,-3);scene.add(shelfLight);
const shelfWash=new THREE.RectAreaLight('#ffce92',3.5,1.4,.055);shelfWash.position.set(-2.04,2.72,-2.61);shelfWash.lookAt(-2.04,1.9,-2.9);scene.add(shelfWash);
const fill=new THREE.RectAreaLight('#f1ede4',.8,3,2);fill.position.set(0,2.4,1.5);fill.lookAt(0,1.7,-3);scene.add(fill);
function updateLights(){
 const isNight=mood==='night',outside=document.querySelector('#outside').checked,deskOn=document.querySelector('#desk').checked,shelfOn=document.querySelector('#shelf').checked;
 const ceilingMode=ceilingModes[ceilingControl.value];
 ceilingLight.color.set(ceilingMode.color);ceilingLight.intensity=ceilingMode.intensity;
 ceilingBounce.color.copy(ceilingLight.color);ceilingBounce.intensity=ceilingMode.bounce;
 ceilingDiffuser.emissive.copy(ceilingLight.color);ceilingDiffuser.emissiveIntensity=ceilingMode.glow;
 sun.intensity=outside?(isNight?.06:mood==='golden'?.9:.45):0;
 sun.color.set(mood==='golden'?'#ffcb8e':isNight?'#9eafd8':'#fff0d8');sun.position.y=mood==='golden'?3.3:4.5;
 const totalSun=sun.intensity;for(const light of sunSamples){light.intensity=totalSun/sunSamples.length;light.color.copy(sun.color);if(light!==sun)light.position.copy(sun.position).add(light.userData.offset);}
 windowFill.color.set(isNight?'#a8bcf1':mood==='golden'?'#ffe2bd':'#eef4ff');
 windowFill.intensity=outside?(isNight?.08:mood==='golden'?3.5:4.3):0;ambient.intensity=isNight?.06:outside?.20:.10;scene.environmentIntensity=isNight?.025:.13;
 deskLight.intensity=deskOn?14:0;shelfLight.intensity=shelfOn?5:0;shelfWash.intensity=shelfOn?8:0;fill.intensity=document.querySelector('#fill').checked?(isNight?.12:.8):0;
 bulb.material.color.set(deskOn?'#ffe0ad':'#77716b');globe.material.color.set(shelfOn?'#ffe1b0':'#8b8174');bulb.material.emissiveIntensity=deskOn?1.5:0;globe.material.emissiveIntensity=shelfOn?1.5:0;renderer.shadowMap.needsUpdate=true;
 updateBackdrop(outside?(isNight?1.2:mood==='golden'?3.5:4.5):0);
}
renderer.shadowMap.autoUpdate=false;
const pipeline=createPipeline(renderer,scene,camera,backdropMat);
const photoreal=createPhotoreal(renderer,scene,camera,pipeline,document.querySelector('#render-status'));
function updateCamera(){const x=Number(document.querySelector('#horizontal').value), y=Number(document.querySelector('#height').value), tilt=Number(document.querySelector('#tilt').value); camera.position.set(.3+x*.5,1.65+y,2.55);camera.fov=Number(document.querySelector('#zoom').value);camera.lookAt(-.55+x*.35,1.7+y+tilt*2,-2.8);camera.updateProjectionMatrix();}
function resize(){if(photoreal.exporting)return;const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();pipeline.resize(w,h,renderer.getPixelRatio());}new ResizeObserver(resize).observe(viewport);
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));updateBackdrop();}));document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{mood=b.dataset.preset;document.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('active',x===b));updateLights();}));document.querySelectorAll('.light-list input').forEach(x=>x.addEventListener('change',updateLights));document.querySelectorAll('.camera input').forEach(x=>x.addEventListener('input',updateCamera));document.querySelector('#reset').onclick=()=>{document.querySelector('#horizontal').value=0;document.querySelector('#height').value=0;document.querySelector('#tilt').value=0;document.querySelector('#zoom').value=48;updateCamera();};
document.querySelector('#guide').addEventListener('change', e=>document.querySelector('#person-guide').classList.toggle('hidden',!e.target.checked));
document.querySelector('#export').onclick=async()=>{
 if(photoreal.enabled){
 const button=document.querySelector('#export'),cancel=document.querySelector('#cancel-render');button.disabled=true;document.querySelector('#export-quality').disabled=true;cancel.hidden=false;document.querySelector('aside').inert=true;quality.querySelector('[role=group]').inert=true;
 try{await photoreal.exportImage(document.querySelector('#export-quality').value);}catch(error){document.querySelector('#render-status').textContent=error.message;}finally{button.disabled=false;document.querySelector('#export-quality').disabled=false;cancel.hidden=true;document.querySelector('aside').inert=false;quality.querySelector('[role=group]').inert=false;resize();}
 return;
 }
 const ratio=renderer.getPixelRatio();
 try {
  renderer.setPixelRatio(1.5);renderer.setSize(1920,1080,false);camera.aspect=16/9;camera.updateProjectionMatrix();pipeline.resize(1920,1080,1.5);pipeline.render();
  const a=document.createElement('a');a.download='roomlight-background.png';const output=document.createElement('canvas');output.width=1920;output.height=1080;const ctx=output.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(renderer.domElement,0,0,1920,1080);a.href=output.toDataURL('image/png');a.click();
 } finally {renderer.setPixelRatio(ratio);resize();pipeline.render();}
};
let dirty=true;
const invalidate=(event)=>{dirty=true;const cameraOnly=Array.isArray(event)||Boolean(event?.target?.closest?.('.camera'));photoreal.invalidate(cameraOnly?'camera':'scene');};
ceilingControl.addEventListener('change',()=>{updateLights();invalidate();});
THREE.DefaultLoadingManager.onLoad=()=>{pipeline.invalidateReflections();invalidate();};
document.querySelector('aside').addEventListener('input',invalidate);
document.querySelector('aside').addEventListener('click',invalidate);
new ResizeObserver(invalidate).observe(viewport);
updateLights();updateCamera();resize();renderer.setAnimationLoop(()=>{if(photoreal.exporting)return;if(dirty){pipeline.render();dirty=false;}photoreal.frame();});

document.querySelector('#cancel-render').onclick=()=>photoreal.cancel();
for(const id of ['quality-fast','quality-real'])document.getElementById(id).onclick=()=>{const real=id==='quality-real';photoreal.setEnabled(real);document.getElementById('quality-real').setAttribute('aria-pressed',String(real));document.getElementById('quality-fast').setAttribute('aria-pressed',String(!real));invalidate();};
