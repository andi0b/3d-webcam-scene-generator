export const FLOOR_TOP = -.0175;
export const CAMERA_BASE_HEIGHT = 1.65;
export const OUTPUT_ASPECT = 16 / 9;

export function cameraHeightCm(offset) {
  return (CAMERA_BASE_HEIGHT + offset - FLOOR_TOP) * 100;
}

export function horizontalFov(verticalDegrees, aspect = OUTPUT_ASPECT) {
  return 2 * Math.atan(Math.tan(verticalDegrees * Math.PI / 360) * aspect) * 180 / Math.PI;
}
