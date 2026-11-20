<script>
  import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from '@ui-sdk/svelte/collapsible';
  import { RadioGroup, Radio } from '@ui-sdk/svelte/radio';
  import { FileInput, FileInputDropzone, FileInputTrigger } from '@ui-sdk/svelte/file-input';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Plus from '@lucide/svelte/icons/plus';
  let { label, description, defaultImage, images, libraryReady, fileDragging, onUpload, value = $bindable() } = $props();
  let selectedImage = $derived(images.find(image => image.id === value));
  let uploading = $state(false), uploadMessage = $state('');
  async function upload(files) {
    if (!files.length) return;
    uploading = true;
    uploadMessage = '';
    try { uploadMessage = await onUpload(files); }
    finally { uploading = false; }
  }
</script>
<FileInput accept="image/*" disabled={!libraryReady || uploading} value={[]} onValueChange={(_, details) => upload(details.added)} onReject={() => uploadMessage = 'Choose an image file.'}>
  <FileInputDropzone class="image-drop-target artwork-drop" aria-label={`${label} drop area`} data-drop-target={fileDragging && libraryReady && !uploading}>
    <Collapsible class="artwork-card">
      <CollapsibleTrigger class="artwork-trigger">
        <span class="artwork-preview"><img src={selectedImage?.data || defaultImage} alt="" /></span>
        <span class="artwork-meta"><strong>{label}</strong><small title={selectedImage?.name}>{selectedImage?.name || description}</small></span>
        {#if fileDragging && libraryReady && !uploading}<span class="drop-hint" aria-hidden="true">Drop to use</span>
        {:else}<span class="artwork-change">Change <ChevronDown size={14} aria-hidden="true" /></span>{/if}
      </CollapsibleTrigger>
      <CollapsiblePanel class="artwork-panel">
        <RadioGroup aria-label={`${label} image`} bind:value={() => value || 'default', next => value = next === 'default' ? '' : next} class="artwork-options">
          <Radio value="default" aria-label={`${label}: Shipped default`} class="artwork-option"><img src={defaultImage} alt="" /><span>Default</span></Radio>
          <FileInputTrigger class="artwork-option artwork-upload" aria-label={`Upload and use for ${label.toLowerCase()}`}><span class="upload-icon"><Plus size={18} aria-hidden="true" /></span><span>Upload and use</span></FileInputTrigger>
          {#each images as image, index (image.id)}<Radio value={image.id} aria-label={`${label}: ${image.name}${images.filter(item => item.name === image.name).length > 1 ? ` (${index + 1})` : ''}`} class="artwork-option"><img src={image.data} alt="" /><span title={image.name}>{image.name}</span></Radio>{/each}
        </RadioGroup>
      </CollapsiblePanel>
      {#if uploadMessage}<p class="artwork-feedback" role="alert">{uploadMessage}</p>{/if}
    </Collapsible>
  </FileInputDropzone>
</FileInput>
