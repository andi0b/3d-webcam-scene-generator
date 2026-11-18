import { render, fireEvent, cleanup, waitFor, within } from '@testing-library/svelte';
import { createAgent } from '@ui-sdk/svelte/agent';
import { afterEach, expect, test, vi } from 'vitest';
import App from '../src/App.svelte';

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
  await fireEvent.click(view.getByRole('radio', { name: 'Forest' }));
  await fireEvent.click(view.getByRole('radio', { name: 'Cloudy' }));
  await fireEvent.click(view.getByRole('switch', { name: 'Desk lamp' }));
  await fireEvent.click(within(view.getByRole('radiogroup', { name: 'Webcam noise' })).getByRole('radio', { name: 'High' }));
  await fireEvent.click(view.getByRole('switch', { name: 'Person guide' }));
  expect(view.queryByText('YOUR POSITION')).toBeNull();
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({ view:'forest', weather:'cloudy', desk:false, noise:'high' })));
  await fireEvent.click(view.getByRole('radio', { name: 'Detailed' }));
  await fireEvent.click(view.getByRole('radio', { name: '720p' }));
  controls.exportImage.mockResolvedValueOnce(null);
  await fireEvent.click(view.getByRole('button', { name: /Export PNG/ }));
  await waitFor(() => expect(controls.exportImage).toHaveBeenCalledWith('detailed', '720'));
});

test('agent can discover and change studio settings', async () => {
  render(App);
  await waitFor(() => expect(controls.update).toHaveBeenCalled());
  const entries = agent.snapshot().filter(entry => !entry.offPage && entry.component !== 'more');
  expect(entries.every(entry => entry.label)).toBe(true);
  for (const label of ['Window view','Mood','Weather','Ceiling light','Desk lamp','Camera height','Framing','Preview quality','Webcam noise','Person guide','Export quality','Export resolution']) expect(entries.map(entry => entry.label)).toContain(label);
  const result = await agent.act({ steps: [{ ref:'Window view', action:'setValue', args:['Mountains'] }] });
  expect(result.ok, result.error?.message).toBe(true);
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
  const result = await agent.act({ steps: [{ ref: 'Ceiling light', action: 'setValue', args: ['High'] }] });
  expect(result.ok, result.error?.message).toBe(true);
  await fireEvent.click(view.getByRole('switch', { name: 'Shelf light' }));
  expect(view.getByText('Neutral light · 4000 K')).toBeTruthy();
  await waitFor(() => expect(controls.update).toHaveBeenLastCalledWith(expect.objectContaining({ ceiling: 'high', shelf: false })));
});
