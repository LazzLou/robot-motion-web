# Local validation — 2026-11-01

The earlier observations still applied to the checked-out source. The following validation was performed locally before publication.

## Method

Compared a copy of the original `dist` files with the modified app on the same machine in headless Google Chrome through Playwright. All combinations of Q = 1, 2, 5, 10; two/four obstacles; and all obstacles at 1×/3× were exercised (16 scenes per implementation). Obstacles start at the four default corner positions. During each scene, automated mouse input drags an obstacle, adjusts its size, and moves the quality slider away and back. Obstacle dragging changes the scene slightly before slider measurements.

Computation measurements call `collisionGrid` directly in the browser: three warmups, then 20 timed calls for each sample factor. These exclude DOM updates, Canvas conversion, drawing, and input delivery. Values below are medians in milliseconds; they are measurements on this machine, not performance guarantees.

| Q | Obstacles | Scale | Original preview (8Q) | Original full (32Q) | Optimized full (32Q) |
|---:|---:|---:|---:|---:|---:|
| 1 | 2 | 1× | 0.00 | 0.20 | 0.10 |
| 2 | 2 | 1× | 0.00 | 0.50 | 0.10 |
| 5 | 2 | 1× | 0.20 | 2.70 | 0.40 |
| 10 | 2 | 1× | 0.70 | 10.30 | 1.40 |
| 1 | 2 | 3× | 0.00 | 0.10 | 0.00 |
| 2 | 2 | 3× | 0.00 | 0.40 | 0.10 |
| 5 | 2 | 3× | 0.20 | 2.60 | 0.40 |
| 10 | 2 | 3× | 0.70 | 10.10 | 1.40 |
| 1 | 4 | 1× | 0.00 | 0.20 | 0.00 |
| 2 | 4 | 1× | 0.10 | 0.70 | 0.10 |
| 5 | 4 | 1× | 0.30 | 3.90 | 0.60 |
| 10 | 4 | 1× | 1.00 | 14.60 | 2.50 |
| 1 | 4 | 3× | 0.00 | 0.20 | 0.00 |
| 2 | 4 | 3× | 0.00 | 0.70 | 0.10 |
| 5 | 4 | 3× | 0.30 | 3.70 | 0.60 |
| 10 | 4 | 3× | 1.70 | 13.90 | 2.30 |

## Browser interaction measurements

The harness times animation-frame callbacks (including pose rendering and, when dirty, map computation and Canvas writes). Event latency is from captured pointer/input delivery to the next Canvas map write. It does **not** include hardware input delay, compositor presentation, or subjective smoothness. Instrumentation applies equally to both versions. Short runs, timer precision, JIT, and system load affect these results; sub-millisecond computation values can round to zero.

The table shows the largest per-scene 95th percentile at Q = 10 across two/four obstacles and 1×/3× scales. Slider columns include obstacle size and map quality.

| Implementation | Drag callback | Slider callback | Drag event → map write | Slider event → map write |
|---|---:|---:|---:|---:|
| Original preview | 1.60 ms | 1.60 ms | 1.70 ms | 18.60 ms |
| Optimized full | 3.00 ms | 3.10 ms | 3.10 ms | 19.80 ms |

Full-resolution interaction has a small measurable callback cost compared with preview but remains comfortably within a 16.7 ms frame budget in these scenes. This supports removing downsampling. Small optimizations avoid per-cell arrays, reuse trigonometry by angle addition, compare squared distances, and write pixel channels without allocating an array per pixel. Live and sampled poses share the same capsule/circle collision predicate. No worker or new runtime dependency was introduced.

The original version repeatedly remained at 8Q after a mouse-driven quality-slider excursion returned to its starting value (Q = 2, 5, 10). This is a reproducible route to a coarse final map; it does not establish the cause of every previously reported quick-release failure. The modified version always rendered 32Q in these runs and no longer needs release/refinement handlers.

## Regression checks

- `npm test`: existing state/geometry tests and new contact, separation, overlap, rounded-cap, scaled-obstacle, sampled-contact, and map-disagreement tests pass.
- Browser matrix: rapid obstacle drags, size-slider moves, quality-slider moves returning to their original values, and final map dimensions.
- Focused browser checks: outside-control release; rapid same-frame input plus synthetic cancellation, lost-capture and focus-loss events; one batched map render; final pixel contents matching the final obstacle state.
- Mouse crosshair and keyboard obstacle/map/angle controls; numeric inputs; angle-only updates preserve the existing map.
- Both reported Q = 1 disagreement poses retain exact collision status while leaving sampled cell colors intact.
- Diagnostic (0°, 0°), obstacle (0.5, 0.26), scale 1 stays collision-free with the corrected silhouettes.
- Physical arm width is 25 SVG units; obstacle ordinary outer radii are 12.5 × scale at 1×, 1.7×, 2×, 3×, including focus. Focus uses a separate glow.
- Axis coordinates/anchors, no horizontal page overflow, and screenshots at 1200, 375, 320 px. Numerical glyph ink can overhang its anchored text advance slightly; anchors remain at the grid coordinates.

Headless browser automation and screenshots were available. Human visual smoothness, actual mobile hardware, and slower devices were not tested. Lower Q remains available for those devices. Browser measurements and screenshots are generated under `/tmp`; see the README for the repeatable harness.
