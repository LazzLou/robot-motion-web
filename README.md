# Robot Motion with Obstacles

**[Open the interactive simulation](https://lazzlou.github.io/robot-motion-web/)**

An interactive **JavaScript, HTML, and CSS** recreation of the Wolfram Demonstrations Project example **Robot Motion with Obstacles**.

Explore how a two-link planar robot arm moves around circular obstacles and how its joint angles relate to collision regions in configuration space. The hosted application runs directly in a browser, with no installation or sign-in required.

## Features

- Two-link planar robot with forward kinematics
- Zero to four circular obstacles, starting with two
- Draggable, numbered obstacles with individual **1×–3×** size controls
- Robot/obstacle collision detection with red/green visual feedback
- Sampled configuration-space (C-space) collision map
- Adjustable map quality, with a coarse preview during obstacle and quality adjustments
- Draggable C-space crosshair with a transparent ring and solid center point
- Joint-angle sliders and numeric inputs in degrees
- Keyboard controls and a responsive layout
- Reset that restores the initial arm and obstacles while retaining map quality
- SVG workspace rendering and Canvas map rendering
- Automated geometry and simulation-state tests
- Static hosting through GitHub Pages

## Project Structure

```text
robot-motion-web/
├── dist/
│   ├── index.html                 # Page layout and accessible controls
│   ├── style.css                  # Styling and responsive layout
│   ├── app.js                     # Interaction, rendering, and browser state
│   └── geometry.js                # Kinematics, collisions, and state helpers
├── tests/
│   ├── geometry.test.mjs          # Kinematics and collision-map tests
│   └── state.test.mjs             # Obstacle, reset, and validation tests
├── .github/workflows/pages.yml    # Test and deploy to GitHub Pages
├── package.json                  # Local server and test commands
├── serve.mjs                     # Local static HTTP server
├── Start.ps1                     # Windows local-server launcher
├── Publish-GitHub.ps1             # GitHub CLI publishing helper
└── README.md
```

## Requirements

To use the hosted simulation:

- A modern browser with JavaScript enabled

To run or develop it locally:

- Node.js with npm
- Git, if cloning the repository

There are no third-party runtime dependencies, and no build step is required. The `dist` directory contains the complete browser application.

## Installation

Clone the repository:

```bash
git clone https://github.com/LazzLou/robot-motion-web.git
cd robot-motion-web
```

No `npm install` is needed.

## Running the Application

From the repository root:

```bash
npm start
```

Open **http://127.0.0.1:4173** in a browser. This is a local address on the computer running the server. Press `Ctrl+C` in the terminal to stop it.

The application uses JavaScript modules, so serve it over HTTP rather than opening `dist/index.html` directly as a file.

## Using the Demonstration

### Robot controls

The arm has two revolute joints:

- **θ₁ — Base angle:** rotates the first link from the positive horizontal axis.
- **θ₂ — Elbow angle:** rotates the second link relative to the first link.

Use the sliders or numeric inputs to set angles in degrees. The calculations use radians internally, with angles wrapped modulo 2π.

### Obstacles

Drag a numbered obstacle in the workspace to change its position. Use **Add obstacle** to add one at the first available numbered starting position, up to a maximum of four. Each obstacle has a **Remove** button and an independent size slider from **1× to 3×**, in 0.1 increments.

The numbers in the workspace match the controls below the plots. Size changes update both the displayed obstacle and the collision calculations. Obstacles may overlap, and removing every obstacle leaves a clear configuration-space map.

### Configuration space

Each point in C-space represents one robot pose. The horizontal axis is θ₁ and the vertical axis is θ₂. Shaded cells indicate collisions; white cells indicate collision-free sampled poses.

Click or drag the crosshair to change both joint angles. Its ring is transparent so the map remains visible underneath. The crosshair and collision indicator turn red when the current pose collides with an obstacle. Colliding poses remain selectable.

Opposite edges represent equivalent angles: a full revolution returns a joint to the same orientation.

### Map quality

The **Q** control ranges from 1 to 10 and defaults to 2. At rest, the map samples `32 × Q` angles along each axis:

| Q | Grid size |
|---:|---:|
| 1 | 32 × 32 |
| 2 | 64 × 64 |
| 5 | 160 × 160 |
| 10 | 320 × 320 |

During obstacle dragging, resizing, or quality adjustment, the preview uses `8 × Q` samples per axis. The finer map is restored when the adjustment finishes.

Higher quality gives finer collision boundaries but requires more computation. Changing only the robot's pose reuses the existing map.

### Keyboard and Reset

Focus an obstacle and use the arrow keys to move it. Focus the C-space map and use the arrow keys to change the angles. Hold **Shift** for larger steps.

**Reset** restores the starting joint angles and the two original obstacles at 1× size. It preserves the current Q setting. Reloading the page restores all initial settings.

## Mathematical Model

Both links have length `L = 1`, with the base fixed at `(0, 0)`. Forward kinematics gives the elbow and end-effector positions:

```text
x₁ = L cos(θ₁)
y₁ = L sin(θ₁)

x₂ = x₁ + L cos(θ₁ + θ₂)
y₂ = y₁ + L sin(θ₁ + θ₂)
```

The arm's half-width is `0.125`. Each obstacle has radius `0.125 × size multiplier`. Collision is detected when the distance from an obstacle center to either link segment is strictly less than:

```text
arm half-width + obstacle radius
```

The distance calculation clamps the nearest point to the segment endpoints, accounting for the rounded link ends. Exact tangency is not classified as collision under this strict threshold. Robot self-collision is outside this model.

The map evaluates this same collision test at each angular grid cell's center. Its boundary is approximate because sampling is finite; the current-pose indicator checks the actual angles directly.

## Visualization Architecture

The browser application separates calculations from interaction and rendering:

```text
HTML controls and pointer/keyboard events
                 ↓
      app.js — application state
                 ↓
  geometry.js — kinematics and collision tests
                 ↓
      SVG workspace + Canvas C-space map
```

- **`geometry.js`** contains forward kinematics, point-to-segment distances, collision sampling, angle wrapping, and obstacle/reset helpers. It can be tested without a browser.
- **`app.js`** connects the controls to simulation state, handles dragging and keyboard input, and renders the linked workspace and map.
- **`index.html` and `style.css`** define the page, controls, and responsive layout.
- **`serve.mjs`** serves static assets locally. The deployed simulation performs its calculations in the browser without a server backend.

In browsers supporting WebMCP, optional read, configure, and reset tools expose the same simulation state. Ordinary interaction does not depend on that support.

## Testing

Run the automated tests:

```bash
npm test
```

The tests cover forward kinematics, segment distances, collision thresholds, angle periodicity, variable obstacle sizes, map sampling, the four-obstacle limit, obstacle removal, Reset preserving quality, and state-input validation.

Useful manual checks:

1. Set each joint to 0°, 90°, 180°, 270°, and 360° and compare the arm orientation with the C-space marker.
2. Move an obstacle onto a link, then away from it, and check the collision indicator.
3. Add obstacles until the four-obstacle limit is reached, then remove all of them.
4. Resize an obstacle from 1× to 3× and observe the corresponding change in C-space.
5. Change Q, alter the scene, and select Reset; verify that Q is retained.
6. Check keyboard controls and the stacked layout on a narrow screen.

## Differences from the Original Demonstration

The original notebook uses Mathematica's native graphics and locator controls. This adaptation uses browser pointer events, SVG, and Canvas, with the same forward-kinematics and link/obstacle distance model.

The web interface adds numeric angle inputs, numbered obstacle controls, obstacle removal, individual resizing, and support for up to four obstacles. Reset retains the chosen map quality. The finite C-space grid and its quality-dependent boundaries remain part of the demonstration.

## Deployment

GitHub Actions tests the source and publishes `dist` to GitHub Pages on pushes to `main`. The workflow can also be run manually from the repository's **Actions** tab.

In **Settings → Pages**, select **GitHub Actions** as the publishing source. The deployed application is available at:

**https://lazzlou.github.io/robot-motion-web/**

## Troubleshooting

### The local server does not start

Check that Node.js and npm are available:

```bash
node --version
npm --version
```

Run `npm start` from the directory containing `package.json`. If port 4173 is already in use, stop the previous server before restarting it.

### The simulation does not load when opening an HTML file

Use `npm start` and open the local HTTP address. JavaScript modules need to be served rather than loaded directly from a file.

### The hosted site shows an older version

Check the latest GitHub Actions deployment, then refresh with **Ctrl+Shift+R** or open the site in a private window. The website URL stays the same after updates.

### Configuration-space updates are slow

Lower Q. The default `Q = 2` produces a 64 × 64 grid at rest and is a useful starting point for interactive exploration.

## Source Demonstration and Attribution

Based on **[Robot Motion with Obstacles](https://demonstrations.wolfram.com/RobotMotionWithObstacles/)** by **Aaron T. Becker and Haoran Zhao**, Wolfram Demonstrations Project.

This repository contains the browser implementation and its tests. The Wolfram notebook was used as reference material for the conversion; it is not required to run the web application.
