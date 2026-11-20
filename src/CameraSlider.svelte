<script>
  import { Slider, SliderControl, SliderTrack, SliderIndicator, SliderThumb } from '@ui-sdk/svelte/slider';
  let { label, value = $bindable(), min, max, step, display = null, format = undefined, disabled = false } = $props();
</script>
<div class="camera-control">
  <span>{label}{#if display !== null} <strong> {display}</strong>{/if}</span>
  <Slider bind:value {min} {max} {step} {format} {disabled}>
    <SliderControl><SliderTrack><SliderIndicator /><SliderThumb aria-label={label} /></SliderTrack></SliderControl>
  </Slider>
</div>
