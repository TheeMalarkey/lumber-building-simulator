# Connected building plots implementation plan

**Goal:** Match the supplied grass/dirt reference with selectable 40×40-stud plots in a fixed 5×5 layout; enforce build boundaries.

**Architecture:** Pure plot helpers validate connectivity and coverage. World owns land alongside piece history; project snapshots persist it. A shared terrain material and instanced plot planes keep rendering cost bounded. Editor exposes a 5×5 land dialog and independent stud-grid/plot-border controls.

**Tech stack:** Existing TypeScript, Three.js, Vitest, Playwright.

**Design:** Center plot spans -20..20 in X/Z and stays active. New plots share an edge with existing land; corner contact alone does not count. Deactivation cannot split the land or uncover pieces. All blueprint bounds must be covered by the union of active plots, including elevated and rotated pieces. Walking is allowed on grass. No purchasing/currency system. Legacy authored records are retained, with connected land inferred within the 200×200 footprint.

## Tasks
- [x] Add failing core tests for connectivity, footprint coverage, occupancy, history, and project validation/migration; implement plot helpers and world/project integration.
- [x] Add shared classic grass and ground textures, instanced plot surfaces, plot outlines, and grid masking that survives floating-origin shifts.
- [x] Add accessible land selector, independent grid/border toggles, save/load/export integration, and clear placement messages.
- [x] Run core/browser checks, inspect screenshots, validate the production package, and document source fidelity and performance limits.

## Review focus
- Interior inactive holes and pieces spanning multiple plot cells.
- Removal of bridges and center land; history restoring pieces onto deactivated land.
- Legacy saves, malformed imported plot layouts, and autosave revisions.
- Terrain/grid alignment after floating-origin shifts and at exact borders.
- Compact screen layout, keyboard focus, and constant terrain draw cost.

## Final checks and rulings

47 core tests and 21 browser scenarios passed, plus the production build. User follow-ups added the physical 0.1-stud step, plot-aligned five-by-five major grid, and grid/terrain depth stability. The 840-view framebuffer probe reproduced grass covering land before replacing the giant grass plane; it returned zero failures after subdivision and camera-following. A separate review caught starter path tiles outside the center and clearance/import loopholes; all were corrected and covered by regressions.
