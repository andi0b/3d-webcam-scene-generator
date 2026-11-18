<script>
  import { onMount } from 'svelte';
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
  import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from '@ui-sdk/svelte/collapsible';
  import { Progress, ProgressTrack, ProgressIndicator } from '@ui-sdk/svelte/progress';
  import ChoiceGroup from './ChoiceGroup.svelte';
  import MoodChoice from './MoodChoice.svelte';
  import CameraSlider from './CameraSlider.svelte';
  import SettingSwitch from './SettingSwitch.svelte';
  import LampSwitch from './LampSwitch.svelte';

  const options = {
    view: [{value:'city',label:'City',icon:Building2}, {value:'forest',label:'Forest',icon:Trees}, {value:'mountains',label:'Mountains',icon:Mountain}],
    mood: [{value:'day',label:'Daylight',icon:Sun}, {value:'golden',label:'Golden hour',icon:Sunset}, {value:'night',label:'After hours',icon:Moon}],
    weather: [{value:'sunny',label:'Sunny',icon:Sun}, {value:'cloudy',label:'Cloudy',icon:Cloud}, {value:'foggy',label:'Foggy',icon:CloudFog}],
    ceiling: [{value:'off',label:'Off'}, {value:'dimmed',label:'Dimmed'}, {value:'low',label:'Low'}, {value:'high',label:'High'}],
    quality: [{value:'quick',label:'Quick'}, {value:'detailed',label:'Detailed'}, {value:'maximum',label:'Maximum'}],
    resolution: [{value:'480',label:'480p'}, {value:'720',label:'720p'}, {value:'1080',label:'1080p'}],
    preview: [{value:'fast',label:'Fast'}, {value:'realistic',label:'Realistic'}],
    noise: [{value:'none',label:'None'}, {value:'low',label:'Low'}, {value:'high',label:'High'}],
  };
  let settings = $state({ view:'city', mood:'day', weather:'sunny', ceiling:'low', desk:true, shelf:true, outside:true, fill:true, horizontal:0, height:0, tilt:0, pan:0, zoom:48, noise:'none', realistic:false });
  let weatherOptions = $derived(options.weather.map(option => option.value === 'sunny' && settings.mood === 'night' ? { ...option, label: 'Clear', icon: MoonStar } : option));
  let preview = $state('fast'), quality = $state('quick'), resolution = $state('1080'), guide = $state(true);
  let viewport, studio = $state(null), ready = $state(false), realisticReady = $state(false), status = $state('');
  let loading = $state('Loading 3D preview…'), exporting = $state(false), cancelling = $state(false);
  let exportStage = $state('idle'), exportMessage = $state(''), percent = $state(null), downloadUrl = $state('');
  let advancedChanged = $derived(settings.pan !== 0 || !settings.outside || !settings.fill);
  let ceilingNote = $derived(({off:'Ceiling light is off.', dimmed:'Warm light · 2700 K', low:'Warm light · 2900 K', high:'Neutral light · 4000 K'})[settings.ceiling]);
  let exportTitle = $derived(({preparing:'Preparing your scene…', rendering:'Rendering your background…', finishing:'Finishing your image…', complete:'Image ready — download started', cancelled:'Export cancelled', cancelling:'Cancelling export…', error:'Export could not finish'})[exportStage] || '');

  $effect(() => {
    const current = { ...settings, realistic: preview === 'realistic' };
    studio?.update(current);
  });
  onMount(() => {
    let disposed = false;
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      try {
        const { startStudio } = await import('./main.js');
        const instance = await startStudio({ viewport, settings: { ...settings, realistic: preview === 'realistic' },
          onStatus: text => status = text, onReady: () => ready = true,
          onRealisticReady: () => realisticReady = true, onExport: reportExport });
        if (disposed) instance.dispose(); else studio = instance;
      } catch (error) {
        console.error('Roomlight startup failed', error);
        loading = 'The 3D preview could not start. Reload the page to try again.';
      }
    }));
    return () => { disposed = true; studio?.dispose(); if (downloadUrl) URL.revokeObjectURL(downloadUrl); };
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

