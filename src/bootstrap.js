for (const selector of ['[data-view]', '[data-preset]']) {
  const buttons = [...document.querySelectorAll(selector)];
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
    button.addEventListener('click', () => {
      for (const choice of buttons) {
        choice.classList.toggle('active', choice === button);
        choice.setAttribute('aria-pressed', String(choice === button));
      }
    });
  }
}

const cameraSliders = document.querySelectorAll('.camera input[type="range"]');
document.querySelector('#reset').addEventListener('click', () => {
  for (const slider of cameraSliders) slider.value = slider.defaultValue;
  updateAdvanced();
});

const advancedInputs = [...document.querySelectorAll('#advanced-settings input')];
function updateAdvanced() {
  document.querySelector('#advanced-changed').hidden = !advancedInputs.some(input =>
    input.type === 'checkbox' ? input.checked !== input.defaultChecked : input.value !== input.defaultValue,
  );
  const outsideEnabled = document.querySelector('#outside').checked;
  document.querySelector('#weather').disabled = !outsideEnabled;
  document.querySelector('#weather-note').hidden = outsideEnabled;
}
for (const input of advancedInputs) input.addEventListener('input', updateAdvanced);
updateAdvanced();

document.querySelector('#ceiling-light').addEventListener('change', event => {
  document.querySelector('#ceiling-note').textContent = {
    off: 'Ceiling light is off.', dimmed: 'Warm light · 2700 K',
    low: 'Warm light · 2900 K', high: 'Neutral light · 4000 K',
  }[event.target.value];
});
document.querySelector('#export-quality').addEventListener('change', event => {
  document.querySelector('#quality-note').textContent = {
    quick: 'Recommended · a faster render for everyday calls.',
    detailed: 'More refined lighting and detail · takes longer.',
    maximum: 'Most refined lighting and detail · slowest render.',
  }[event.target.value];
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
