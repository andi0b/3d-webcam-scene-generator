import { render, fireEvent, cleanup, waitFor, within } from '@testing-library/svelte';
import { createAgent } from '@ui-sdk/svelte/agent';
import { afterEach, expect, test, vi } from 'vitest';
import 'fake-indexeddb/auto';
import App from '../src/App.svelte';
import { readImageLibrary, updateImageLibrary } from '../src/image-library.js';

const controls = vi.hoisted(() => ({ update: vi.fn(), exportImage: vi.fn(), cancelExport: vi.fn(), dispose: vi.fn(), callbacks: null }));
vi.mock('../src/main.js', () => ({ startStudio: async callbacks => {
  controls.callbacks = callbacks;
  callbacks.onReady();
  callbacks.onRealisticReady();
  return controls;
} }));
const agent = createAgent();
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test('SDK controls update renderer settings and export selections', async () => {
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  await fireEvent.click(view.getByRole('tab', { name: 'Light & view' }));
  await fireEvent.click(view.getByRole('radio', { name: 'Forest' }));
  await fireEvent.click(view.getByRole('radio', { name: 'Cloudy' }));
  await fireEvent.click(view.getByRole('switch', { name: 'Desk lamp' }));
  await fireEvent.click(within(view.getByRole('radiogroup', { name: 'Webcam noise' })).getByRole('radio', { name: 'High' }));
  await fireEvent.click(view.getByRole('switch', { name: 'Person guide' }));
  expect(view.queryByText('YOUR POSITION')).toBeNull();
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({ view:'forest', weather:'cloudy', desk:false, noise:'high' })));
  await fireEvent.click(view.getByRole('radio', { name: 'Detailed' }));
  await fireEvent.click(view.getByRole('radio', { name: '3K' }));
  controls.exportImage.mockResolvedValueOnce(null);
  await fireEvent.click(view.getByRole('button', { name: /Export PNG/ }));
  await waitFor(() => expect(controls.exportImage).toHaveBeenCalledWith('detailed', '3k'));
});

test('agent can discover and change studio settings', async () => {
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  await fireEvent.click(view.getByRole('tab', { name: 'Light & view' }));
  const entries = agent.snapshot().filter(entry => !entry.offPage && entry.component !== 'more');
  expect(entries.filter(entry => !entry.label)).toEqual([]);
  for (const label of ['Window view','Mood','Weather','Ceiling light','Desk lamp','Preview quality','Webcam noise','Person guide','Export quality','Export resolution']) expect(entries.map(entry => entry.label)).toContain(label);
  const result = await agent.act({ steps: [
    { ref:'Window view', action:'setValue', args:['Mountains'] },
    { ref:'Export resolution', action:'setValue', args:['3K'] },
  ] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(view.getByRole('radio', { name: '3K' }).getAttribute('aria-checked')).toBe('true');
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({view:'mountains'})));
});

test('export progress and cancellation restore the controls', async () => {
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  let finish;
  controls.exportImage.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await fireEvent.click(view.getByRole('button', { name: /Export PNG/ }));
  controls.callbacks.onExport({ stage: 'rendering', progress: 0.42 });
  await waitFor(() => expect(view.getByRole('progressbar', {name:'Export progress'}).getAttribute('aria-valuenow')).toBe('42'));
  await fireEvent.click(view.getByRole('button', { name: 'Cancel export' }));
  expect(controls.cancelExport).toHaveBeenCalled();
  controls.callbacks.onExport({ stage: 'cancelled' });
  finish(null);
  await waitFor(() => expect(view.getByText('Export cancelled')).toBeTruthy());
  await waitFor(() => expect(view.getByRole('button', { name: /Export PNG/ }).disabled).toBe(false));
});

test('preview status updates without replacing its controls', async () => {
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  const guide = view.getByRole('switch', { name: 'Person guide' });
  controls.callbacks.onStatus('Refining light · 1 / 12');
  await waitFor(() => expect(view.getByText('Refining light · 1 / 12')).toBeTruthy());
  controls.callbacks.onStatus('Realistic preview ready');
  await waitFor(() => expect(view.getByText('Realistic preview ready')).toBeTruthy());
  expect(view.getByRole('switch', { name: 'Person guide' })).toBe(guide);
});

