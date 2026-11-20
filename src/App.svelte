<script>
  import { onMount, tick } from 'svelte';
  import Building2 from '@lucide/svelte/icons/building-2';
  import Trees from '@lucide/svelte/icons/trees';
  import Mountain from '@lucide/svelte/icons/mountain';
  import Sun from '@lucide/svelte/icons/sun';
  import Sunset from '@lucide/svelte/icons/sunset';
  import Moon from '@lucide/svelte/icons/moon';
  import MoonStar from '@lucide/svelte/icons/moon-star';
  import LampDesk from '@lucide/svelte/icons/lamp-desk';
  import LampCeiling from '@lucide/svelte/icons/lamp-ceiling';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import Cloud from '@lucide/svelte/icons/cloud';
  import CloudFog from '@lucide/svelte/icons/cloud-fog';
  import PanelsTopLeft from '@lucide/svelte/icons/panels-top-left';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { Button } from '@ui-sdk/svelte/button';
  import { Tabs, TabsList, TabsTab, TabsPanel } from '@ui-sdk/svelte/tabs';
  import ProfileControls from './ProfileControls.svelte';
  import ArtworkPicker from './ArtworkPicker.svelte';
  import { readImageLibrary, updateImageLibrary } from './image-library.js';
  import { FileInput, FileInputDropzone, FileInputTrigger } from '@ui-sdk/svelte/file-input';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Images from '@lucide/svelte/icons/images';
  import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from '@ui-sdk/svelte/collapsible';
  import { Progress, ProgressTrack, ProgressIndicator } from '@ui-sdk/svelte/progress';
  import ChoiceGroup from './ChoiceGroup.svelte';
  import MoodChoice from './MoodChoice.svelte';
  import CameraSlider from './CameraSlider.svelte';
  import { cameraHeightCm, horizontalFov } from './camera-geometry.js';
  import SettingSwitch from './SettingSwitch.svelte';
  import LampSwitch from './LampSwitch.svelte';
  import ConfirmRowAction from './ConfirmRowAction.svelte';

  const options = {
    view: [{value:'city',label:'City',icon:Building2}, {value:'forest',label:'Forest',icon:Trees}, {value:'mountains',label:'Mountains',icon:Mountain}],
    mood: [{value:'day',label:'Daylight',icon:Sun}, {value:'golden',label:'Golden hour',icon:Sunset}, {value:'night',label:'After hours',icon:Moon}],
    weather: [{value:'sunny',label:'Sunny',icon:Sun}, {value:'cloudy',label:'Cloudy',icon:Cloud}, {value:'foggy',label:'Foggy',icon:CloudFog}],
    ceiling: [{value:'off',label:'Off'}, {value:'dimmed',label:'Dimmed'}, {value:'low',label:'Low'}, {value:'high',label:'High'}],
    quality: [{value:'quick',label:'Quick'}, {value:'detailed',label:'Detailed'}, {value:'maximum',label:'Maximum'}],
    resolution: [{value:'480',label:'480p'}, {value:'720',label:'720p'}, {value:'1080',label:'1080p'}],
    preview: [{value:'fast',label:'Fast'}, {value:'realistic',label:'Realistic'}],
    rollup: [{value:'retracted',label:'Retracted'}, {value:'extended',label:'Extended'}, {value:'absent',label:'Hidden'}],
    noise: [{value:'none',label:'None'}, {value:'low',label:'Low'}, {value:'high',label:'High'}],
  };
  const hmrData = import.meta.env.MODE !== 'test' ? import.meta.hot?.data : undefined;
  let selectedTab = $state(hmrData?.selectedTab || 'camera');
  let activeCameraProfile = $state(hmrData?.activeCameraProfile || ''), activeDecorationProfile = $state(hmrData?.activeDecorationProfile || '');
  const hmrSettings = hmrData?.settings;
  let settings = $state({ view:'city', mood:'day', weather:'sunny', ceiling:'low', desk:true, shelf:true, outside:true, fill:true, horizontal:0, height:0, tilt:0, pan:0, zoom:48, noise:'none', realistic:false, rollup:'retracted', frame1:'', frame2:'', rollupArtwork:'', ...hmrSettings });
  const artworkFields = ['frame1', 'frame2', 'rollupArtwork'];
  let images = $state([]), imageError = $state(''), libraryReady = $state(false), libraryLoading = $state(true);
  let artworkError = $state('');
  let fileDragging = $state(false), dragDepth = 0, librarySection;
  let imageWrites = Promise.resolve(), imageChannel;
  function hasFiles(event) { return event.dataTransfer?.types.includes('Files'); }
  function startFileDrag(event) {
    if (!hasFiles(event)) return;
    dragDepth++;
    fileDragging = true;
  }
  function endFileDrag() { dragDepth = 0; fileDragging = false; }
  function leaveFileDrag(event) {
    if (hasFiles(event) && --dragDepth <= 0) endFileDrag();
  }
  function moveFileDrag(event) {
    if (!hasFiles(event)) return;
    fileDragging = true;
    if (!event.target.closest?.('.image-drop-target:not([data-disabled])')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'none';
    }
  }
  function dropFiles(event) {
    if (!hasFiles(event)) return;
    if (!event.target.closest?.('.image-drop-target:not([data-disabled])')) event.preventDefault();
    endFileDrag();
  }
  async function loadImages() {
    const read = imageWrites.then(async () => {
      try { images = await readImageLibrary(); libraryReady = true; }
      catch { imageError = 'Could not open the image library. Reload to try again.'; }
      finally { libraryLoading = false; }
    });
    imageWrites = read;
    await read;
  }
  function changeImages(change) {
    imageWrites = imageWrites.then(async () => {
      try { const next = await updateImageLibrary(current => $state.snapshot(change(current))); images = next; imageChannel?.postMessage('changed'); return true; }
      catch { imageError = 'Could not save the image library. Check browser storage and try again.'; return false; }
    });
    return imageWrites;
  }
  async function prepareUpload(file) {
    let data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const image = new Image();
    image.src = data;
    await image.decode();
    const scale = 2048 / Math.max(image.naturalWidth, image.naturalHeight);
    if (scale < 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const format = file.type === 'image/jpeg' || file.type === 'image/webp' ? file.type : 'image/png';
      data = canvas.toDataURL(format, .9);
    }
    return { id:crypto.randomUUID(), name:file.name, data };
  }
  async function uploadImages(files, field) {
    if (!files.length) return '';
    const previousAssignment = field && settings[field];
    const results = await Promise.allSettled(files.map(prepareUpload));
    const additions = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    if (additions.length && !await changeImages(current => [...current, ...additions])) {
      return 'Could not save the image. Check browser storage and try again.';
    }
    if (field && additions.length && settings[field] === previousAssignment) settings[field] = additions[0].id;
    return additions.length === files.length ? '' : 'Some images could not be opened. Try PNG, JPEG, or WebP.';
  }
  async function addLibraryImages(files) {
    imageError = await uploadImages(files);
  }
  function imageUrl(id) { return images.find(image => image.id === id)?.data || ''; }
  async function removeImage(id) {
    imageError = '';
    if (!await changeImages(current => current.filter(item => item.id !== id))) return;
    await tick();
    librarySection?.querySelector('.row-action, .library-add')?.focus();
  }
  function resolveDecorationValue(field, value) {
    return artworkFields.includes(field) && typeof value === 'string' && value && !imageUrl(value) ? '' : value;
  }
  $effect(() => {
    if (libraryReady) for (const field of artworkFields) {
      if (settings[field] && !imageUrl(settings[field])) settings[field] = '';
    }
  });
  let weatherOptions = $derived(options.weather.map(option => option.value === 'sunny' && settings.mood === 'night' ? { ...option, label: 'Clear', icon: MoonStar } : option));
  let preview = $state('fast'), quality = $state('quick'), resolution = $state('1080'), guide = $state(true);
  let viewport, studio = $state(null), ready = $state(false), realisticReady = $state(false), status = $state('');
  let loading = $state('Loading 3D preview…'), exporting = $state(false), cancelling = $state(false);
  let exportStage = $state('idle'), exportMessage = $state(''), percent = $state(null), downloadUrl = $state('');
  let advancedChanged = $derived(!settings.outside || !settings.fill);
  let ceilingNote = $derived(({off:'Ceiling light is off.', dimmed:'Warm light · 2700 K', low:'Warm light · 2900 K', high:'Neutral light · 4000 K'})[settings.ceiling]);
  let exportTitle = $derived(({preparing:'Preparing your scene…', rendering:'Rendering your background…', finishing:'Finishing your image…', complete:'Image ready — download started', cancelled:'Export cancelled', cancelling:'Cancelling export…', error:'Export could not finish'})[exportStage] || '');

  $effect(() => {
    if (import.meta.hot && import.meta.env.MODE !== 'test') { import.meta.hot.data.settings = $state.snapshot(settings); import.meta.hot.data.selectedTab = selectedTab; import.meta.hot.data.activeCameraProfile = activeCameraProfile; import.meta.hot.data.activeDecorationProfile = activeDecorationProfile; }
  });
  $effect(() => {
    const current = { ...settings, frame1Image:imageUrl(settings.frame1), frame2Image:imageUrl(settings.frame2), rollupImage:imageUrl(settings.rollupArtwork), realistic: preview === 'realistic' };
    studio?.update(current);
  });
  onMount(() => {
    loadImages();
    try { if (typeof BroadcastChannel !== 'undefined') { imageChannel = new BroadcastChannel('roomlight-image-library'); imageChannel.onmessage = () => loadImages(); } } catch { imageChannel = undefined; }
    let disposed = false;
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      try {
        const { startStudio } = await import('./main.js');
        const instance = await startStudio({ viewport, settings: { ...settings, realistic: preview === 'realistic' },
          onStatus: text => status = text, onArtworkError: text => artworkError = text, onReady: () => ready = true,
          onRealisticReady: () => realisticReady = true, onExport: reportExport });
        if (disposed) instance.dispose(); else studio = instance;
      } catch (error) {
        console.error('Roomlight startup failed', error);
        loading = 'The 3D preview could not start. Reload the page to try again.';
      }
    }));
    return () => { disposed = true; imageChannel?.close(); imageChannel = undefined; studio?.dispose(); if (downloadUrl) URL.revokeObjectURL(downloadUrl); };
  });
  function resetCamera() { Object.assign(settings, { horizontal:0, height:0, tilt:0, pan:0, zoom:48 }); }
  function reportExport({ stage, progress, message }) {
    if (cancelling && !['cancelling','cancelled','error'].includes(stage)) return;
    exportStage = stage;
    if (stage === 'rendering' && Number.isFinite(progress)) percent = Math.max(percent ?? 0, Math.min(100, Math.floor(progress * 100)));
    else if (stage !== 'rendering') percent = null;
    exportMessage = message ?? (['preparing','rendering','finishing','cancelling'].includes(stage) ? 'Scene editing and preview are paused during export.' : stage === 'complete' ? '' : 'Your settings are preserved.');
  }
  async function exportImage() {
    if (!studio || exporting) return;
    exporting = true; cancelling = false; percent = null; reportExport({stage:'preparing'});
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = '';
    try {
      const png = await studio.exportImage(quality, resolution);
      if (png) {
        downloadUrl = URL.createObjectURL(png);
        const link = document.createElement('a'); link.href = downloadUrl; link.download = 'roomlight-realistic.png'; link.click();
        reportExport({stage:'complete'});
      }
    } catch (error) { reportExport({stage:'error', message:error.message || 'Please try exporting again.'}); }
    finally { exporting = false; }
  }
  function cancelExport() { cancelling = true; reportExport({stage:'cancelling',message:'Finishing the current operation before restoring scene editing.'}); studio?.cancelExport(); }
