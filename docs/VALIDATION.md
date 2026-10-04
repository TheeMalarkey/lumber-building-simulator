# Validation — 2026-10-03

## Implemented and checked

- 69 unique reference blueprints: 24 walls/fences, 8 floors/tiles, 3 doors, 22 wedges/stairs, 10 furniture, 2 other pieces. Every recipe produces finite geometry within its reference footprint.
- Twenty named wood finishes using Roblox's published classic material maps where appropriate. Lighting, tint response, and material parameters remain approximations; see `docs/reference/wood-materials.md` for provenance.
- Browser-tested catalog filtering/search, repeated placement, rotation, finish changes, numeric transforms, deletion, toolbar and keyboard history, reload and file export.
- Regressions cover finish changes while duplicating, cancelling a duplicate, upward free-camera release, and held keys on focus loss.
- Valid imports, malformed imports, recovery from a corrupted latest save, and storage failure with the live scene retained for export were tested in isolated browser contexts.
- Source test assertions cover thin geometry, rotated extents, oblique support planes, stable IDs, history notification timing, ray candidates across negative chunk boundaries, and project validation.

The automated suite contains 66 passing core tests and 25 passing browser scenarios. `npm run build` also passed. Run `npm test`, `npm run test:browser`, and `npm run build` to reproduce. Desktop screenshots are in `artifacts/editor-desktop.png`.

Rotate and Tilt compose world-axis quarter turns, so turning before tilting can tip a blueprint sideways. Tests prove all 24 distinct right-angle orientations are reachable and four turns restore the original pose. Browser coverage includes preview keyboard controls, placed-piece toolbar edits, undo/redo, and saved orientation reload. Existing Euler-based files remain compatible.

Walk camera checks cover grounded spawning, camera-relative movement, jump/landing, walls, ceiling contact, stairs, camera obstruction, first-person zoom, mode switching, and input focus isolation. A regression prevents spawning beneath ceilings that would intersect the classic head mesh. The animated R6-proportioned avatar is local to the camera and is excluded from saved blueprints. Dimensions were checked against Roblox's bundled R6 mannequin; see `docs/reference/walk-avatar.md`. Visual evidence is in `artifacts/walk-camera.png` and `artifacts/visual-check.json`.

Texture checks cover finite, nondegenerate UVs across all 69 recipes, consistent grain scale, longest-axis grain direction, and the five shared texture resources across all twenty finishes. Original maps are local assets totaling about 1.90 MiB, with an approximately 14.7 MiB RGBA/mipmap budget per renderer independent of piece count. Catalog thumbnails share the same maps. Visual evidence is in `artifacts/wood-materials.png`.

One-stud movement is browser-tested for cursor previews in both directions, elevation rounding, typed position edits, and native up/down controls on a thin tile with a fractional surface offset.

Floor-grid alignment is checked against every catalog footprint in three orientations, at positive and negative coordinates near and far from the origin. Actual browser mouse placement verifies tiny floors and rotated walls across a floating-origin shift. The grid shader shares the placement step. Visual evidence: artifacts/grid-alignment.png.

Camera regressions verify WASD and Q/E movement without mouse buttons, stable view direction and orbit target, stopping on key release or lost focus, continued movement after releasing mouse look, and no movement while typing, saving with Ctrl+S, or using a dialog.

Double-click moving is browser-tested for single-click selection, pickup without mutating the original, Escape cancellation, committed relocation with stable identity and finish, undo, empty-space clicks, rapid placement clicks, and orbit mode isolation.

The ground boundary rejects fully and partially buried blueprints using their rotated bounds. All catalog entries are checked for flush ground contact and small penetration in upright and tilted orientations. Browser checks cover red previews, negative elevation, rejected placement, rejected movement, numeric Y edits, and tilting a thin tile, with the original piece retained on rejection.

The collision fix additionally verifies full/partial intersection rejection, touching faces, stacking, thin tiles, negative chunk boundaries, rotation-aware bounds, moving-piece exclusion, red invalid previews, rejected placement clicks, and rejected numeric position edits. The permissive overlap toggle has been removed. Original objects remain unchanged when an edit is rejected.

The independently served production package was also checked: 69 catalog cards, 122 editable example pieces, successful placement followed by save/reload, no browser errors, no development debug API, and no horizontal overflow at 1024 × 768. Evidence is in `artifacts/package-check.json`.

