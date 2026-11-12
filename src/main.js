import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import './style.css';
import { createPhotoreal } from './photoreal.js';
import { EXPORT_SIZES } from './realistic-export.js';
import { book, deskDetails, readingChair } from './details.js';
import { addAshFloor, addOutdoorBranches, addPlant, addRelief, applySurfaceTexture, createPipeline, plasterNormalMap, oakNormalMap, oakTexture } from './realism.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();

const app = document.querySelector('#app');
app.innerHTML = `<main><aside>
  <h1 class="brand"><span class="brand-icon" aria-hidden="true">◧</span>roomlight</h1>
  <div class="section"><div class="section-title"><span>01</span><h2>Outside your window</h2></div><div class="choices" id="views"><button class="choice active" data-view="city"><i>▥</i><b>City</b><small>Buildings & trees</small></button><button class="choice" data-view="forest"><i>♧</i><b>Forest</b><small>Quiet greenery</small></button><button class="choice" data-view="mountains"><i>⌁</i><b>Mountains</b><small>Room to breathe</small></button></div></div><div class="section"><div class="section-title"><span>02</span><h2>Set the mood</h2></div><div class="presets"><button data-preset="day" class="active">☀ &nbsp;Daylight</button><button data-preset="golden">◒ &nbsp;Golden hour</button><button data-preset="night">☾ &nbsp;After hours</button></div><div class="light-list"><label><span><b>Outside light</b><small>Sunlight through the window</small></span><input type="checkbox" id="outside" checked><i></i></label><label><span><b>Desk lamp</b><small>A warm pool of light</small></span><input type="checkbox" id="desk" checked><i></i></label><label><span><b>Shelf light</b><small>A little extra glow</small></span><input type="checkbox" id="shelf" checked><i></i></label><label><span><b>Off-camera fill</b><small>Soft light from behind you</small></span><input type="checkbox" id="fill" checked><i></i></label></div></div><div class="section camera"><div class="section-title"><span>03</span><h2>Find your angle</h2><button id="reset">Reset</button></div><p class="camera-help">Match your real webcam: move the camera, then adjust where it points.</p><label>Camera left / right <input id="horizontal" type="range" min="-1.5" max="1.5" step="0.01" value="0"></label><label>Camera height <input id="height" type="range" min="-0.45" max="0.45" step="0.01" value="0"></label><label>Look left / right <input id="pan" type="range" min="-180" max="180" step="1" value="0"></label><label>Look up / down <input id="tilt" type="range" min="-70" max="70" step="1" value="0"></label><label>Field of view <input id="zoom" type="range" min="36" max="58" step="1" value="48"></label><label class="guide-toggle"><span>Show person guide <small>For framing only · excluded from export</small></span><input type="checkbox" id="guide" checked></label></div><div class="aside-footer">MADE FOR YOUR NEXT GOOD CONVERSATION <span>✳</span></div></aside><section class="workspace"><div class="workspace-top"><div><div class="eyebrow">YOUR SPACE, YOUR WAY</div><h2>The preview <span>✳</span></h2></div><div class="live"><i></i> LIVE 3D PREVIEW</div></div><div class="preview-wrap"><div class="canvas-wrap"><div id="viewport"></div><div id="person-guide" aria-hidden="true"><div class="guide-head"></div><div class="guide-body"></div><span>YOUR POSITION</span></div></div><div class="preview-label"><span>01 / THE HOME OFFICE</span><span>16:9 &nbsp; · &nbsp; 3D SCENE</span></div></div><div class="workspace-bottom"><div><strong>Looking good?</strong><p>Export your scene and add it as a virtual background in your meeting app.</p></div><button id="export">Export background <span>↗</span></button></div><div class="tip"><span>✧</span><p><strong>A little tip</strong> &nbsp; Leave some breathing room in the center for you. Your exported image won’t include the preview controls.</p></div><div class="workspace-foot"><span>ROOMLIGHT STUDIO &nbsp; / &nbsp; V 0.1</span><span>DESIGNED FOR REAL CONVERSATIONS</span></div></section></main>`;

document.querySelector('.light-list').insertAdjacentHTML('afterbegin', `
  <label>
    <b>Ceiling light</b>
    <select id="ceiling-light">
      <option value="off">Off</option>
      <option value="dimmed">Dimmed · 2900 K</option>
      <option value="low" selected>Low · 2900 K</option>
      <option value="high">High · 4000 K</option>
    </select>
  </label>`);