test('mood and weather selections update the scene and pause with outside light', async () => {
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  await fireEvent.click(view.getByRole('tab', { name: 'Light & view' }));
  const result = await agent.act({ steps: [
    { ref: 'Mood', action: 'setValue', args: ['Golden hour'] },
    { ref: 'Weather', action: 'setValue', args: ['Cloudy'] },
  ] });
  expect(result.ok, result.error?.message).toBe(true);
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({ mood: 'golden', weather: 'cloudy' })));
  await fireEvent.click(view.getByRole('button', { name: /Advanced settings/ }));
  await fireEvent.click(view.getByRole('switch', { name: 'Outside light' }));
  expect(view.getByRole('radio', { name: 'Cloudy' }).getAttribute('aria-disabled')).toBe('true');
  expect(view.getByText(/Weather is paused/)).toBeTruthy();
});

test('sunny weather becomes clear after hours without changing the weather setting', async () => {
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  await fireEvent.click(view.getByRole('tab', { name: 'Light & view' }));
  expect(view.getByRole('radio', { name: 'Sunny' })).toBeTruthy();
  await fireEvent.click(view.getByRole('radio', { name: 'After hours' }));
  expect(view.getByRole('radio', { name: 'Clear' }).getAttribute('aria-checked')).toBe('true');
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({ mood: 'night', weather: 'sunny' })));
  await fireEvent.click(view.getByRole('radio', { name: 'Daylight' }));
  expect(view.getByRole('radio', { name: 'Sunny' }).getAttribute('aria-checked')).toBe('true');
});

test('ceiling and lamp controls update the room lighting', async () => {
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  await fireEvent.click(view.getByRole('tab', { name: 'Light & view' }));
  const result = await agent.act({ steps: [{ ref: 'Ceiling light', action: 'setValue', args: ['High'] }] });
  expect(result.ok, result.error?.message).toBe(true);
  await fireEvent.click(view.getByRole('switch', { name: 'Shelf light' }));
  expect(view.getByText('Neutral light · 4000 K')).toBeTruthy();
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({ ceiling: 'high', shelf: false })));
  const ceilingCard = view.getByRole('radiogroup', { name: 'Ceiling light' }).closest('.ceiling-control');
  expect(ceilingCard.getAttribute('data-active')).toBe('true');
  await fireEvent.click(view.getByRole('radio', { name: 'Off' }));
  expect(ceilingCard.getAttribute('data-active')).toBe('false');
  expect(view.getByText('Ceiling light is off.')).toBeTruthy();
});

test('saved camera angles load only camera settings', async () => {
  localStorage.clear();
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  await fireEvent.click(view.getByRole('button', { name: 'Save current angle' }));
  expect(document.activeElement).toBe(view.getByLabelText('Name this angle'));
  await fireEvent.input(view.getByLabelText('Name this angle'), { target: { value: 'Desk' } });
  await fireEvent.click(view.getByRole('button', { name: 'Save setup' }));
  expect(document.activeElement).toBe(view.getByRole('button', { name: 'Save current angle' }));
  expect(view.getByRole('button', { name: 'Load Desk' })).toBeTruthy();
  expect(view.queryByRole('slider', { name: 'Look left / right' })).toBeNull();
  await fireEvent.click(view.getByRole('button', { name: 'Advanced camera settings' }));
  await fireEvent.keyDown(view.getByRole('slider', { name: 'Look left / right' }), { key: 'ArrowRight' });
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({ pan:1 })));
  await fireEvent.click(view.getByRole('tab', { name: 'Light & view' }));
  await fireEvent.click(view.getByRole('tab', { name: 'Camera' }));
  expect(view.getByRole('button', { name:'Load Desk' }).getAttribute('aria-current')).toBeNull();
  await fireEvent.keyDown(view.getByRole('slider', { name: 'Framing' }), { key: 'ArrowRight' });
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({ zoom:49 })));
  await fireEvent.click(view.getByRole('tab', { name: 'Light & view' }));
  await fireEvent.click(view.getByRole('radio', { name: 'Forest' }));
  await fireEvent.click(view.getByRole('tab', { name: 'Camera' }));
  await fireEvent.click(view.getByRole('button', { name: 'Load Desk' }));
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({ zoom:48, pan:0, view:'forest' })));
  expect(view.getByRole('button', { name:'Load Desk' }).getAttribute('aria-current')).toBe('true');
  await fireEvent.keyDown(view.getByRole('slider', { name:'Framing' }), { key:'ArrowRight' });
  await fireEvent.click(view.getByRole('button', { name:'Overwrite Desk' }));
  await fireEvent.click(within(await view.findByRole('alertdialog')).getByRole('button', { name:'Overwrite' }));
  expect(view.getByRole('button', { name:'Load Desk' }).getAttribute('aria-current')).toBe('true');
  await fireEvent.click(view.getByRole('button', { name:'Delete Desk' }));
  await fireEvent.click(within(await view.findByRole('alertdialog')).getByRole('button', { name:'Cancel' }));
  expect(view.getByRole('button', { name:'Load Desk' })).toBeTruthy();
  await fireEvent.click(view.getByRole('button', { name:'Delete Desk' }));
  await fireEvent.click(within(await view.findByRole('alertdialog')).getByRole('button', { name:'Delete' }));
  expect(view.queryByRole('button', { name:'Load Desk' })).toBeNull();
  localStorage.clear();
});

