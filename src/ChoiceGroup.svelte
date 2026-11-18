<script>
  import { SegmentedControl, SegmentedControlItem } from '@ui-sdk/svelte/segmented-control';
  let { label, options, value = $bindable(), disabled = false, description = undefined } = $props();
</script>
<SegmentedControl aria-label={label} aria-description={description} bind:value {disabled} class="sdk-segments">
  {#each options as option (option.value)}
    <SegmentedControlItem value={option.value}>{#if option.icon}{@const Icon = option.icon}<Icon size={16} strokeWidth={1.7} aria-hidden="true" />{/if}<span>{option.label}</span></SegmentedControlItem>
  {/each}
</SegmentedControl>