const ceilingControl = document.querySelector('#ceiling-light');
document.querySelector('#outside').closest('label').insertAdjacentHTML('afterend', `
  <label>
    <b>Weather</b>
    <select id="weather">
      <option value="sunny" selected>Sunny</option>
      <option value="cloudy">Cloudy</option>
      <option value="foggy">Foggy</option>
    </select>
  </label>`);
const weatherControl = document.querySelector('#weather');

const quality = document.createElement('div');
quality.className = 'render-quality';
quality.innerHTML = `
  <div role="group" aria-label="Render quality">
    <button id="quality-fast" aria-pressed="true">Fast preview</button>
    <button id="quality-real" aria-pressed="false">Realistic lighting</button>
  </div>
  <label class="export-quality">Export quality
    <select id="export-quality">
      <option value="quick">Quick · recommended</option>
      <option value="detailed">Detailed</option>
      <option value="maximum">Maximum · slow</option>
    </select>
  </label>
  <label class="export-quality">Export resolution
    <select id="export-resolution">
      <option value="1080">1080p</option>
      <option value="720">720p</option>
      <option value="480">480p</option>
    </select>
  </label>
  <span id="render-status" role="status">Fast preview</span>
  <span id="export-status" role="status"></span>
  <button id="cancel-render" hidden>Cancel export</button>`;
document.querySelector('.preview-wrap').after(quality);
const viewport = document.querySelector('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; viewport.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#c4aa91');
const camera = new THREE.PerspectiveCamera(43, 16 / 9, .1, 30);
const mat = (color, roughness=1, metalness=0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
const textureLoader = new THREE.TextureLoader();
const assets = `${import.meta.env.BASE_URL}assets/`;
function loadSurface(url, repeat=2){const t=textureLoader.load(url);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;}
const wall = mat('#e1d7c9'), wood = mat('#ffffff', .42);
const dark = mat('#34322c'), cream = mat('#e0d1ba'), green = mat('#53663b'), gold = mat('#ac8657', .5, .4);
wall.normalMap = plasterNormalMap();
wood.map = oakTexture();
wood.normalMap = oakNormalMap(wood.map);
wood.map.anisotropy = wood.normalMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
function box(w,h,d,m,x,y,z, shadow=true){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;scene.add(o);return o;}
function roundedBox(w,h,d,r,m,x,y,z,segments=5){const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,segments,r),m);if(m===wood){const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;for(let i=0;i<p.count;i++){const along=w>h&&w>d?p.getX(i):h>d?p.getY(i):p.getZ(i);const across=w>h&&w>d?p.getZ(i):p.getX(i);uv.setXY(i,across*3,along*.65);}uv.needsUpdate=true;}mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;}
function sphere(r,m,x,y,z){const o=new THREE.Mesh(new THREE.SphereGeometry(r,32,24),m);o.position.set(x,y,z);o.castShadow=true;scene.add(o);return o;}
function cylinder(rt,rb,h,m,x,y,z){const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,48),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
// A complete back wall meets a left wall with a deep, side-facing window opening.
box(7.3,3.95,.18,wall,.4,1.975,-3);
const ceiling = mat('#ffffff', .91);
applySurfaceTexture(ceiling, textureLoader, `${assets}board-formed-concrete.jpg`, wood.map.anisotropy, .55);
// Keep a solid roof above the narrow joints between the four visible slabs.
box(7.3, .08, 6, ceiling, .4, 4.03, 0);
const slabWidth = 6.72 / 4;
// Sample within the photographed boards so the only seams are the slab joints.
for (const [index, grainStart] of [.03, .36, .69, .07].entries()) {
  const x = -3.16 + (index + .5) * slabWidth;
  const slab = box(slabWidth - .006, .04, 6, ceiling, x, 3.97, 0);
  const uv = slab.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const across = uv.getX(i), along = uv.getY(i);
    uv.setXY(i, index % 2 ? 1 - along : along, grainStart + across * .24);
  }
}
box(.18,3.95,6,wall,3.65,1.975,0);
// A frosted clerestory fills the top tenth of the wall behind the camera.
const rearWallZ = 3.08;
const rearWallTop = 3.95;
const clerestoryHeight = rearWallTop * .1;
const clerestoryBottom = rearWallTop - clerestoryHeight;
const clerestoryY = clerestoryBottom + clerestoryHeight / 2;
const clerestoryLeft = -3.16, clerestoryRight = 3.56;
const clerestoryWidth = clerestoryRight - clerestoryLeft;
const clerestoryX = (clerestoryLeft + clerestoryRight) / 2;
box(7.3, clerestoryBottom, .18, wall, .4, clerestoryBottom / 2, rearWallZ);
for (const [left, right] of [[-3.25, clerestoryLeft], [clerestoryRight, 4.05]]) {
  box(right - left, clerestoryHeight, .18, wall, (left + right) / 2, clerestoryY, rearWallZ);
}
const clerestoryFrame = mat('#b9ac98', .55);
const railWidth = .026;
const railZ = rearWallZ - .02;
for (const y of [clerestoryBottom + railWidth / 2, rearWallTop - railWidth / 2]) {
  box(clerestoryWidth, railWidth, .16, clerestoryFrame, clerestoryX, y, railZ);
}
const clerestoryPaneHeight = clerestoryHeight - 2 * railWidth;
for (const x of [clerestoryLeft + railWidth / 2, clerestoryRight - railWidth / 2]) {
  box(railWidth, clerestoryPaneHeight, .16, clerestoryFrame, x, clerestoryY, railZ);
}
for (const fraction of [.25, .5, .75]) {
  box(.022, clerestoryPaneHeight, .10, clerestoryFrame, clerestoryLeft + clerestoryWidth * fraction, clerestoryY, rearWallZ);
}
const clerestoryGlass = new THREE.MeshPhysicalMaterial({
  color: '#e5e8e3', roughness: .68, clearcoat: .15, clearcoatRoughness: .48,
});
// The milky glazing blocks sharp sunlight and glows from the diffuse daylight.
box(clerestoryWidth, clerestoryHeight, .024, clerestoryGlass, clerestoryX, clerestoryY, rearWallZ);
const clerestoryLight = new THREE.RectAreaLight('#ffffff', 0, clerestoryWidth - 2 * railWidth, clerestoryPaneHeight);
clerestoryLight.position.set(clerestoryX, clerestoryY, rearWallZ - .022);
clerestoryLight.lookAt(clerestoryX, clerestoryY, 0);
scene.add(clerestoryLight);

