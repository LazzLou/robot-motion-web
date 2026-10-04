export const TAU = 2 * Math.PI;
export const RADIUS = 0.125;
export const defaults = () => ({theta1: 21 / 38 * TAU, theta2: 10 / 19 * TAU, obstacles: [[1.1, 1.1], [1.1, -1.1]], quality: 2});
export const wrap = angle => ((angle % TAU) + TAU) % TAU;
export function joints(a, b) {
  const elbow = [Math.cos(a), Math.sin(a)];
  return [[0, 0], elbow, [elbow[0] + Math.cos(a + b), elbow[1] + Math.sin(a + b)]];
}
export function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function collides(a, b, obstacles) {
  const j = joints(a, b);
  return obstacles.some(p => segmentDistance(p, j[0], j[1]) < 2 * RADIUS || segmentDistance(p, j[1], j[2]) < 2 * RADIUS);
}
export function collisionGrid(obstacles, n) {
  const data = new Uint8Array(n * n);
  for (let row = 0; row < n; row++) {
    const b = TAU * (1 - (row + 0.5) / n);
    for (let col = 0; col < n; col++) data[row * n + col] = Number(collides(TAU * (col + 0.5) / n, b, obstacles));
  }
  return data;
}