## Connected plots and terrain

Connected land checks cover edge-only expansion, center protection, bridge removal, occupied plots, full-footprint coverage across seams and holes, rotation, movement, typed edits, undo/redo, export, reload, and invalid imports. The starter example fits the center plot. Walking tests cover the 0.1-stud terrain step in both directions and blocked head clearance. The plot/grid rendering regression samples actual framebuffer pixels across camera origin shifts, with the grid enabled and disabled.

The ground layer uses fixed-size shared resources. Screenshots and metrics are in `artifacts/plots-*.png` and `artifacts/plots-check.json`; the separate 840-view depth sweep is in `artifacts/terrain-depth-check.json`. Source and fidelity notes are in `docs/reference/land-plots.md`. The dense blueprint benchmarks below predate this terrain update.

## Measured performance

Environment: Windows, Chrome 154 headless using ANGLE / NVIDIA GeForce RTX 3050 Laptop GPU / Direct3D 11. Browser viewport 1920 × 1080, DPR 1, Balanced quality, adaptive resolution disabled. Measurements use an orbiting camera after warmup. The actual 3D viewport occupies the central panel, not the whole browser window. Each timing sample window is approximately three seconds.

| Scene | Total pieces | Resident pieces | Median frame | 95th percentile | Pointer pick |
|---|---:|---:|---:|---:|---:|
| Spread, repeated | 1,000 | 1,000 | 16.7 ms | 17.4 ms | 3.4 ms |
| Spread, mixed | 1,000 | 1,000 | 16.7 ms | 18.4 ms | 1.0 ms |
| Spread, repeated | 10,000 | 10,000 | 16.7 ms | 17.1 ms | 4.0 ms |
| Spread, mixed | 10,000 | 10,000 | 16.7 ms | 16.9 ms | 1.6 ms |
| Spread, repeated | 100,000 | 21,545 | 16.7 ms | 16.8 ms | 3.6 ms |
| Spread, mixed | 100,000 | 21,545 | 16.6 ms | 17.1 ms | 2.0 ms |
| Dense, mixed | 10,000 | 10,000 | 16.7 ms | 17.1 ms | 4.6 ms |
| Dense, mixed, stacked | 100,000 | 100,000 | 16.7 ms | 16.9 ms | 15.6 ms |

Approximately 60 FPS was sustained in these samples. Resident means present in GPU chunk batches; it does not mean every piece was visible or contributed pixels. Mixed fixtures cycle five geometry recipes and five wood finishes. They do not exhaust all 69 recipes or all possible camera views.

The spread results precede the ray-query optimization. The dense results include the classic material update: median frame time remained 16.7 ms compared with the immediate pre-update baseline, and draw calls remained unchanged at 650 and 1,412 for the two fixtures. The dense 100,000-piece scene submitted about 3.64 million triangles across main and shadow passes. Initial construction of its two successive fixtures took about 2.17 seconds and is synchronous. That startup time is not concealed in the steady-state FPS figures. Earlier ray-query optimization reduced dense picking from 119.6 ms to 13.9 ms; the latest sample measured 15.6 ms.

Raw measurements: `artifacts/benchmarks.json`, `artifacts/benchmarks-dense.json`, and `artifacts/materials-baseline.json`. The six-piece walk showcase also measured approximately 60 FPS; this is not a dense-scene walk benchmark. Browser heap values in the raw spread results are estimates, not total application/GPU memory. No mobile, integrated-GPU, Safari, or Firefox performance claim is made.

## Review fixes

A separate code reviewer found history notification timing, finish edits leaking from a duplicate preview to the original, and OrbitControls clamping an upward free-camera view. These were reproduced with failing tests and fixed. Additional checks caught catalog rows collapsing, stale inspector finish after undo, cabinet geometry extending beyond its footprint, and box placement penetrating a sloped support plane.

## Remaining limits and fidelity gates

