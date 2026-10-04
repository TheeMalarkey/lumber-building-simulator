# Timber Studio

A desktop 3D building sandbox inspired by Lumber Tycoon 2. It includes 100 placeable items: 69 wood blueprints, five glass pieces, nine store furnishings, five working light fixtures and 12 logic components. Build wired circuits, use 20 wood finishes, explore with free and walking cameras, and save editable local projects.

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

**Build → Store furniture** contains Armchair, Loveseat, Couch, Single Bed, Twin Bed, Toilet, Refrigerator, Stove and Dishwasher. They have fixed original-style finishes, detailed collision shapes, and the usual move/copy/rotate/tilt/save tools. Designs follow inspected game references; dimensions and fine details are estimates documented in [the furniture reference](docs/reference/store-furniture.md). Appliance doors are currently closed and static; sitting interactions are not implemented.

- Click **Build** or press **B** to open the blueprint inventory; **/** opens its search. Pick a piece to close the inventory and click a surface to place it repeatedly. **Escape** closes an open panel before cancelling placement or selection.
- The world fills the window. The small editing panel appears only while placing or selecting a piece; its **Wood** swatch opens the finish palette. Project name, new/import/export/save, settings, and help are in the **TIMBER** corner menu.
- **R** rotates, **T** tilts, **Escape** returns to selection. Rotate then tilt to tip a blueprint sideways; these quarter-turns combine to reach all 24 right-angle orientations.
- During new-piece placement, **Ctrl + left drag** builds a straight run. Choose **Straight drag** in the blueprint panel to drag without Ctrl; **Single piece** keeps ordinary click placement. Release to build the whole run in one undo action, or press **Escape** to cancel. Dragging from a held preview also works in the air.
- Start a run on a blueprint's top, side or wedge slope to build along that surface. The drag follows the starting face, so it can continue vertically beyond a wall's top. Elevation offsets apply throughout the run.
- **Fill span · every stud** repeats the blueprint every stud through the end of the drag. Default spacing follows the chosen blueprint's dimensions and orientation. Dense fills may need **Allow overlaps**. Ground, active-land and collision checks validate the whole run before anything is placed; retry an invalid drag or change its fill/overlap setting, then press **Build run** or **Enter**.
- Use **WASD** to fly without holding a mouse button; **Q/E** lower/raise and **Shift** speeds up. Hold **right mouse** to look around. Wheel changes flight speed while right mouse is held. Typing in fields, using modifier shortcuts, and open dialogs pause keyboard movement.
- Click **Walk** or press **C** to explore with a classic block character. **WASD** walks relative to the camera, **Space** jumps, **Shift** runs, **right mouse** looks around, and the **wheel** zooms between third and first person. Press **C** again for free camera. The character collides with ground, walls, ceilings, and stairs; Home, Top, Focus, and Orbit return to free camera.
- **Middle mouse drag** or the Orbit tool orbits; the wheel zooms. **F** focuses selection.
- Select a piece or group and **drag its X / Y / Z arrows** to move along a world axis in whole studs. Release to apply; **Escape** cancels the drag. A red preview cannot be applied, and each group move undoes in one step. **Step buttons** offers six optional view-relative controls; numeric fields are under **Coordinates**.
- Enable **Copy with arrows** in a selected piece or group's panel to duplicate it with an axis drag. Release to create the copies and select them for another drag; the originals keep their positions, wood and rotations. Each copy operation undoes in one step. The option starts off and lasts for the session. Step buttons and coordinate fields still move the selection.
- While placing or copying, press **L** or **Hold position**, then use the arrows to build in the air. Click **Place here** to commit. Repeatedly move up one stud and across one stud to create stairs or overhangs.
- **Double-click a placed piece** to start moving it, or select it and press **G**. Click to place; **Escape** cancels. **Ctrl+D** duplicates the selected piece, and **Delete** removes it.
- Hold **Ctrl** (or **Command** on Mac) and click placed blueprints to add/remove individual pieces. **Ctrl + left drag** adds every blueprint whose bounds touch the rectangle, including pieces behind others within view distance. Plain click selects one piece; click empty ground or press **Escape** to clear.
- With a group selected, **G / Move**, **Ctrl+D / Duplicate**, and **Delete** act on the whole group. Moving/copying keeps relative spacing, rotations, and finishes. Any collision, below-ground piece, or out-of-plot piece blocks the whole placement; **Escape** cancels. Each completed group action undoes in one step. **R / Rotate** and **T / Tilt** turn every member around the group’s shared center, preserving their arrangement. Choose a wood finish to apply it to the whole group; **Mixed woods** indicates differing finishes. These controls also adjust move/copy previews without changing the originals until placement. Numeric coordinates remain single-piece controls.
- **Ctrl+Z / Ctrl+Shift+Z** undo/redo. The toolbar also has these actions.
- Choose a wood finish for the selected piece and subsequent placements.
- Placement, position edits, and elevation use fixed one-stud increments. New placement aligns footprint edges with the floor grid, including rotated blueprints. Position controls preserve a piece’s fractional surface offset so thin pieces remain flush. Placement collision uses the same component shapes, so furniture openings and complementary wedge slopes remain usable. Collision checks start enabled: intersecting placements turn red and cannot be committed. Turn on **Allow overlaps** in the blueprint panel to permit intersections during placement, copying, movement and rotation, including group edits. This option lasts for the current session; switching it off keeps existing builds. Ground and active-plot limits always apply, and walking collision stays enabled. Moves, duplicates, rotations, and numeric position edits use the same check; touching faces and stacking remain allowed. The full rotated blueprint must stay at or above ground level; placement, movement, numeric edits, and rotation reject any below-ground portion.
- **Land** opens the 5×5 selector. Start with the center 40×40-stud plot and expand by shared edges, up to 200×200 studs. The full blueprint footprint must remain on active land. You cannot remove the center, disconnect land, or deactivate occupied plots. Land changes save with the project and support undo/redo. The dialog separately toggles the stud grid and plot borders. Thick grid lines divide each plot into five equal 8-stud cells.
- Plots stand 0.1 stud above the textured grass; walking steps up and down at their edges.
- The starter cabin is made entirely from editable catalog pieces. **New project** starts a blank scene.

The **Glass** category contains Tiny, Small, regular and Large Glass Panes plus the Glass Door. Panels are frameless and 0.2 studs thick, with fixed translucent finishes. Wood changes affect only wood pieces in a mixed selection. Glass supports the same placement, drag building, rotation, tilt, copy, collision and undo tools. The door is a static closed piece with a dark knob. Dimensions and visual estimates are documented in [the glass reference](docs/reference/glass.md).

**Build → Lighting** contains Lamp, Floor Lamp, Wall Light, Floodlight and Worklight. Select placed lights to toggle **Light on**, including mixed selections. **TIMBER → Settings → Night preview** makes their illumination easier to see. On/off states save with the project; night preview lasts for the session. Nearby lights receive illumination priority within a fixed rendering budget. Shapes, estimated dimensions and rendering limits are documented in [the lighting reference](docs/reference/lighting.md).

**Build → Logic** contains Lever, Button, Pressure Plate, AND/OR/XOR/NAND/NOR/XNOR Gates, Signal Inverter, Signal Delay and Signal Sustain. Their chamfered housings, symbols, sockets, orange controls, wooden plate and timer faces follow inspected game references. Select a placed component to operate it or set its timing; walking onto a plate activates it. In walk mode, **E** operates a selected lever or button.

Click **Wire**, then a socket, optional surface bends, and another socket or wire to connect. The inspector's socket buttons also start wires. Powered connections glow blue. Crossing wire interiors stay separate; shared sockets and deliberate endpoint junctions connect. **Backspace** removes the last bend; **Escape** cancels a wire, then exits wiring. To remove a wire, click it in Wire mode and choose **Delete selected wire**. Wired lights follow their signal and restore their manual setting when disconnected. Wires and settings save with the build and support group copying, moving, rotation, deletion and undo. Runtime pulses reset when a project loads. Timings follow [Circuit Workbench](https://github.com/TheeMalarkey/circuit-workbench); estimated dimensions, fidelity limits and exact behavior are documented in [the logic reference](docs/reference/logic.md).

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

Construction, glass, store furniture, lighting and basic wired logic are available. Machinery, conveyors, active doors, advanced logic boards/displays/sensors, vehicles, harvesting and Roblox save import/export remain outside the current scope. This is an independent fan tool.

## Performance

Geometry and wood materials are shared. Static pieces are instanced by item/material and spatial chunk. Distant GPU chunks unload; the camera uses a floating render origin. Static pieces have no physics or individual frame callbacks. Rectangle selection queries the spatial index once on release. Group outlines use one line draw call, and placement/drag previews instance matching blueprint types. Drag updates coalesce to animation frames, unchanged runs reuse their previews, and the straight guide adds one draw call. Transformed collision shapes have a bounded cache and are checked only after spatial and bounding-box rejection. The movement arrows add up to nine draws while visible. Quality settings control shadows, resolution, and view distance.

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
- `src/build-path.ts`, `path-builder.ts`, `path-overlay.ts`: straight run generation, drag gestures and preview guide.
- `src/logic.ts`, `logic-graph.ts`, `logic-ports.ts`: event-time simulation, dependency ordering, sockets and wire topology.
- `src/logic-geometry.ts`, `logic-view.ts`, `logic-tools.ts`: reconstructed models, instanced wiring and circuit controls.
- `src/editor.ts`, `ui.ts`, `style.css`, `hud.css`: interaction and interface.
- `src/project.ts`, `storage.ts`: file validation and atomic local saves.

Font requests use Google Fonts with local system-font fallbacks. No analytics, account, remote project storage, or paid service is used.