box(.18,3.95,.5,wall,-3.25,1.975,-2.75);
box(.18,3.95,3.3,wall,-3.25,1.975,1.35);
box(.18,.72,2.2,wall,-3.25,.36,-1.4);
box(.18,.90,2.2,wall,-3.25,3.50,-1.4);
// A solid backing keeps the recessed joints from exposing the environment below the room.
box(7.3,.09,6.18,mat('#9e9990',.76),.4,-.0665,0);
addAshFloor(scene, textureLoader, wood.map.anisotropy);
box(7.3,.14,.09,cream,.4,.05,-2.87);box(.09,.14,5.9,cream,-3.12,.05,0);
const frameDark = mat('#57483c', .85), hardware = mat('#4b4b46', .32, .72);
const sashWood = mat('#e2e6e9', .52), sillWood = mat('#f1eeeb', .46);
applySurfaceTexture(sashWood, textureLoader, `${assets}oak.png`, wood.map.anisotropy, .32);
applySurfaceTexture(sillWood, textureLoader, `${assets}oak-sill.png`, wood.map.anisotropy, .35);

// Map grain along each piece of wood, using the rounded geometry's UVs at the bevels.
function windowTimber(w, h, d, radius, material, x, y, z, grainWidth = .36) {
  const mesh = roundedBox(w, h, d, radius, material, x, y, z, 2);
  const { groups, attributes: { uv } } = mesh.geometry;
  const dimensions = { x: w, y: h, z: d };
  const grainAxis = h > d ? 'y' : 'z';
  const faceAxes = [['z', 'y'], ['x', 'z'], ['x', 'y']];
  const grainCenter = .5 + Math.sin(y * 4 + z * 7) * .045;
  for (const { start, count, materialIndex } of groups) {
    const [uAxis, vAxis] = faceAxes[Math.floor(materialIndex / 2)];
    const swap = uAxis === grainAxis;
    const acrossScale = dimensions[swap ? vAxis : uAxis] / grainWidth;
    const alongScale = dimensions[swap ? uAxis : vAxis] / 2.7;
    for (let i = start; i < start + count; i++) {
      const u = uv.getX(i) - .5;
      const v = uv.getY(i) - .5;
      uv.setXY(i, grainCenter + (swap ? v : u) * acrossScale, .5 + (swap ? u : v) * alongScale);
    }
  }
}