- Exact LT2 pivots, fine geometry, rotation behavior, and snap increments have not been verified in a live LT2 client. The UI identifies reconstructed details; source coverage is in `reference/catalog-audit.json`.
- Walk mode reconstructs Roblox-style movement and a classic block character. Stairs use individual tread collision boxes; wedges and decorative furniture use conservative outer bounds. Ladder climbing and exact Roblox character physics are not implemented.
- The public wiki table and linked thumbnails were accessible through the browser during the fidelity audit. All 69 names, dimensions and wood requirements match an independent transcription. The 2022 thumbnail revisions establish visible reference forms, not certification of current-game accuracy.
- World records and spatial indices stay in RAM. Distant GPU chunks unload, but disk-paged world records and a distant overview proxy are not implemented.
- Saves are debounced, atomic whole-project IndexedDB snapshots with a preceding backup. Incremental chunk persistence and worker-driven large imports/exports are not implemented. Large file operations may briefly block input.
- The current graphics backend is WebGL 2. WebGPU fallback was deferred in favor of a single tested renderer.
- Collision checks are mandatory for new placement, moving, duplication, rotation, and numeric position edits. Checks use reference bounding volumes, so insertion into an empty space inside a fence or furniture frame may be conservatively rejected. Existing saved/imported projects are retained as authored; the fix does not delete or rearrange old overlapping pieces.
- Adaptive quality currently reduces resolution under sustained load; it does not automatically restore resolution. Selecting a quality preset resets it.
- The only file-size guard is a 256 MB import safety budget; there is no placed-piece cap; active land is limited to a 5×5 layout of 40×40-stud plots. Actual capacity depends on hardware and storage.
- The application is a static website with local and GitHub Pages deployment. Accounts, cloud project storage, cross-device synchronization, machinery simulation, and Roblox integration are not implemented.

## Compact HUD update

The canvas now fills the window, with overlay controls instead of permanent sidebars. Catalog selection closes the inventory, the edit panel appears only for placement/selection, and wood choices expand on demand. Project actions live in the corner menu. Tests exercise these visible UI paths, Escape layering, search focus, and unchanged canvas bounds when panels open. Compact layout checks cover 1024 x 768 and 390 x 844 desktop-browser viewports; this is not physical-phone or touch-gameplay acceptance. Screenshots: artifacts/hud-world.png, hud-catalog.png, hud-placement.png, and hud-mobile.png.

The earlier performance table used a smaller central viewport and predates this full-window layout; its frame rates are not a new full-screen benchmark.

## Blueprint fidelity audit

Twenty-nine recipes now follow the visible reference forms more closely: solid fences, broad corrugated boards, plain doors with round knobs, two/four-tread stairs, solid chair backs, simpler tables, cylindrical ladder rungs, open cabinets and an L-shaped wide corner, plus a recessed sink. Twenty-six incorrect wood requirements were corrected. Eleven new core cases cover these shapes and the independent 69-entry table. A browser case confirms that fixed hardware is shared across finishes and twenty sinks in one chunk remain one instanced mesh. Doors use two surface groups and sinks four; these add draws per item/finish/chunk, not per placed piece. No texture resources were added.

The full suite, production build and independently served portable-package check passed. The package check confirmed placement/reload, land expansion, both cameras, 69 cards, no browser errors and no development debug API. Historical FPS tables above predate these geometry changes and are not a performance benchmark of the revised recipes. See `reference/blueprint-fidelity.md` for estimates and live-client acceptance gaps. Before/after comparisons are in `artifacts/blueprint-comparison-structure.png` and `artifacts/blueprint-comparison-kitchen.png`.

## GitHub Pages publication

The production build was checked under `/lumber-building-simulator/`, including all nine texture responses, favicon, 69 catalog cards, placement, save/reload, land expansion and both cameras. The check reported no browser errors, no production debug API, and a fitting compact layout. The 60 core tests and TypeScript/Vite build passed. Evidence: `artifacts/pages-local-check.json`.

Only `dist/` is deployed as the site. Builds remain in browser storage; the public site and localhost have separate storage. The public branch starts from a clean snapshot with a public username and GitHub no-reply author identity; earlier local commit history is not published. Source text was checked for personal identity, user-directory paths and credential patterns, and images for personal metadata before publication.

## Blueprint detail follow-up

Six additional regressions cover continuous corner joins, fence-corner opening, door knob proportions/placement, ladder rung thickness/gaps, smooth cylinder normals, and upright wall/door grain. All 69 items now have direct thumbnail references, with exact measurements still explicitly distinguished from visual estimates. Comparison: `artifacts/blueprint-detail-comparison.png`.
