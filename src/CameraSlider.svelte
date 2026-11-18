<script>
  import { Slider, SliderControl, SliderTrack, SliderIndicator, SliderThumb } from '@ui-sdk/svelte/slider';
  let { label, value = $bindable(), min, max, step } = $props();
</script>
<div class="camera-control">
  <span>{label}</span>
  <Slider bind:value {min} {max} {step}>
    <SliderControl><SliderTrack><SliderIndicator /><SliderThumb aria-label={label} /></SliderTrack></SliderControl>
  </Slider>
</div>