function addWindowFrame({ x, depth, bottom, top, minZ, maxZ, profile, bevel }) {
  const centerY = (bottom + top) / 2, centerZ = (minZ + maxZ) / 2;
  for (const y of [bottom + profile / 2, top - profile / 2]) {
    windowTimber(depth, profile, maxZ - minZ, bevel, sashWood, x, y, centerZ);
  }
  for (const z of [minZ + profile / 2, maxZ - profile / 2]) {
    windowTimber(depth, top - bottom - 2 * profile, profile, bevel, sashWood, x, centerY, z);
  }
}

// The sashes sit near the exterior face, behind the interior oak lining and sill.
windowTimber(.61, .066, 2.42, .009, sillWood, -3.025, .715, -1.4, .70);
addWindowFrame({ x: -3.195, depth: .15, bottom: .748, top: 3.05, minZ: -2.5, maxZ: -.3, profile: .034, bevel: .003 });
addWindowFrame({ x: -3.348, depth: .055, bottom: .748, top: 3.05, minZ: -2.5, maxZ: -.3, profile: .065, bevel: .003 });
const glazingSeal = mat('#46382e', .82);
const sash = { x: -3.309, depth: .09, bottom: .803, top: 2.995, profile: .036, bevel: .004 };
const sashFaceX = sash.x + sash.depth / 2;
const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: '#d8e1df', transparent: true, opacity: .035, roughness: .06,
  envMapIntensity: .5, side: THREE.DoubleSide, depthWrite: false,
});
const windowLights = [];
box(.022, sash.top - sash.bottom, .018, glazingSeal, sash.x - .037, (sash.top + sash.bottom) / 2, -1.4);
for (const [minZ, maxZ] of [[-2.451, -1.406], [-1.394, -.349]]) {
  addWindowFrame({ ...sash, minZ, maxZ });
  const width = maxZ - minZ - 2 * sash.profile;
  const height = sash.top - sash.bottom - 2 * sash.profile;
  const y = (sash.top + sash.bottom) / 2, z = (minZ + maxZ) / 2;
  const sealWidth = .009;
  for (const edge of [-1, 1]) {
    box(.016, height, sealWidth, glazingSeal, sashFaceX - .023, y, z + edge * (width - sealWidth) / 2);
    box(.016, sealWidth, width - 2 * sealWidth, glazingSeal, sashFaceX - .023, y + edge * (height - sealWidth) / 2, z);
  }
  const paneWidth = width - sealWidth, paneHeight = height - sealWidth;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(paneWidth, paneHeight), glassMaterial);
  glass.rotation.y = Math.PI / 2;
  glass.position.set(sashFaceX - .033, y, z);
  scene.add(glass);
  // The diffuse emitters match the panes and face into the room.
  const daylight = new THREE.RectAreaLight('#ffffff', 0, paneWidth, paneHeight);
  daylight.position.set(glass.position.x + .008, y, z);
  daylight.lookAt(0, y, z);
  windowLights.push(daylight);
  scene.add(daylight);
}
for (const z of [-2.438, -.362]) {
  for (const y of [1.12, 2.65]) cylinder(.0095, .0095, .068, hardware, sashFaceX + .003, y, z);
}

