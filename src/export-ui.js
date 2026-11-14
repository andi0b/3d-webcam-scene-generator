// Export feedback lives independently of the live preview's status.
export function createExportUI() {
  const feedback = document.querySelector('#export-feedback');
  const status = document.querySelector('#export-status');
  const detail = document.querySelector('#export-detail');
  const progress = document.querySelector('#export-progress');
  const percent = document.querySelector('#export-percent');
  const exportButton = document.querySelector('#export');
  const cancel = document.querySelector('#cancel-render');
  const download = document.querySelector('#download-again');
  let downloadUrl;
  let renderingPercent = 0;
  let cancelling = false;

  function report({ stage, progress: fraction, message }) {
    if (cancelling && !['cancelling', 'cancelled', 'error'].includes(stage)) return;
    feedback.hidden = false;
    feedback.dataset.state = stage;
    const busy = ['preparing', 'rendering', 'finishing', 'cancelling'].includes(stage);
    progress.hidden = !busy;
    percent.textContent = '';
    progress.removeAttribute('value');
    progress.setAttribute('aria-label', stage === 'rendering' ? 'Rendering progress' : 'Export progress');
    const title = {
      preparing: 'Preparing your scene…', rendering: 'Rendering your background…',
      finishing: 'Finishing your image…', complete: 'Image ready — download started',
      cancelled: 'Export cancelled', cancelling: 'Cancelling export…', error: 'Export could not finish',
    }[stage];
    if (stage === 'rendering' && Number.isFinite(fraction)) {
      renderingPercent = Math.max(renderingPercent, Math.min(100, Math.max(0, Math.floor(fraction * 100))));
      progress.value = renderingPercent;
      percent.textContent = `${renderingPercent}%`;
    }
    if (status.textContent !== title) status.textContent = title;
    detail.textContent = message ?? (busy
      ? 'Scene editing and preview are paused during export.'
      : stage === 'complete' ? '' : 'Your settings are preserved.');
    detail.hidden = !detail.textContent;
  }

  window.addEventListener('pagehide', () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = undefined;
    download.hidden = true;
  });

  return {
    report,
    start() {
      cancelling = false;
      renderingPercent = 0;
      cancel.disabled = false;
      cancel.hidden = false;
      download.hidden = true;
      exportButton.hidden = true;
      report({ stage: 'preparing' });
      cancel.focus();
    },
    cancelling() {
      cancelling = true;
      cancel.disabled = true;
      report({ stage: 'cancelling', message: 'Finishing the current operation before restoring scene editing.' });
    },
    complete(png) {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(png);
      download.href = downloadUrl;
      download.hidden = false;
      download.click();
      report({ stage: 'complete' });
    },
    error(error) {
      report({ stage: 'error', message: error.message || 'Please try exporting again.' });
    },
    finish() {
      const restoreFocus = document.activeElement === cancel;
      cancel.hidden = true;
      exportButton.hidden = false;
      exportButton.textContent = feedback.dataset.state === 'error' ? 'Retry export' : 'Export PNG ↗';
      if (restoreFocus) exportButton.focus();
    },
  };
}