<main>
  <aside inert={exporting}>
    <h1 class="brand"><PanelsTopLeft class="brand-icon" size={28} strokeWidth={1.5} aria-hidden="true" />roomlight</h1>
    <div class="section"><div class="section-title"><span>01</span><h2>Outside your window</h2></div><ChoiceGroup label="Window view" options={options.view} bind:value={settings.view} /></div>
    <div class="section"><div class="section-title"><span>02</span><h2>Set the mood</h2></div>
      <div class="mood-panel">
        <MoodChoice label="Mood" options={options.mood} bind:value={settings.mood} />
        <MoodChoice label="Weather" options={weatherOptions} bind:value={settings.weather} disabled={!settings.outside} />
      </div>
      {#if !settings.outside}<p class="control-note">Weather is paused while Outside light is off in Advanced settings.</p>{/if}
    </div>
    <div class="section"><div class="section-title"><span>03</span><h2>Room lighting</h2></div>
      <div class="ceiling-control"><div class="ceiling-heading"><span class="ceiling-label"><LampCeiling size={17} strokeWidth={1.7} aria-hidden="true" />Ceiling light</span><span class="ceiling-temperature">{ceilingNote}</span></div><ChoiceGroup label="Ceiling light" description={ceilingNote} options={options.ceiling} bind:value={settings.ceiling} /></div>
      <div class="lamp-controls"><LampSwitch label="Desk lamp" icon={LampDesk} bind:checked={settings.desk} /><LampSwitch label="Shelf light" icon={Lightbulb} bind:checked={settings.shelf} /></div>
    </div>
    <div class="section camera"><div class="section-title"><span>04</span><h2>Find your angle</h2><Button onclick={resetCamera}><RotateCcw size={13} aria-hidden="true" /> Reset camera</Button></div>
      <p class="camera-help">Match your webcam position and choose how much of the room to show.</p>
      <CameraSlider label="Camera left / right" bind:value={settings.horizontal} min={-2.1} max={2.1} step={0.01} />
      <CameraSlider label="Camera height" bind:value={settings.height} min={-0.63} max={0.63} step={0.01} />
      <CameraSlider label="Look up / down" bind:value={settings.tilt} min={-35} max={35} step={1} />
      <CameraSlider label="Framing" bind:value={settings.zoom} min={22} max={58} step={1} />
      <div class="range-endpoints"><span>Closer</span><span>Wider</span></div>
    </div>
    <Collapsible class="section advanced"><CollapsibleTrigger><ChevronDown size={15} aria-hidden="true" /> Advanced settings {#if advancedChanged}<span class="modified">Modified</span>{/if}</CollapsibleTrigger><CollapsiblePanel>
      <div class="camera"><h3>Camera direction</h3><CameraSlider label="Look left / right" bind:value={settings.pan} min={-180} max={180} step={1} /></div>
      <h3>Lighting overrides</h3><div class="light-list"><SettingSwitch label="Outside light" description="Light through the window" bind:checked={settings.outside} /><SettingSwitch label="Off-camera fill" description="Soft light from behind you" bind:checked={settings.fill} /></div>
    </CollapsiblePanel></Collapsible>
    <div class="aside-footer">MADE FOR YOUR NEXT GOOD CONVERSATION <span>✳</span></div>
  </aside>
  <section class="workspace"><div class="workspace-top"><div><div class="eyebrow">YOUR SPACE, YOUR WAY</div><h2>The preview <span>✳</span></h2></div><div class="live"><i></i> LIVE 3D PREVIEW</div></div>
    <div class="preview-wrap"><div class="canvas-wrap"><div id="viewport" bind:this={viewport} aria-busy={!ready}></div>
      {#if ready && guide}<div id="person-guide" aria-hidden="true"><div class="guide-head"></div><div class="guide-body"></div><span>YOUR POSITION</span></div>{/if}
      {#if !ready}<div id="preview-loading" role="status">{loading}</div>{/if}</div>
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