// A single downward lever with a softened inside corner and a slim backplate.
const handleMetal = mat('#252729', .34, .52);
const handleY = 1.75, handleZ = -1.425;
roundedBox(.018, .126, .029, .003, handleMetal, sashFaceX + .008, handleY, handleZ, 2);
const handleProfile = new THREE.Shape();
handleProfile.moveTo(.016, .017);
handleProfile.lineTo(.112, .017);
handleProfile.lineTo(.112, -.165);
handleProfile.lineTo(.087, -.165);
handleProfile.lineTo(.087, -.028);
handleProfile.quadraticCurveTo(.087, -.017, .076, -.017);
handleProfile.lineTo(.016, -.017);
handleProfile.closePath();
const windowHandle = new THREE.Mesh(new THREE.ExtrudeGeometry(handleProfile, {
  depth: .022, bevelThickness: .002, bevelSize: .002, bevelSegments: 2, curveSegments: 5,
}), handleMetal);
windowHandle.position.set(sashFaceX - .001, handleY, handleZ - .011);
windowHandle.castShadow = windowHandle.receiveShadow = true;
scene.add(windowHandle);
// Place the exterior farther from the window, with enough coverage for the camera sliders.
const backdropMat = new THREE.MeshStandardMaterial({color:'#000000',emissive:'#ffffff',emissiveIntensity:1,roughness:1});
const backdrop = box(8.2,4.7,.03,backdropMat,-5.85,2.10,-3.24,false);
backdrop.rotation.y = Math.PI / 2;
// The photograph sits behind the view through the window and lets traced sunlight pass.
backdropMat.castShadow = false;
backdrop.visibleToShadowRays = false;
const outsideImages = Object.fromEntries(['city','forest','mountains'].map(name=>{const texture=textureLoader.load(`${assets}${name}.png`);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return [name,texture];}));
let view = 'city', mood = 'day';
function updateBackdrop() {
  const image = outsideImages[view];
  if (backdropMat.emissiveMap !== image) {
    backdropMat.emissiveMap = image;
    backdropMat.needsUpdate = true;
  }
  backdropMat.emissive.set(mood === 'night' ? '#424c6a' : mood === 'golden' ? '#ffd5ad' : '#ffffff');
  pipeline.invalidateReflections();
}
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
const reliefImage = textureLoader.load(`${assets}alpine-relief.jpg`);
reliefImage.colorSpace = THREE.SRGBColorSpace;
reliefImage.anisotropy = wood.map.anisotropy;
addRelief(scene, 1.40, 1.99, -2.80, 2.28, 1.16, reliefImage);
// Desk and lamp
// Rounded top and inset tapered-looking legs keep the desk visually light.
roundedBox(2.3,.095,1.02,.045,mat('#e0d1ba',.53),2.45,.87,-1.95);
const deskLeg=mat('#9b795b',.78);for(const x of [1.48,3.35])for(const z of [-2.30,-1.60]){const leg=roundedBox(.065,.82,.065,.018,deskLeg,x,.41,z);leg.rotation.z=x<2?-0.025:0.025;}
roundedBox(2.0,.10,.055,.012,deskLeg,2.42,.77,-2.34);
for(let i=0;i<3;i++)book(scene,{x:1.78+(i%2)*.035,y:.92+i*.048,z:-2.1+(i%2)*.035,width:.048,height:.53,depth:.34,color:['#51463a','#a89a81','#ddd0b8'][i],title:['STUDIO','FORM & SPACE','NOTES'][i],flat:true});
deskDetails(scene,wood,dark,hardware);
// Articulated metal task lamp: base, two arms, joints and a tapered shade.
function rodBetween(a, b, radius, material) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 12);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  scene.add(mesh);
}
cylinder(.2,.22,.045,dark,3.04,.96,-2.1);const joint1=new THREE.Vector3(3.04,1,-2.1),joint2=new THREE.Vector3(2.8,1.43,-2.1),joint3=new THREE.Vector3(3.05,1.76,-2.1);rodBetween(joint1,joint2,.018,dark);rodBetween(joint2,joint3,.018,dark);[joint1,joint2,joint3].forEach(p=>sphere(.045,dark,p.x,p.y,p.z));
const shade=new THREE.Mesh(new THREE.CylinderGeometry(.09,.2,.28,48,1,true),new THREE.MeshStandardMaterial({color:'#252522',roughness:.35,metalness:.65,side:THREE.DoubleSide}));shade.position.set(3.11,1.7,-2.1);shade.rotation.z=-.45;shade.castShadow=true;scene.add(shade);const bulb=sphere(.075,new THREE.MeshStandardMaterial({color:'#fff0d8',emissive:'#ffe0a4',emissiveIntensity:1.5}),3.17,1.58,-2.1);
const globe=sphere(.13,new THREE.MeshStandardMaterial({color:'#fff0d8',emissive:'#ffdc9b',emissiveIntensity:1.5,roughness:.35}),-1.38,2.94,-2.64);globe.castShadow=false;bulb.castShadow=false;globe.material.castShadow=false;bulb.material.castShadow=false;cylinder(.1,.11,.09,dark,-1.38,2.82,-2.64);
const chair = readingChair(scene, wood);
chair.scale.multiplyScalar(1.656);
// The runners start above the model origin; lower them onto the floorboards.
chair.position.set(-1.478, -.0583, -1.528);
chair.rotation.y = .40 - Math.PI / 3;