test('decoration profiles restore their own rollup setting without changing the camera', async () => {
  localStorage.clear();
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  await fireEvent.keyDown(view.getByRole('slider', { name:'Framing' }), { key:'ArrowRight' });
  await fireEvent.click(view.getByRole('tab', { name:'Decoration' }));
  await fireEvent.click(view.getByRole('radio', { name:'Extended' }));
  await fireEvent.click(view.getByRole('button', { name:'Save current look' }));
  await fireEvent.input(view.getByLabelText('Name this look'), { target:{ value:'Presentation' } });
  await fireEvent.click(view.getByRole('button', { name:'Save setup' }));
  await fireEvent.click(view.getByRole('radio', { name:'Hidden' }));
  await fireEvent.click(view.getByRole('button', { name:'Load Presentation' }));
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({rollup:'extended', zoom:49})));
  localStorage.clear();
});



test('an agent can select a rollup state and save a named look', async () => {
  localStorage.clear();
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  await fireEvent.click(view.getByRole('tab', { name:'Decoration' }));
  let entries = agent.snapshot().filter(entry => !entry.offPage && entry.component !== 'more');
  for (const label of ['Rollup state', 'Save current look', 'Add images']) expect(entries.map(entry => entry.label)).toContain(label);
  let result = await agent.act({ steps:[{ ref:'Rollup state', action:'setValue', args:['Extended'] }] });
  expect(result.ok, result.error?.message).toBe(true);
  await fireEvent.click(view.getByRole('button', { name:'Save current look' }));
  entries = agent.snapshot().filter(entry => !entry.offPage && entry.component !== 'more');
  expect(entries.map(entry => entry.label)).toContain('Name this look');
  await fireEvent.input(view.getByLabelText('Name this look'), { target:{value:'Talks'} });
  await fireEvent.click(view.getByRole('button', { name:'Save setup' }));
  expect(view.getByRole('button', { name:'Load Talks' })).toBeTruthy();
  localStorage.clear();
});

test('IndexedDB artwork survives reload and saved looks fall back when an image is deleted', async () => {
  localStorage.clear();
  const image = { id:'sample-image', name:'sample.png', data:'data:image/png;base64,c2FtcGxl' };
  await updateImageLibrary(() => [image]);
  let view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  await fireEvent.click(view.getByRole('tab', { name:'Decoration' }));
  await waitFor(() => expect(view.getByRole('button', { name:'Delete sample.png' })).toBeTruthy());
  await fireEvent.click(view.getByRole('button', { name:/Left picture/ }));
  expect(view.getByRole('button', { name:'Upload and use for left picture' }).disabled).toBe(false);
  await fireEvent.click(view.getByRole('radio', { name:'Left picture: sample.png' }));
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({frame1Image:image.data})));
  await fireEvent.click(view.getByRole('button', { name:'Save current look' }));
  await fireEvent.input(view.getByLabelText('Name this look'), { target:{value:'Artwork test'} });
  await fireEvent.click(view.getByRole('button', { name:'Save setup' }));
  view.unmount();
  view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({frame1Image:''})));
  await fireEvent.click(view.getByRole('tab', { name:'Decoration' }));
  await view.findByRole('button', { name:'Delete sample.png' });
  await fireEvent.click(view.getByRole('button', { name:'Load Artwork test' }));
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({frame1Image:image.data})));
  await fireEvent.click(view.getByRole('button', { name:/Left picture/ }));
  await fireEvent.click(view.getByRole('button', { name:'Delete sample.png' }));
  await fireEvent.click(within(await view.findByRole('alertdialog')).getByRole('button', { name:'Delete' }));
  await waitFor(() => expect(view.getByRole('radio', { name:'Left picture: Shipped default' }).getAttribute('aria-checked')).toBe('true'));
  expect(await readImageLibrary()).toEqual([]);
  await fireEvent.click(view.getByRole('button', { name:'Load Artwork test' }));
  expect(view.getByRole('button', { name:'Load Artwork test' }).getAttribute('aria-current')).toBe('true');
  localStorage.clear();
});


