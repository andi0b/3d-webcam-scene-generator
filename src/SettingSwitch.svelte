<script>
  import { Switch, SwitchThumb } from '@ui-sdk/svelte/switch';
  let { label, description, checked = $bindable(), disabled = false, accessibleDescription = undefined, icon: Icon = undefined } = $props();
</script>
<div class="switch-row">
  <span class="switch-label">{#if Icon}<Icon class="switch-icon" size={17} strokeWidth={1.7} aria-hidden="true" />{/if}<span><b>{label}</b>{#if description}<small>{description}</small>{/if}</span></span>
  <Switch aria-label={label} aria-description={accessibleDescription} bind:checked {disabled}><SwitchThumb /></Switch>
</div>