// Low reading table tucked between the chair and the window corner.
const readingTableX = -2.694, readingTableZ = -2.344, readingTableTop = .54;
roundedBox(.56, .05, .48, .024, wood, readingTableX, readingTableTop - .025, readingTableZ);
for (const x of [-1, 1]) {
  for (const z of [-1, 1]) {
    const leg = cylinder(.025, .017, .516, deskLeg, readingTableX + x * .177, .24, readingTableZ + z * .145);
    leg.rotation.set(z * -.09, 0, x * .09);
  }
}
const tableBooks = [
  { x: -.145, z: -.035, width: .039, height: .28, depth: .20, color: '#46594f', title: 'FIELD NOTES', angle: -.08 },
  { x: -.113, z: -.018, width: .032, height: .24, depth: .174, color: '#a47955', title: 'WOODLANDS', angle: .10 },
  { x: -.083, z: -.045, width: .026, height: .19, depth: .14, color: '#847461', title: 'SEASONS', angle: -.16 },
];
let bookBase = readingTableTop;
for (const { x, z, width, height, depth, color, title, angle } of tableBooks) {
  const volume = book(scene, {
    x: readingTableX + x, y: bookBase, z: readingTableZ + z, width, height, depth, color, title, flat: true,
  });
  volume.rotation.y = angle;
  bookBase += width;
}

// A flush opal diffuser and a wide ceiling light for the whole room.
const ceilingX = -.45, ceilingZ = -1.22;
cylinder(.30,.30,.10,mat('#c8c5bb',.55,.25),ceilingX,3.90,ceilingZ);
const ceilingDiffuser = mat('#eeeae1',.75);
cylinder(.278,.263,.055,ceilingDiffuser,ceilingX,3.8275,ceilingZ);
const ceilingLight = new THREE.SpotLight('#ffffff',0,0,Math.PI * .46,.70,2);
ceilingLight.position.set(ceilingX,3.78,ceilingZ);
ceilingLight.target.position.set(ceilingX,0,ceilingZ);
ceilingLight.castShadow = true;
ceilingLight.shadow.camera.far = 10;
ceilingLight.shadow.bias = -.00015;
ceilingLight.shadow.normalBias = .006;
ceilingLight.shadow.radius = 3;
ceilingLight.shadow.autoUpdate = false;
// A diffuse contribution stands in for light bouncing into the corners in the live renderer.
const ceilingBounce = new THREE.AmbientLight('#ffffff',0);
scene.add(ceilingLight,ceilingLight.target,ceilingBounce);
// Approximate the two color temperatures in sRGB, with separate output levels.
const ceilingModes = {
  off: { color:'#ffffff', intensity:0, bounce:0, glow:0 },
  dimmed: { color:'#ffb367', intensity:12, bounce:.18, glow:.8 },
  low: { color:'#ffb367', intensity:19.2, bounce:.288, glow:1.28 },
  high: { color:'#ffd3a6', intensity:49.6, bounce:.64, glow:3.84 },
};

