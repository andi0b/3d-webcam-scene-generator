// Hide the raster preview's artificial bounce sources only while a tracer
// collects its lights. Restore their visibility for the shared preview scene.
export function withoutPreviewOnlyLights(scene, collect) {
  const hidden = [];
  scene.traverse(light => {
    if (light.isLight && light.userData.previewOnly && light.visible) {
      hidden.push(light);
      light.visible = false;
    }
  });
  try {
    return collect();
  } finally {
    for (const light of hidden) light.visible = true;
  }
}
