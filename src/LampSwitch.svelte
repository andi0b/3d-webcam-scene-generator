<script>
  import { Switch } from '@ui-sdk/svelte/switch';
  let { label, icon: Icon, checked = $bindable() } = $props();
</script>

<Switch class="lamp-toggle" aria-label={label} bind:checked>
  <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
  <span class="lamp-name">{label}</span>
  <span class="lamp-state" aria-hidden="true">{checked ? 'On' : 'Off'}</span>
</Switch>