// Daylight and the ceiling fixture provide room light; desk and shelf lamps add accents.
const sunPresets = {
  day: { color: '#fff0d8', intensity: 4.65, height: 4.87, z: 3.6 },
  golden: { color: '#ffc385', intensity: 4.125, height: 2.42, z: 3.6 },
  night: { color: '#9eafd8', intensity: .108, height: 4.5, z: .4 },
};
const weatherModes = {
  sunny: { direct: 1, diffuse: 1 },
  cloudy: { direct: 0, diffuse: .8 },
  foggy: { direct: 0, diffuse: .4 },
};
const sun = new THREE.DirectionalLight();
sun.target.position.set(.5, 1.1, -2.8);
sun.castShadow = true;
sun.shadow.autoUpdate = false;
Object.assign(sun.shadow.camera, { left: -4, right: 7.25, top: 4.5, bottom: -4.5, near: .5, far: 16 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -.00015;
sun.shadow.normalBias = .006;
sun.shadow.radius = 1;
scene.add(sun, sun.target);

addOutdoorBranches(scene);

const deskLight = new THREE.RectAreaLight('#ffcf95', 0, .26, .26);
deskLight.position.set(3.18, 1.49, -2.10);
deskLight.lookAt(2.82, .87, -2.05);
scene.add(deskLight);
const shelfLight=new THREE.RectAreaLight('#ffd39a',5,.32,.32);shelfLight.position.set(-1.38,2.96,-2.43);shelfLight.lookAt(-1.38,2.8,-3);scene.add(shelfLight);
const shelfWash=new THREE.RectAreaLight('#ffce92',3.5,1.4,.055);shelfWash.position.set(-2.04,2.72,-2.61);shelfWash.lookAt(-2.04,1.9,-2.9);scene.add(shelfWash);
const fill=new THREE.RectAreaLight('#f1ede4',.8,3,2);fill.position.set(0,2.4,1.5);fill.lookAt(0,1.7,-3);scene.add(fill);
const areaLights = [...windowLights, clerestoryLight, deskLight, shelfLight, shelfWash, fill];

function setExportShadows(exporting) {
  sun.shadow.mapSize.setScalar(exporting ? 3072 : 768);
  ceilingLight.shadow.mapSize.setScalar(exporting ? 1024 : 256);
  sun.shadow.needsUpdate = true;
  ceilingLight.shadow.needsUpdate = true;
  renderer.shadowMap.needsUpdate = true;
}

function updateLights(){
 const isNight=mood==='night',outside=document.querySelector('#outside').checked,deskOn=document.querySelector('#desk').checked,shelfOn=document.querySelector('#shelf').checked;
 const ceilingMode=ceilingModes[ceilingControl.value];
 ceilingLight.color.set(ceilingMode.color);ceilingLight.intensity=ceilingMode.intensity;
 ceilingBounce.color.copy(ceilingLight.color);ceilingBounce.intensity=ceilingMode.bounce;
 ceilingDiffuser.emissive.copy(ceilingLight.color);ceilingDiffuser.emissiveIntensity=ceilingMode.glow;
 const sunlight = sunPresets[mood];
 const weather = weatherModes[weatherControl.value];
 const outsideDiffuse = outside ? weather.diffuse : 0;
 sun.intensity = outside ? sunlight.intensity * weather.direct : 0;
 sun.color.set(sunlight.color);
 if (sun.position.y !== sunlight.height || sun.position.z !== sunlight.z) {
  sun.position.set(-6, sunlight.height, sunlight.z);
  sun.shadow.needsUpdate = true;
 }
 const windowColor = isNight ? '#a8bcf1' : mood === 'golden' ? '#ffe2bd' : '#eef4ff';
 const windowIntensity = isNight ? .288 : mood === 'golden' ? 12.6 : 15.45;
 for (const light of windowLights) {
  light.color.set(windowColor);
  light.intensity = windowIntensity * outsideDiffuse;
 }
 clerestoryLight.color.set(windowColor);
 clerestoryLight.intensity = windowIntensity * outsideDiffuse * .28;
 clerestoryGlass.emissive.copy(clerestoryLight.color);
 clerestoryGlass.emissiveIntensity = clerestoryLight.intensity * .18;
 backdropMat.emissiveIntensity = outsideDiffuse;
 deskLight.intensity=deskOn?75:0;shelfLight.intensity=shelfOn?5:0;shelfWash.intensity=shelfOn?8:0;fill.intensity=document.querySelector('#fill').checked?(isNight?.12:.8):0;
 // The tracer picks from visible lights uniformly. Disabled lights would waste samples.
 for (const light of [ceilingLight, sun, ...areaLights]) {
  light.visible = light.intensity > 0;
 }
 if ((sun.visible && sun.shadow.needsUpdate) || (ceilingLight.visible && ceilingLight.shadow.needsUpdate)) {
  renderer.shadowMap.needsUpdate = true;
 }
 bulb.material.color.set(deskOn?'#ffe0ad':'#77716b');globe.material.color.set(shelfOn?'#ffe1b0':'#8b8174');bulb.material.emissiveIntensity=deskOn?1.5:0;globe.material.emissiveIntensity=shelfOn?1.5:0;
 updateBackdrop();
}
renderer.shadowMap.autoUpdate=false;
setExportShadows(false);
const pipeline=createPipeline(renderer,scene,camera,areaLights);
const renderStatus = document.querySelector('#render-status');
const exportStatus = document.querySelector('#export-status');
const photoreal = createPhotoreal(renderer, scene, camera, pipeline, renderStatus, exportStatus);
function updateCamera() {
  const x = Number(document.querySelector('#horizontal').value);
  const y = Number(document.querySelector('#height').value);
  const pan = THREE.MathUtils.degToRad(Number(document.querySelector('#pan').value));
  const tilt = THREE.MathUtils.degToRad(Number(document.querySelector('#tilt').value));
  camera.position.set(.3 + x * .5, 1.65 + y, 2.55);
  camera.fov = Number(document.querySelector('#zoom').value);
  camera.lookAt(-.55 + x * .35, 1.7 + y, -2.8);
  camera.rotateOnWorldAxis(camera.up, -pan);
  camera.rotateX(tilt);
  camera.updateProjectionMatrix();
}
function resize() {
  if (photoreal.exporting) return;
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  if (!width || !height) return;
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x !== width || size.y !== height) renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  pipeline.resize(width, height, renderer.getPixelRatio());
}
new ResizeObserver(resize).observe(viewport);
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));updateBackdrop();}));document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{mood=b.dataset.preset;document.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('active',x===b));updateLights();}));document.querySelectorAll('.light-list input').forEach(x=>x.addEventListener('change',updateLights));
const cameraSliders = document.querySelectorAll('.camera input[type="range"]');
for (const slider of cameraSliders) slider.addEventListener('input', updateCamera);
document.querySelector('#reset').onclick = () => {
  for (const slider of cameraSliders) slider.value = slider.defaultValue;
  updateCamera();
};
document.querySelector('#guide').addEventListener('change', e=>document.querySelector('#person-guide').classList.toggle('hidden',!e.target.checked));
const exportButton = document.querySelector('#export');
const exportQuality = document.querySelector('#export-quality');
const exportResolution = document.querySelector('#export-resolution');
const cancelExport = document.querySelector('#cancel-render');
const renderModes = quality.querySelector('[role=group]');
const sidebar = document.querySelector('aside');
const gl = renderer.getContext();

