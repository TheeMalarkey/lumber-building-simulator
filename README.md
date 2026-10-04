# Timber Studio

A desktop 3D building sandbox inspired by Lumber Tycoon 2. It includes the 69 blueprints listed in the community reference, 20 wood finishes, free and walking cameras, surface/grid placement, editing, undo/redo, and local project files.

**[Open Timber Studio in your browser](https://theemalarkey.github.io/lumber-building-simulator/)** — no installation required.

## Start

With Node.js 22.12+ installed:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5178. For a production build, run `npm run build`, then `npm run preview`.

The portable ZIP contains the compiled site and a small Node server. Extract it, double-click **Start Studio.cmd**, and keep its console open. It does not need npm packages. Your browser will open the editor. Node.js must be installed.

## Build

- Click **Build** or press **B** to open the blueprint inventory; **/** opens its search. Pick a piece to close the inventory and click a surface to place it repeatedly. **Escape** closes an open panel before cancelling placement or selection.
- The world fills the window. The small editing panel appears only while placing or selecting a piece; its **Wood** swatch opens the finish palette. Project name, new/import/export/save, settings, and help are in the **TIMBER** corner menu.
- **R** rotates, **T** tilts, **Escape** returns to selection. Rotate then tilt to tip a blueprint sideways; these quarter-turns combine to reach all 24 right-angle orientations.
- Use **WASD** to fly without holding a mouse button; **Q/E** lower/raise and **Shift** speeds up. Hold **right mouse** to look around. Wheel changes flight speed while right mouse is held. Typing in fields, using modifier shortcuts, and open dialogs pause keyboard movement.
- Click **Walk** or press **C** to explore with a classic block character. **WASD** walks relative to the camera, **Space** jumps, **Shift** runs, **right mouse** looks around, and the **wheel** zooms between third and first person. Press **C** again for free camera. The character collides with ground, walls, ceilings, and stairs; Home, Top, Focus, and Orbit return to free camera.
- **Middle mouse drag** or the Orbit tool orbits; the wheel zooms. **F** focuses selection.
- Select a piece or group and **drag its X / Y / Z arrows** to move along a world axis in whole studs. Release to apply; **Escape** cancels the drag. A red preview cannot be applied, and each group move undoes in one step. **Step buttons** offers six optional view-relative controls; numeric fields are under **Coordinates**.
- While placing or copying, press **L** or **Hold position**, then use the arrows to build in the air. Click **Place here** to commit. Repeatedly move up one stud and across one stud to create stairs or overhangs.
- While placing a new blueprint, **Ctrl + left drag** builds a straight run. It also works from a held preview in the air. Choose **Straight drag** under **Build mode** to do this without holding Ctrl. Release to build; the entire run undoes in one action. A red run stays as an editable preview until corrected or cancelled.
- **Fill span** places at one-stud spacing and includes the endpoint. Normal spacing follows the blueprint dimensions. Dense joins and tight bends may intersect; enable **Allow overlaps** when you want those intersections. Ground and active-land checks still apply to every piece, and an invalid run places nothing.
- Choose **Curve**, then click multiple points. Click a point's dot and drag its **X / Y / Z arrows** to edit it; **Remove point** removes the selected point. **Enter / Build path** commits the preview; **Escape / Cancel** discards it. Rotate, tilt and wood choices apply to the whole preview. Ctrl-drag can build a temporary straight run while preserving an unfinished curve.
- Wedge blueprints also offer **Smart wedge curve**, with **Ramp** and **Wall / arch** choices. Ramp points rise by the selected wedge's grade; adjust their heights with the arrows. Wall / arch mode follows the bend's plane, so lifting points makes an arch. The tool chooses among catalog wedge ratios and aligns their faces without stretching the models. Whole-stud positions and fixed catalog sizes can leave gaps at unusual bends; use Fill span and overlaps for denser joints.
- **Double-click a placed piece** to start moving it, or select it and press **G**. Click to place; **Escape** cancels. **Ctrl+D** duplicates the selected piece, and **Delete** removes it.
- In **Select mode**, hold **Ctrl** (or **Command** on Mac) and click placed blueprints to add/remove individual pieces. **Ctrl + left drag** adds every blueprint whose bounds touch the rectangle, including pieces behind others within view distance. Plain click selects one piece; click empty ground or press **Escape** to clear.
- With a group selected, **G / Move**, **Ctrl+D / Duplicate**, and **Delete** act on the whole group. Moving/copying keeps relative spacing, rotations, and finishes. Any collision, below-ground piece, or out-of-plot piece blocks the whole placement; **Escape** cancels. Each completed group action undoes in one step. **R / Rotate** and **T / Tilt** turn every member around the group’s shared center, preserving their arrangement. Choose a wood finish to apply it to the whole group; **Mixed woods** indicates differing finishes. These controls also adjust move/copy previews without changing the originals until placement. Numeric coordinates remain single-piece controls.
- **Ctrl+Z / Ctrl+Shift+Z** undo/redo. The toolbar also has these actions.
- Choose a wood finish for the selected piece and subsequent placements.
- Placement, position edits, and elevation use fixed one-stud increments. New placement aligns footprint edges with the floor grid, including rotated blueprints. Position controls preserve a piece’s fractional surface offset so thin pieces remain flush. Placement collision uses the same component shapes, so furniture openings and complementary wedge slopes remain usable. Collision checks start enabled: intersecting placements turn red and cannot be committed. Turn on **Allow overlaps** in the blueprint panel to permit intersections during placement, copying, movement and rotation, including group edits. This option lasts for the current session; switching it off keeps existing builds. Ground and active-plot limits always apply, and walking collision stays enabled. Moves, duplicates, rotations, and numeric position edits use the same check; touching faces and stacking remain allowed. The full rotated blueprint must stay at or above ground level; placement, movement, numeric edits, and rotation reject any below-ground portion.
- **Land** opens the 5×5 selector. Start with the center 40×40-stud plot and expand by shared edges, up to 200×200 studs. The full blueprint footprint must remain on active land. You cannot remove the center, disconnect land, or deactivate occupied plots. Land changes save with the project and support undo/redo. The dialog separately toggles the stud grid and plot borders. Thick grid lines divide each plot into five equal 8-stud cells.
- Plots stand 0.1 stud above the textured grass; walking steps up and down at their edges.
- The starter cabin is made entirely from editable catalog pieces. **New project** starts a blank scene.

## Keep your work

The browser autosaves to IndexedDB on the current origin and preserves the preceding snapshot. **Export project** downloads a `.timber` file; **Import project** validates it before asking to replace the current project. Export important builds as backups and to move between browsers or hosts. Browser storage is not cloud storage.

Builds stay in your browser and are not uploaded to GitHub. The public site has separate storage from localhost: export from the local editor and import on the public site to transfer a build.

## GitHub Pages

Pushes to `main` run the core tests, build the site with the repository's URL prefix, and deploy only `dist/` through GitHub Actions. Repository **Settings → Pages → Source** must be **GitHub Actions**. The workflow is `.github/workflows/pages.yml`; no deploy keys or personal access tokens are included in this project.

To check the hosted-path build locally:

```sh
npm run build -- --base=/lumber-building-simulator/
npx vite preview --host 127.0.0.1 --port 5180 --base=/lumber-building-simulator/
```

Open `http://127.0.0.1:5180/lumber-building-simulator/`. The ordinary `npm run build` still produces the root-path portable build.

## Fidelity and scope

Names and outer dimensions follow the [community blueprint table](https://lumber-tycoon-2.fandom.com/wiki/Blueprints). The complete coverage list is in `docs/reference/catalog-audit.json`. The October 2026 audit checks all 69 names, dimensions and wood requirements, and corrects 29 recipes using public game thumbnails; see `docs/reference/blueprint-fidelity.md` and the before/after comparisons in `artifacts/blueprint-comparison-*.png`. Fine geometry, wood rendering, pivots, and snapping are reconstructions. Exact matching to live LT2 has **not** been verified. In particular, the one-stud snap is an editor rule and not a certified reproduction of the game's placement implementation.

Wood grain, granite, ice, and foil use original pre-2022 maps published in [Roblox's material reference](https://create.roblox.com/docs/parts/materials), bundled locally. Texture scale is consistent across pieces and the catalog previews use the same materials. Lighting and roughness remain approximations; sources and texture budgets are in `docs/reference/wood-materials.md`.

Walk mode is a local Roblox-style reconstruction with an animated R6-proportioned avatar and a 70-degree follow camera. The body uses 2×2×1-stud torso and 1×2×1-stud limbs, with the classic head mesh and corrected shoulder/eye heights. Sources and dimensions are in `docs/reference/walk-avatar.md`. Movement uses 16 studs/second walking, 24 running, and a 50-stud/second jump impulse. Walking and follow-camera collision use the rendered component shapes: wedge slopes, individual stair treads, table legs and cabinet openings. The player still uses a simple body volume. There is no ladder climbing, multiplayer, or dynamic-object physics.

The first release covers blueprint construction and blueprint furniture. Machinery, conveyors, active doors, logic, vehicles, harvesting, and Roblox save import/export are outside its scope. This is an independent fan tool.

## Performance

Geometry and wood materials are shared. Static pieces are instanced by item/material and spatial chunk. Distant GPU chunks unload; the camera uses a floating render origin. Static pieces have no physics or individual frame callbacks. Rectangle selection queries the spatial index once on release. Group outlines use one line draw call, and placement/path previews instance matching blueprint types. Path edits coalesce to animation frames, unchanged paths reuse their previews, and the guide plus point markers add two batches. Transformed collision shapes have a bounded cache and are checked only after spatial and bounding-box rejection. The movement arrows add up to nine draws while visible. Quality settings control shadows, resolution, and view distance.

There is no artificial piece-count or height cap. Land is limited to 25 connected 40×40-stud plots. All editable records and the spatial index currently remain in RAM; IndexedDB saves are atomic full-project snapshots. Browser memory, storage quota, long synchronous imports, and the 256 MB import safety budget remain practical limits. This is **not** a literal unlimited-memory engine. The renderer currently uses WebGL 2; WebGPU is not implemented.

Measured results and limitations are in `docs/VALIDATION.md` and `artifacts/benchmarks.json`. Do not infer that all stored pieces were visible during a benchmark.

## Checks

```sh
npm test
npm run test:browser
npm run build
node scripts/benchmark.mjs
```

Browser tests use installed Google Chrome and start the dev server if needed. Benchmarks need the dev server running. Test contexts have their own storage and do not alter your browser's project.

## Source layout

- `src/catalog.ts`, `geometry.ts`, `materials.ts`: reference catalog and reusable assets.
- `src/world.ts`, `placement.ts`, `selection.ts`, `collision.ts`, `solid.ts`: authoritative data, history, bounds and placement.
- `src/renderer.ts`, `camera.ts`, `move-gizmo.ts`: instancing, streaming, picking and navigation.
- `src/build-path.ts`, `path-builder.ts`, `path-overlay.ts`: catalog path generation, build gestures and editable guides.
- `src/editor.ts`, `ui.ts`, `style.css`, `hud.css`: interaction and interface.
- `src/project.ts`, `storage.ts`: file validation and atomic local saves.

Font requests use Google Fonts with local system-font fallbacks. No analytics, account, remote project storage, or paid service is used.
