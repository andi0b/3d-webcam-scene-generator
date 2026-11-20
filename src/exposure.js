export function exposureMultiplier(stops = 0) {
  return 1.05 * 2 ** stops;
}