</script>

<svelte:window ondragenter={startFileDrag} ondragleave={leaveFileDrag} ondragover={moveFileDrag} ondropcapture={dropFiles} ondragend={endFileDrag} />

<main data-highlight-drops={fileDragging && selectedTab === 'decor' && libraryReady && !exporting}>
  <aside inert={exporting}>
    <h1 class="brand"><PanelsTopLeft class="brand-icon" size={28} strokeWidth={1.5} aria-hidden="true" />roomlight</h1>
    <Tabs bind:value={selectedTab}><TabsList aria-label="Room settings"><TabsTab value="camera">Camera</TabsTab><TabsTab value="light">Light & view</TabsTab><TabsTab value="decor">Decoration</TabsTab></TabsList>
    <TabsPanel value="light"><div class="section"><div class="section-title"><span>01</span><h2>Outside your window</h2></div><ChoiceGroup label="Window view" options={options.view} bind:value={settings.view} /></div>
    <div class="section"><div class="section-title"><span>02</span><h2>Set the mood</h2></div>
      <div class="mood-panel">
        <MoodChoice label="Mood" options={options.mood} bind:value={settings.mood} />
        <MoodChoice label="Weather" options={weatherOptions} bind:value={settings.weather} disabled={!settings.outside} />
      </div>
      {#if !settings.outside}<p class="control-note">Weather is paused while Outside light is off in Advanced settings.</p>{/if}
    </div>
    <div class="section"><div class="section-title"><span>03</span><h2>Room lighting</h2></div>
      <div class="ceiling-control" data-active={settings.ceiling !== 'off'}><div class="ceiling-heading"><span class="ceiling-label"><LampCeiling size={18} strokeWidth={1.7} aria-hidden="true" />Ceiling light</span><span class="ceiling-temperature">{ceilingNote}</span></div><ChoiceGroup label="Ceiling light" description={ceilingNote} options={options.ceiling} bind:value={settings.ceiling} /></div>
      <div class="lamp-controls"><LampSwitch label="Shelf light" icon={Lightbulb} bind:checked={settings.shelf} /><LampSwitch label="Desk lamp" icon={LampDesk} bind:checked={settings.desk} /></div>
    </div>
    <Collapsible class="section advanced"><CollapsibleTrigger><ChevronDown size={15} aria-hidden="true" /> Advanced settings {#if advancedChanged}<span class="modified">Modified</span>{/if}</CollapsibleTrigger><CollapsiblePanel>

      <h3>Lighting overrides</h3><div class="light-list"><SettingSwitch label="Outside light" description="Light through the window" bind:checked={settings.outside} /><SettingSwitch label="Off-camera fill" description="Soft light from behind you" bind:checked={settings.fill} /></div>
    </CollapsiblePanel></Collapsible>    </TabsPanel><TabsPanel value="camera" keepMounted><div class="section camera"><div class="section-title"><span>01</span><h2>Find your angle</h2><Button onclick={resetCamera}><RotateCcw size={13} aria-hidden="true" /> Reset camera</Button></div>
      <p class="camera-help">Match your webcam position and choose how much of the room to show.</p>
      <CameraSlider label="Camera left / right" bind:value={settings.horizontal} min={-2.1} max={2.1} step={0.01} />
      <CameraSlider label="Camera height" format={value => `${cameraHeightCm(value).toFixed(1)} centimetres above the floor`} display={`${cameraHeightCm(settings.height).toFixed(1)} cm`} bind:value={settings.height} min={-0.63} max={0.63} step={0.01} />
      <CameraSlider label="Look up / down" format={value => `${value} degrees`} display={`${settings.tilt}°`} bind:value={settings.tilt} min={-35} max={35} step={1} />
      <CameraSlider label="Framing" format={value => `${value} degrees vertical, ${Math.round(horizontalFov(value))} degrees horizontal at 16 by 9`} display={`${settings.zoom}° vertical`} bind:value={settings.zoom} min={22} max={58} step={1} />
      <div class="range-endpoints"><span>Closer</span><span>Wider</span></div>
      <p class="fov-note">{Math.round(horizontalFov(settings.zoom))}° horizontal at 16:9</p>
    </div>
    <Collapsible class="section advanced camera"><CollapsibleTrigger><ChevronDown size={15} aria-hidden="true" /> Advanced camera settings</CollapsibleTrigger><CollapsiblePanel>
      <CameraSlider label="Look left / right" bind:value={settings.pan} min={-180} max={180} step={1} />
    </CollapsiblePanel></Collapsible>
    <div class="section"><ProfileControls kind="camera" fields={['horizontal','height','tilt','pan','zoom']} bind:active={activeCameraProfile} {settings} onLoad={next => Object.assign(settings, next)} /></div></TabsPanel>
    <TabsPanel value="decor" keepMounted>
      <div class="section decor-section"><div class="section-title"><span>01</span><h2>Make it yours</h2></div>
        <p class="section-intro">Choose artwork for the two small frames. Images are cropped to fit.</p>
        <div class="artwork-list">
          <ArtworkPicker label="Left picture" description="Alpine lake · default" defaultImage={import.meta.env.BASE_URL + 'assets/alpine-lake-print.jpg'} {images} {libraryReady} {fileDragging} onUpload={files => uploadImages(files, 'frame1')} bind:value={settings.frame1} />
          <ArtworkPicker label="Right picture" description="Misty forest · default" defaultImage={import.meta.env.BASE_URL + 'assets/misty-forest-print.jpg'} {images} {libraryReady} {fileDragging} onUpload={files => uploadImages(files, 'frame2')} bind:value={settings.frame2} />
        </div>
      </div>
      <div class="section decor-section"><div class="section-title"><span>02</span><h2>Rollup</h2></div>
        <p class="section-intro">Bring your image into the scene, or tuck the rollup away.</p>
        <div class="rollup-state"><ChoiceGroup label="Rollup state" options={options.rollup} bind:value={settings.rollup} /></div>
        <ArtworkPicker label="Rollup artwork" description="roomlight · default" defaultImage={import.meta.env.BASE_URL + 'assets/roomlight-rollup.webp'} {images} {libraryReady} {fileDragging} onUpload={files => uploadImages(files, 'rollupArtwork')} bind:value={settings.rollupArtwork} />
      </div>
      <div class="section"><ProfileControls kind="decoration" fields={['frame1','frame2','rollupArtwork','rollup']} bind:active={activeDecorationProfile} {settings} onLoad={next => Object.assign(settings, next)} resolveValue={resolveDecorationValue} loading={libraryLoading} /></div>
      <div class="section decor-section" bind:this={librarySection}><div class="section-title"><span>03</span><h2>Your image library</h2></div>
        <p class="section-intro">Add once, use on any picture or the rollup. Images stay in this browser.</p>
        <FileInput accept="image/*" multiple disabled={!libraryReady} value={[]} onValueChange={(_, details) => addLibraryImages(details.added)} onReject={() => imageError = 'Choose an image file.'}>
          <FileInputDropzone class="image-drop-target library-drop" aria-label="Image library drop area" data-drop-target={fileDragging && libraryReady}>
            {#if images.length}
              <div class="image-library">
                {#each images as image, index (image.id)}
                  <div class="image-item">
                    <img src={image.data} alt="" /><span title={image.name}>{image.name}</span>
                    <ConfirmRowAction label={'Delete ' + image.name + (images.filter(item => item.name === image.name).length > 1 ? ` (${index + 1})` : '')} title={`Delete “${image.name}”?`} description="Pictures using this image will fall back to their defaults." action="Delete" icon={Trash2} danger onConfirm={() => removeImage(image.id)} />
                  </div>
                {/each}
              </div>
            {:else}<div class="library-empty"><Images size={19} strokeWidth={1.5} aria-hidden="true" /><span>Your uploaded images will appear here.</span></div>{/if}
            <FileInputTrigger class="library-add" aria-label="Add images"><Plus size={15} aria-hidden="true" /> {fileDragging && libraryReady ? 'Drop to add to library' : 'Add images'}</FileInputTrigger>
          </FileInputDropzone>
        </FileInput>
        {#if imageError}<p class="profile-message" role="alert">{imageError}</p>{/if}
      </div>
    </TabsPanel>
</Tabs>
    <div class="aside-footer">MADE FOR YOUR NEXT GOOD CONVERSATION <span>✳</span></div>
  </aside>
  <section class="workspace"><div class="workspace-top"><div><div class="eyebrow">YOUR SPACE, YOUR WAY</div><h2>The preview <span>✳</span></h2></div><div class="live"><i></i> LIVE 3D PREVIEW</div></div>
    <div class="preview-wrap"><div class="preview-stage"><div class="canvas-wrap"><div id="viewport" bind:this={viewport} aria-busy={!ready}></div>
      {#if ready && guide}<div id="person-guide" aria-hidden="true"><div class="guide-head"></div><div class="guide-body"></div><span>YOUR POSITION</span></div>{/if}
      {#if !ready}<div id="preview-loading" role="status">{loading}</div>{/if}</div>
      {#if artworkError}<p class="artwork-error" role="status">{artworkError}</p>{/if}</div>
      <div class="control-row preview-row" aria-label="Preview controls">
        <span class="row-heading">Preview</span><div class="inline-control"><span class="inline-label">Mode</span><ChoiceGroup label="Preview quality" options={options.preview} bind:value={preview} disabled={!realisticReady || exporting} /></div>
        <div class="inline-control"><span class="inline-label">Noise</span><ChoiceGroup label="Webcam noise" description="Applied to realistic preview and PNG exports." options={options.noise} bind:value={settings.noise} disabled={exporting} /></div>
        <div class="preview-utilities"><div class="guide-control"><SettingSwitch label="Person guide" accessibleDescription="Excluded from export." bind:checked={guide} /></div><div class="preview-status" role="status"><span class="status-dot" aria-hidden="true"></span><span class="status-text" title={status || 'Preparing preview…'}>{status || 'Preparing preview…'}</span></div></div>
      </div>
    </div>
    <section class="export-bar" aria-label="Export controls">
      <div class="control-row export-row">
        <span class="row-heading">Export</span>
        <div class="inline-control"><span class="inline-label">Quality</span><ChoiceGroup label="Export quality" options={options.quality} bind:value={quality} disabled={exporting} /></div>
        <div class="inline-control"><span class="inline-label">Size</span><ChoiceGroup label="Export resolution" options={options.resolution} bind:value={resolution} disabled={exporting} /></div>
        <div class="export-buttons">{#if exporting}<Button class="secondary-button" disabled={cancelling} onclick={cancelExport}>Cancel export</Button>{:else}{#if downloadUrl}<a class="secondary-button" href={downloadUrl} download="roomlight-realistic.png">Download again</a>{/if}<Button class="primary-button" aria-description="Requires WebGPU." disabled={!ready || !studio} onclick={exportImage}>{exportStage === 'error' ? 'Retry export' : 'Export PNG'} <ArrowUpRight size={16} aria-hidden="true" /></Button>{/if}</div>
      </div>
      {#if exportStage !== 'idle'}<div class="export-feedback compact-feedback" data-state={exportStage}><div class="export-status-row"><span role="status">{exportTitle}</span><span>{percent === null ? '' : `${percent}%`}</span></div>
        {#if exporting}<Progress aria-label="Export progress" value={percent}><ProgressTrack><ProgressIndicator /></ProgressTrack></Progress>{/if}{#if exportMessage}<p class="control-note">{exportMessage}</p>{/if}</div>{/if}
    </section>
    <div class="workspace-foot"><span>ROOMLIGHT STUDIO &nbsp; / &nbsp; V 0.1</span><span>DESIGNED FOR REAL CONVERSATIONS</span></div>
  </section>
</main>