exportButton.onclick = async () => {
  const resolution = exportResolution.value;
  if (photoreal.enabled) {
    exportButton.disabled = exportQuality.disabled = exportResolution.disabled = true;
    cancelExport.hidden = false;
    sidebar.inert = renderModes.inert = true;
    try {
      await photoreal.exportImage(exportQuality.value, resolution);
    } catch (error) {
      exportStatus.textContent = error.message;
    } finally {
      exportButton.disabled = exportQuality.disabled = exportResolution.disabled = false;
      cancelExport.hidden = true;
      sidebar.inert = renderModes.inert = false;
      resize();
      dirty = true;
    }
    return;
  }

  const { width, height } = EXPORT_SIZES[resolution];
  const ratio = renderer.getPixelRatio();
  const size = renderer.getSize(new THREE.Vector2());
  try {
    if (gl.isContextLost()) throw new Error('The graphics context was lost. Wait for the preview to return.');
    setExportShadows(true);
    renderer.setDrawingBufferSize(width, height, 1.5);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    pipeline.resize(width, height, 1.5);
    pipeline.render({ forExport: true });
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const ctx = output.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(renderer.domElement, 0, 0, width, height);
    if (gl.isContextLost()) throw new Error('The graphics context was lost. Try a lower export resolution.');
    const link = document.createElement('a');
    link.download = 'roomlight-background.png';
    link.href = output.toDataURL('image/png');
    link.click();
    exportStatus.textContent = 'Download started';
  } catch (error) {
    exportStatus.textContent = error.message;
  } finally {
    setExportShadows(false);
    renderer.setDrawingBufferSize(size.x, size.y, ratio);
    resize();
    dirty = true;
  }
};
let dirty=true;
const invalidate=(event)=>{dirty=true;const cameraOnly=Array.isArray(event)||Boolean(event?.target?.closest?.('.camera'));photoreal.invalidate(cameraOnly?'camera':'scene');};
for (const control of [ceilingControl, weatherControl]) {
  control.addEventListener('change', () => {
    updateLights();
    invalidate();
  });
}
THREE.DefaultLoadingManager.onLoad=()=>{pipeline.invalidateReflections();invalidate();};
document.querySelector('aside').addEventListener('input',invalidate);
document.querySelector('aside').addEventListener('click',invalidate);
new ResizeObserver(invalidate).observe(viewport);
renderer.domElement.addEventListener('webglcontextrestored', () => {
  pipeline.invalidateReflections({ immediate: true });
  renderer.shadowMap.needsUpdate = true;
  scene.traverse(object => {
    if (object.shadow) object.shadow.needsUpdate = true;
  });
  dirty = true;
});
updateLights();
updateCamera();
resize();
renderer.setAnimationLoop(() => {
  if (photoreal.exporting || gl.isContextLost()) return;
  if (dirty || pipeline.previewReflectionsDue) {
    pipeline.render();
    dirty = false;
  }
  photoreal.frame();
});

cancelExport.onclick = () => photoreal.cancel();
for(const id of ['quality-fast','quality-real'])document.getElementById(id).onclick=()=>{const real=id==='quality-real';photoreal.setEnabled(real);document.getElementById('quality-real').setAttribute('aria-pressed',String(real));document.getElementById('quality-fast').setAttribute('aria-pressed',String(!real));invalidate();};
