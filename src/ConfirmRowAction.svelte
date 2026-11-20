<script>
  import { AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@ui-sdk/svelte/alert-dialog';

  let { label, title, description, action, icon: Icon, onConfirm, danger = false, disabled = false } = $props();
</script>

<AlertDialog onOpenChange={(open, details) => {
  if (!open && details.returnValue === 'confirm') onConfirm();
}}>
  <AlertDialogTrigger class="row-action" data-danger={danger} aria-label={label} {title} {disabled}>
    <Icon size={15} aria-hidden="true" />
  </AlertDialogTrigger>
  <AlertDialogBackdrop class="row-confirm-backdrop" />
  <AlertDialogContent class="row-confirm">
    <AlertDialogTitle>{title}</AlertDialogTitle>
    <AlertDialogDescription>{description}</AlertDialogDescription>
    <div class="row-confirm-actions">
      <AlertDialogClose class="secondary-button">Cancel</AlertDialogClose>
      <AlertDialogClose class="primary-button" data-danger={danger} value="confirm">{action}</AlertDialogClose>
    </div>
  </AlertDialogContent>
</AlertDialog>