test('camera sliders announce their real-world units', async () => {
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  expect(view.getByRole('slider', {name:'Camera height'}).getAttribute('aria-valuetext')).toBe('166.8 centimetres above the floor');
  expect(view.getByRole('slider', {name:'Look up / down'}).getAttribute('aria-valuetext')).toBe('0 degrees');
  expect(view.getByRole('slider', {name:'Framing'}).getAttribute('aria-valuetext')).toBe('48 degrees vertical, 77 degrees horizontal at 16 by 9');
});

test('image drops highlight destinations and apply only when dropped on a picture', async () => {
  await updateImageLibrary(() => []);
  vi.stubGlobal('DragEvent', class DragEvent extends Event {});
  vi.stubGlobal('Image', class {
    naturalWidth = 1;
    naturalHeight = 1;
    async decode() {}
  });
  try {
    const view = render(App);
    await fireEvent.click(view.getByRole('tab', { name:'Decoration' }));
    await waitFor(() => expect(view.getByRole('button', { name:'Add images' }).disabled).toBe(false));
    const picture = view.getByRole('button', { name:/Left picture/ }).closest('.image-drop-target');
    const library = view.getByRole('button', { name:'Add images' }).closest('.image-drop-target');
    const transfer = name => {
      const file = new File(['sample'], name, { type:'image/png' });
      return { types:['Files'], files:[file], items:[{ kind:'file', type:file.type, getAsFile:() => file }], effectAllowed:'all' };
    };
    const libraryImage = transfer('library.png');
    await fireEvent.dragEnter(library, { dataTransfer:libraryImage });
    expect(view.getByRole('main').getAttribute('data-highlight-drops')).toBe('true');
    expect(picture.getAttribute('data-drop-target')).toBe('true');
    expect(library.hasAttribute('data-drag-accept')).toBe(true);
    await fireEvent.drop(library, { dataTransfer:libraryImage });
    await view.findByRole('button', { name:'Delete library.png' });
    expect(picture.querySelector('.artwork-trigger').textContent).toContain('Alpine lake');
    expect(picture.getAttribute('data-drop-target')).toBe('false');
    expect(view.getByRole('main').getAttribute('data-highlight-drops')).toBe('false');

    const pictureImage = transfer('picture.png');
    await fireEvent.dragEnter(picture, { dataTransfer:pictureImage });
    expect(picture.hasAttribute('data-drag-accept')).toBe(true);
    await fireEvent.drop(picture, { dataTransfer:pictureImage });
    await view.findByRole('button', { name:/Left picture.*picture\.png/ });
    expect(view.getByRole('button', { name:'Delete picture.png' })).toBeTruthy();
    await fireEvent.dragEnter(library, { dataTransfer:libraryImage });
    await fireEvent.dragLeave(library, { dataTransfer:libraryImage });
    expect(view.getByRole('main').getAttribute('data-highlight-drops')).toBe('false');
  } finally {
    vi.unstubAllGlobals();
    await updateImageLibrary(() => []);
  }
});

test('a malformed saved angle cannot change lighting or exceed camera limits', async () => {
  localStorage.clear();
  localStorage.setItem('roomlight.profiles.camera', JSON.stringify([{id:'old', name:'Old', values:{zoom:999, view:'forest'}}]));
  const view = render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  await fireEvent.click(view.getByRole('button', {name:'Load Old'}));
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({zoom:58, view:'city'})));
  localStorage.clear();
});

