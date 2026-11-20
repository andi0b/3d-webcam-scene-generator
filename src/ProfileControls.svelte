<script>
  import { onMount, tick } from 'svelte';
  import { Button } from '@ui-sdk/svelte/button';
  import { Input } from '@ui-sdk/svelte/input';
  import Bookmark from '@lucide/svelte/icons/bookmark';
  import Plus from '@lucide/svelte/icons/plus';
  import Save from '@lucide/svelte/icons/save';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import ConfirmRowAction from './ConfirmRowAction.svelte';
  let { kind, fields, settings, onLoad, resolveValue = (_, value) => value, loading = false, active = $bindable('') } = $props();
  const key = () => `roomlight.profiles.${kind}`;
  let profiles = $state(read());
  let name = $state(''), storageError = $state(''), saving = $state(false);
  let formError = $state(''), form = $state();
  let section;
  onMount(() => {
    if (active && !profiles.some(p => p.id === active)) active = '';
    function sync(event) { if (event.key === key()) { profiles = read(); if (active && !profiles.some(p => p.id === active)) active = ''; } }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  });
  function read() {
    try {
      const data = JSON.parse(localStorage.getItem(key()) || '[]'), seen = new Set();
      return Array.isArray(data) ? data.filter(profile => {
        if (!profile || typeof profile.id !== 'string' || !profile.id || seen.has(profile.id) || typeof profile.name !== 'string' || !profile.values || typeof profile.values !== 'object') return false;
        seen.add(profile.id); return true;
      }) : [];
    } catch { return []; }
  }
  function persist(next) { try { localStorage.setItem(key(), JSON.stringify(next)); profiles = next; storageError = ''; return true; } catch { storageError = 'Could not save in browser storage.'; return false; } }
  function values() { return Object.fromEntries(fields.map(field => [field, settings[field]])); }
  function matches(profile) { return fields.every(field => resolveValue(field, profile.values[field]) === settings[field]); }
  async function openSaveForm() {
    formError = '';
    saving = true;
    await tick();
    form?.querySelector('input')?.focus();
  }
  async function closeSaveForm() {
    saving = false;
    await tick();
    section?.querySelector('.profile-add')?.focus();
  }
  function save() {
    const title = name.trim(); if (!title) { formError = 'Give this setup a name first.'; return; }
    if (profiles.some(profile => profile.name.toLocaleLowerCase() === title.toLocaleLowerCase())) { formError = 'Choose a name that is not already in use.'; return; }
    formError = '';
    const id = crypto.randomUUID();
    if (persist([...profiles, { id, name:title, values:values() }])) { active = id; name = ''; closeSaveForm(); }
  }
  function overwrite(profile) {
    if (persist(profiles.map(p => p.id === profile.id ? { ...p, values:values() } : p))) active = profile.id;
  }
  async function remove(profile) {
    if (!persist(profiles.filter(p => p.id !== profile.id))) return;
    if (active === profile.id) active = '';
    await tick();
    section?.querySelector('.profile-load, .profile-add, .profile-save-form input')?.focus();
  }
  const cameraRanges = { horizontal:[-2.1,2.1], height:[-.63,.63], tilt:[-35,35], pan:[-180,180], zoom:[22,58] };
  function load(profile) {
    const next = {};
    for (const field of fields) {
      const value = resolveValue(field, profile.values[field]);
      if (typeof value !== typeof settings[field]) continue;
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) continue;
        const range = cameraRanges[field];
        next[field] = range ? Math.max(range[0], Math.min(range[1], value)) : value;
      } else if (field !== 'rollup' || ['retracted','extended','absent'].includes(value)) next[field] = value;
    }
    onLoad(next);
    active = profile.id;
  }
</script>
<div class="profile-controls" bind:this={section}>
  <h3 class="profile-heading">Saved {kind === 'camera' ? 'angles' : 'looks'}</h3>
  {#if profiles.length}
    <div class="profile-list">
      {#each profiles as profile (profile.id)}
        {@const current = active === profile.id && matches(profile)}
        <div class="profile-card" data-current={current}>
          <Button class="profile-load" aria-label={`Load ${profile.name}`} aria-current={current ? 'true' : undefined} disabled={loading} onclick={() => load(profile)}>
            <span class="profile-mark"><Bookmark size={15} strokeWidth={1.7} aria-hidden="true" /></span>
            <strong class="profile-name" title={profile.name}>{profile.name}</strong>
          </Button>
          <ConfirmRowAction label={`Overwrite ${profile.name}`} title={`Overwrite “${profile.name}”?`} description="Replace this setup with the current settings." action="Overwrite" icon={Save} disabled={loading || matches(profile)} onConfirm={() => overwrite(profile)} />
          <ConfirmRowAction label={`Delete ${profile.name}`} title={`Delete “${profile.name}”?`} description="This removes the saved setup from this browser." action="Delete" icon={Trash2} danger onConfirm={() => remove(profile)} />
        </div>
      {/each}
    </div>
  {:else}
    <p class="profile-empty">No saved {kind === 'camera' ? 'angles' : 'looks'} yet.</p>
  {/if}
  {#if saving}
    <form class="profile-save-form" bind:this={form} onsubmit={event => { event.preventDefault(); save(); }}>
      <label for={`profile-name-${kind}`}>Name this {kind === 'camera' ? 'angle' : 'look'}</label>
      <Input id={`profile-name-${kind}`} bind:value={name} placeholder={kind === 'camera' ? 'e.g. Everyday call' : 'e.g. Warm and calm'} maxlength={60} />
      {#if formError}<p class="profile-message" role="status">{formError}</p>{/if}
      <div class="profile-save-actions"><Button type="submit" class="profile-primary">Save setup</Button><Button onclick={closeSaveForm} class="profile-cancel">Cancel</Button></div>
    </form>
  {:else}
    <Button class="profile-add" onclick={openSaveForm}><Plus size={15} aria-hidden="true" /> Save current {kind === 'camera' ? 'angle' : 'look'}</Button>
  {/if}
  {#if storageError}<p class="profile-message" role="alert">{storageError}</p>{/if}
</div>
