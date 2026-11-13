import * as THREE from 'three';
import './style.css';
import { createPhotoreal } from './photoreal.js';
import { EXPORT_SIZES } from './realistic-export.js';
import { createPipeline } from './render-pipeline.js';
import { createRoom } from './scene/room.js';
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
const { scene, lighting, backdrop } = createRoom(
  import.meta.env.BASE_URL + 'assets/',
  renderer.capabilities.getMaxAnisotropy(),
);
const camera = new THREE.PerspectiveCamera(43, 16 / 9, .1, 30);
let view = 'city', mood = 'day';

function setExportShadows(exporting) {
  lighting.setShadowResolution(exporting);
  renderer.shadowMap.needsUpdate = true;
}

function updateBackdrop() {
  backdrop.update(view, mood);
  pipeline.invalidateReflections();
}

function updateLights() {
  lighting.update({
    mood,
    weather: weatherControl.value,
    ceilingMode: ceilingControl.value,
    outside: document.querySelector('#outside').checked,
    deskOn: document.querySelector('#desk').checked,
    shelfOn: document.querySelector('#shelf').checked,
    fillOn: document.querySelector('#fill').checked,
  });
  if (lighting.shadowsNeedUpdate) renderer.shadowMap.needsUpdate = true;
  updateBackdrop();
}

renderer.shadowMap.autoUpdate = false;
setExportShadows(false);
const pipeline = createPipeline(renderer, scene, camera, lighting.areaLights);
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
