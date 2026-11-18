<script>
  import { SegmentedControl, SegmentedControlItem } from '@ui-sdk/svelte/segmented-control';
  let { label, options, value = $bindable(), disabled = false } = $props();
  let selected = $derived(options.find(option => option.value === value));
</script>

<div class="mood-choice" class:paused={disabled}>
  <div class="mood-current" aria-hidden="true">
    {#if selected}
      {@const Icon = selected.icon}
      <Icon size={24} strokeWidth={1.7} />
      <span>{selected.label}</span>
    {/if}
  </div>
  <SegmentedControl aria-label={label} bind:value {disabled} class="mood-options">
    {#each options as option (option.value)}
      {@const Icon = option.icon}
      <SegmentedControlItem value={option.value} title={option.label}>
        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
        <span class="visually-hidden">{option.label}</span>
      </SegmentedControlItem>
    {/each}
  </SegmentedControl>
</div>
