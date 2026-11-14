for (const selector of ['[data-view]', '[data-preset]']) {
  const buttons = [...document.querySelectorAll(selector)];
  for (const button of buttons) {
    button.addEventListener('click', () => {
      for (const choice of buttons) choice.classList.toggle('active', choice === button);
    });
  }
}

const cameraSliders = document.querySelectorAll('.camera input[type="range"]');
document.querySelector('#reset').addEventListener('click', () => {
  for (const slider of cameraSliders) slider.value = slider.defaultValue;
});

// Give the browser a paint before loading and evaluating the renderer.
requestAnimationFrame(() => requestAnimationFrame(async () => {
  try {
    const { startStudio } = await import('./main.js');
    await startStudio();
  } catch (error) {
    console.error('Roomlight startup failed', error);
    document.querySelector('#preview-loading').textContent = 'The 3D preview could not start. Reload the page to try again.';
    document.querySelector('#viewport').setAttribute('aria-busy', 'false');
  }
}));
