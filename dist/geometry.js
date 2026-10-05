export const TAU = 2 * Math.PI;
export const RADIUS = 0.125;
export const MAX_OBSTACLES = 4;
const obstaclePositions = [[1.1, 1.1], [1.1, -1.1], [-1.1, 1.1], [-1.1, -1.1]];
export function createObstacle(id) {
  const [x, y] = obstaclePositions[id - 1];
  return {id, x, y, scale: 1};
}
export const defaults = () => ({theta1: 21 / 38 * TAU, theta2: 10 / 19 * TAU, obstacles: [createObstacle(1), createObstacle(2)], quality: 2});
export const resetConfiguration = state => ({...defaults(), quality: state.quality});
export function addObstacle(state) {
  if (state.obstacles.length >= MAX_OBSTACLES) return state;
  const id = [1, 2, 3, 4].find(id => !state.obstacles.some(obstacle => obstacle.id === id));
  return {...state, obstacles: [...state.obstacles, createObstacle(id)]};
}
export const removeObstacle = (state, id) => ({...state, obstacles: state.obstacles.filter(obstacle => obstacle.id !== id)});
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
  return obstacles.some(obstacle => {
    const center = [obstacle.x, obstacle.y];
    const clearance = RADIUS + RADIUS * obstacle.scale;
    return segmentDistance(center, j[0], j[1]) < clearance || segmentDistance(center, j[1], j[2]) < clearance;
  });
}
export function collisionGrid(obstacles, n) {
  const data = new Uint8Array(n * n);
  for (let row = 0; row < n; row++) {
    const b = TAU * (1 - (row + 0.5) / n);
    for (let col = 0; col < n; col++) data[row * n + col] = Number(collides(TAU * (col + 0.5) / n, b, obstacles));
  }
  return data;
}

export function configureState(state, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['theta1', 'theta2', 'obstacles', 'quality'].includes(key))) throw Error('Invalid state fields');
  const next = structuredClone(state);
  for (const key of ['theta1', 'theta2']) if (key in input) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key])) throw Error('Angles must be finite numbers');
    next[key] = wrap(input[key]);
  }
  if ('quality' in input) {
    if (!Number.isInteger(input.quality) || input.quality < 1 || input.quality > 10) throw Error('Quality must be an integer from 1 to 10');
    next.quality = input.quality;
  }
  if ('obstacles' in input) {
    const obstacles = input.obstacles;
    if (!Array.isArray(obstacles) || obstacles.length > MAX_OBSTACLES) throw Error('Provide zero to four obstacles');
    const ids = new Set();
    for (const obstacle of obstacles) {
      if (!obstacle || typeof obstacle !== 'object' || Array.isArray(obstacle) || Object.keys(obstacle).some(key => !['id', 'x', 'y', 'scale'].includes(key))) throw Error('Each obstacle needs id, x, y and scale');
      if (!Number.isInteger(obstacle.id) || obstacle.id < 1 || obstacle.id > MAX_OBSTACLES || ids.has(obstacle.id)) throw Error('Obstacle IDs must be unique integers from 1 to 4');
      ids.add(obstacle.id);
      if ([obstacle.x, obstacle.y].some(value => typeof value !== 'number' || !Number.isFinite(value) || value < -2 || value > 2)) throw Error('Obstacle coordinates must be within -2 to 2');
      if (typeof obstacle.scale !== 'number' || !Number.isFinite(obstacle.scale) || obstacle.scale < 1 || obstacle.scale > 3) throw Error('Obstacle size must be between 1 and 3');
    }
    next.obstacles = structuredClone(obstacles);
  }
  return next;
}
