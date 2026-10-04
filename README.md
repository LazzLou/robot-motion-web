# Robot Motion with Obstacles

**[Open the interactive simulation](https://lazzlou.github.io/robot-motion-web/)**

Explore how a two-link robot arm moves around obstacles and how those obstacles affect its configuration space. The simulation runs directly in your browser. No installation or sign-in is required.

## Controls

- Drag either brown obstacle in the robot workspace.
- Click or drag the crosshair in configuration space to change the arm's pose. Shaded regions represent collisions.
- Use the base and elbow angle controls to set a precise pose.
- Increase map quality to see finer collision boundaries.
- Select **Reset** to restore the starting configuration.

Keyboard: focus an obstacle or the configuration map and use the arrow keys. Hold Shift for larger steps.

## Development

Requires Node.js. No dependencies or build step are needed.

```sh
npm start
```

Open http://127.0.0.1:4173. Run `npm test` to check the robot geometry and collision calculations.

GitHub Actions tests and publishes the `dist` directory to GitHub Pages on pushes to `main`. In the repository's **Settings → Pages**, select **GitHub Actions** as the publishing source.

## Attribution

Adapted from [Robot Motion with Obstacles](https://demonstrations.wolfram.com/RobotMotionWithObstacles/) by Aaron T. Becker, Wolfram Demonstrations Project.
