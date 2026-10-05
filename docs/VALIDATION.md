# Validation — 2026-10-04

## Implemented and checked

- 69 unique reference blueprints: 24 walls/fences, 8 floors/tiles, 3 doors, 22 wedges/stairs, 10 furniture, 2 other pieces. Every recipe produces finite geometry within its reference footprint.
- Twenty named wood finishes using Roblox's published classic material maps where appropriate. Lighting, tint response, and material parameters remain approximations; see `docs/reference/wood-materials.md` for provenance.
- Browser-tested catalog filtering/search, repeated placement, rotation, finish changes, numeric transforms, deletion, toolbar and keyboard history, reload and file export.
- Regressions cover finish changes while duplicating, cancelling a duplicate, upward free-camera release, and held keys on focus loss.
- Valid imports, malformed imports, recovery from a corrupted latest save, and storage failure with the live scene retained for export were tested in isolated browser contexts.
- Source test assertions cover thin geometry, rotated extents, oblique support planes, stable IDs, history notification timing, ray candidates across negative chunk boundaries, and project validation.

The automated suite contains 93 core tests and 48 browser scenarios. Verification for each update is recorded below. `npm run build` also passed. Run `npm test`, `npm run test:browser`, and `npm run build` to reproduce. Desktop screenshots are in `artifacts/editor-desktop.png`.

Rotate and Tilt compose world-axis quarter turns, so turning before tilting can tip a blueprint sideways. Tests prove all 24 distinct right-angle orientations are reachable and four turns restore the original pose. Browser coverage includes preview keyboard controls, placed-piece toolbar edits, undo/redo, and saved orientation reload. Existing Euler-based files remain compatible.

Walk camera checks cover grounded spawning, camera-relative movement, jump/landing, walls, ceiling contact, stairs, camera obstruction, first-person zoom, mode switching, and input focus isolation. A regression prevents spawning beneath ceilings that would intersect the classic head mesh. The animated R6-proportioned avatar is local to the camera and is excluded from saved blueprints. Dimensions were checked against Roblox's bundled R6 mannequin; see `docs/reference/walk-avatar.md`. Visual evidence is in `artifacts/walk-camera.png` and `artifacts/visual-check.json`.

Texture checks cover finite, nondegenerate UVs across all 69 recipes, consistent grain scale, longest-axis grain direction, and the five shared texture resources across all twenty finishes. Original maps are local assets totaling about 1.90 MiB, with an approximately 14.7 MiB RGBA/mipmap budget per renderer independent of piece count. Catalog thumbnails share the same maps. Visual evidence is in `artifacts/wood-materials.png`.

One-stud movement is browser-tested for cursor previews in both directions, elevation rounding, typed position edits, and native up/down controls on a thin tile with a fractional surface offset.

Floor-grid alignment is checked against every catalog footprint in three orientations, at positive and negative coordinates near and far from the origin. Actual browser mouse placement verifies tiny floors and rotated walls across a floating-origin shift. The grid shader shares the placement step. Visual evidence: artifacts/grid-alignment.png.

Camera regressions verify WASD and Q/E movement without mouse buttons, stable view direction and orbit target, stopping on key release or lost focus, continued movement after releasing mouse look, and no movement while typing, saving with Ctrl+S, or using a dialog.

Double-click moving is browser-tested for single-click selection, pickup without mutating the original, Escape cancellation, committed relocation with stable identity and finish, undo, empty-space clicks, rapid placement clicks, and orbit mode isolation.

The ground boundary rejects fully and partially buried blueprints using their rotated bounds. All catalog entries are checked for flush ground contact and small penetration in upright and tilted orientations. Browser checks cover red previews, negative elevation, rejected placement, rejected movement, numeric Y edits, and tilting a thin tile, with the original piece retained on rejection.

The collision fix additionally verifies full/partial intersection rejection, touching faces, stacking, thin tiles, negative chunk boundaries, rotation-aware bounds, moving-piece exclusion, red invalid previews, rejected placement clicks, and rejected numeric position edits. The original permissive overlap toggle was removed in that fix; the explicit, default-off option below supersedes that behavior. Original objects remain unchanged when an edit is rejected.

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
- Walk mode reconstructs Roblox-style movement and a classic block character. Walking and follow-camera collision now use model components, including ramps, stair treads and furniture openings. The player body remains a simple volume. Ladder climbing and exact Roblox character physics are not implemented.
- The public wiki table and linked thumbnails were accessible through the browser during the fidelity audit. All 69 names, dimensions and wood requirements match an independent transcription. The 2022 thumbnail revisions establish visible reference forms, not certification of current-game accuracy.
- World records and spatial indices stay in RAM. Distant GPU chunks unload, but disk-paged world records and a distant overview proxy are not implemented.
- Saves are debounced, atomic whole-project IndexedDB snapshots with a preceding backup. Incremental chunk persistence and worker-driven large imports/exports are not implemented. Large file operations may briefly block input.
- The current graphics backend is WebGL 2. WebGPU fallback was deferred in favor of a single tested renderer.
- Overlap checks are enabled by default for new placement, moving, duplication, rotation, and numeric position edits. Players can opt into Allow overlaps; ground and active-land limits remain mandatory. Spatial and outer-bounds filtering is followed by convex component checks derived from the rendering recipes. Touching faces and open furniture spaces remain usable. Ground and active-plot checks still require the full blueprint bounds to fit. Existing saved/imported projects are retained as authored; the fix does not delete or rearrange old overlapping pieces.
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

## Multiple blueprint selection

Ctrl-click toggles individual pieces, and Ctrl-left-drag adds intersecting blueprint bounds within view distance, including occluded pieces. The camera pauses during the gesture; Escape, focus loss, and pointer cancellation abandon the rectangle. Plain clicks and existing double-click pickup retain their single-piece behavior.

Six browser scenarios and five core cases cover additive/reversed rectangles, toggle selection without accidental pickup, orbit isolation, group move/copy/delete, retained offsets/rotations/finishes, collision rejection, full-group ground and plot validation, cancellation, one-step history, and saved group copies. A 200-piece rendering check verifies one combined outline buffer and two preview instance batches for two blueprint types. This checks batching, not a new large-scene FPS benchmark. Rectangle queries run only on release, and unchanged outline geometry is reused.

Visual checks: `artifacts/group-selection.png`, `artifacts/group-selection-drag.png`; reproduce with `node scripts/verify-selection.mjs`. Group rotation, tilt and finish editing were added in the follow-up below; numeric coordinate editing remains single-piece. The separate production check (`node scripts/verify-selection-live.mjs`) imports a fixture through the UI, exercises the controls without a debug API, and checks exported positions, rotations, finishes, and independent copy IDs.

## Jump pose correction — 2026-10-04

The airborne limb angles now respect the avatar's local forward direction: hands rise in front of the shoulders and feet trail behind. Four regressions check actual limb endpoints during ascent and descent at each cardinal heading, plus return to idle after landing. All 75 core tests, both walk browser scenarios, and the production build passed. A Space-key jump was also inspected in the rendered browser scene. Jump speed, gravity, collisions, and the walking cycle are unchanged.


## Axis movement and shape collision — 2026-10-04

Selected blueprints and groups now expose labeled X/Y/Z drag arrows. Drags use world axes and one-stud increments while retaining fractional surface offsets. Invalid destinations are previewed in red and rejected on release. Escape, focus loss and pointer cancellation discard a drag; each accepted move creates one history action. Arrows keep a consistent screen size across camera distances and use absolute-world picking alongside the floating render origin. The six optional movement buttons and single-piece coordinates are collapsed by default.

Hold a placement with L to stop surface following and adjust it with the arrows before choosing Place here. Held copies allow repeated up-one/across-one construction without temporary supports. Surface snapping uses support vertices from the actual model components. Collision checks share these same components with walking and the follow camera, preserving wedge slopes, stair treads and furniture openings. Cylinders use their rendered polygonal hulls; the recessed sink bowl uses thin triangle shells. Spatial and bounding-box rejection precede precise checks, and transformed hulls are cached for at most 1,024 pieces.

Eleven additional core regressions cover complementary wedges, rotated slope clearance, stair-tread contact, furniture openings, ramp walking and camera clearance. Nine additional browser scenarios cover the arrow controls on all axes, single/group edits, one-step history, ground/plot/overlap rejection, cancellation, held copies, camera isolation, floating-origin alignment, fallback buttons and compact layout. All 86 core tests, 40 browser scenarios and the production build passed. The separate production UI check imports a fixture, builds three raised steps, fits complementary wedges by dragging an arrow, and verifies exported positions without a development debug API. Reproduce with `node scripts/verify-precision-live.mjs`; screenshot: `artifacts/precision-building.png`.

A focused CPU sample with 2,000 stored mixed blueprints measured approximately 0.1 ms median and p95 for physics plus follow-camera collision over 210 warm samples. The character reaches an obstacle during this sample; these are not moving-through-dense-scenes or whole-frame FPS results. Historical rendering benchmarks above predate these changes. Physical touch devices and exact live LT2 snapping remain unverified.


## Group rotation, tilt and wood — 2026-10-04

Rotate/R and Tilt/T now turn each selected blueprint's position and orientation around the assembly bounds center. The existing world-axis quarter-turn behavior and save format are retained. Placed selections validate every candidate against outside blueprints, the ground and active plots before one combined history action; any failure leaves all members untouched. Move/copy previews retain their adjusted orientations and finishes when the pointer changes surfaces, and cancelling them preserves the originals.

The wood picker applies a chosen finish to every selected blueprint in one undoable edit. Mixed finishes show Mixed woods with no active swatch; undo restores each member's previous wood. Single-piece editing remains available. Numeric coordinates remain single-piece controls.

Four core cases cover all three rotation axes, unchanged originals, per-member orientation composition and four-turn restoration with fractional offsets. Six browser cases exercise group rotate/tilt, atomic rejection, mixed finish display, one-step undo/redo, save/reload, transformed and recolored copies, cursor-following previews and held moves. The separate production check verifies visible controls and exported poses without a development API, including compact-screen layout. Reproduce with `node scripts/verify-group-edit-live.mjs`; screenshot: `artifacts/group-editing.png`. Group calculations run only when editing; no additional per-frame simulation or render batches were added.

All 90 core tests, 46 browser scenarios, the production build and the separately served production group-edit check passed.


## Optional blueprint overlaps — 2026-10-04

The blueprint panel now has an Allow overlaps checkbox, switched off by default. Enabling it bypasses only inter-blueprint placement checks, so all existing movement, rotation, duplication and group-edit paths share the same behavior. Ground and active-plot validation run before that bypass. Retained single/group previews refresh immediately when the toggle changes. Switching it off keeps existing objects intact and restores blocking for subsequent edits. This is a session preference rather than project data or an undo action; reloading starts with overlap protection enabled.

All 93 core tests and nine focused browser checks passed, along with the production build. New cases cover default blocking, opt-in intersection, preserved builds, full ground/plot limits, group rotation/movement, live preview color and compact controls. A walking regression confirms the option does not disable character collision. The separately served production check uses visible controls to place an exact overlapping copy, restores blocking, verifies exported positions and undoes the placement. Reproduce with `node scripts/verify-overlap-live.mjs`.

## Straight drag only — 2026-10-04

The curve update was narrowed to straight drag placement. Build mode now offers only Single piece and Straight drag. Ctrl-left-drag starts a run while building; normal Select mode retains Ctrl-click and rectangle selection. Fill span places at one-stud spacing through the endpoint. Runs preserve the selected blueprint, pose and wood, validate the full batch against collision/ground/active plots, and commit as one undo action. Held previews can be adjusted with their existing XYZ arrows in either mode before dragging a run in the air. Invalid runs can be retried, cancelled, or committed after changing fill/overlap options.

Curve generators, clicked control points, point editing, smart-wedge modes and their controls were removed. Existing project files and IndexedDB snapshots with fractional orientations remain compatible, including rotation, model collision and actual bounds. A broad rollback initially rejected those saves; compatibility checks now confirm that they load and save unchanged. Completed held runs also restore the retained single-piece preview instead of leaving invisible placement handles.

All 102 core tests and all 57 browser scenarios passed, as did the production build. New regression checks cover drag generation and atomic validation, held-gizmo input ownership, preview visibility after a run, the restricted mode list, compact controls, and current-snapshot save/reload. The separately served production check uses visible controls with no development API to verify Ctrl drag, one-step undo/redo, fill validation, save/reload, older-pose imports and absence of curve controls. Reproduce with `node scripts/verify-drag-live.mjs`. The overlap production check also passed.

Drag updates coalesce to animation frames and reuse unchanged previews. Blueprints remain instanced and the straight guide uses one draw call. These checks establish behavior and batching; no new large-scene FPS benchmark or physical-device acceptance was performed.

## Surface drag building and axis copies — 2026-10-04

Straight runs now follow the face where the drag starts, including blueprint tops, vertical sides, rotated walls and wedge slopes. The face plane stays fixed for the gesture, allowing a run to continue beyond the original face. Snapping preserves stud increments along the face's grid axes and solves the support axis for flush contact. Elevation stays consistent from the starting piece through the endpoint. Held previews retain horizontal air-building behavior. The complete run still passes collision, ground and active-plot checks before a single history action.

Copy with arrows is available for single and multiple selections and starts off by default. A successful X/Y/Z drag creates independent IDs, keeps all originals unchanged, and selects the copies for repeated drags. Escape, focus loss and invalid destinations leave the originals intact. Copies check the originals as obstacles unless Allow overlaps is enabled; ground and plot limits always apply. A handle click without movement creates no copies or history. Copy with arrows is a session preference, while step buttons and numeric fields retain their movement behavior.

All 104 core tests, all 69 browser scenarios and the production build passed. Twelve new browser scenarios cover surface contact and vertical extension, elevation, below-ground batch rejection, single/group copies, repeated copies, original preservation, collision/land checks, cancellation, grouped undo/redo, compact controls and unchanged-preview work counts. The two added core regressions cover sloped surface snapping and internal overlap checks independent of a group's original ground/plot position.

The separately served production UI check imports fixtures, builds on blueprint tops and wall sides, uses elevation, creates single/group axis copies, checks exported positions and unique IDs, undoes/redoes, saves/reloads and checks the compact layout without a development API. Reproduce with `node scripts/verify-surfaces-live.mjs`. The production straight-drag compatibility check also passed.

Copy previews cache internal group intersections once per gesture and skip validation and redraw for unchanged snapped positions, with invalidation when world revision or overlap settings change. Every copy commit validates the full final batch again. This removes repeated internal batch construction while retaining destination checks. Existing spatial scanning and large-group preview costs remain; no new whole-frame FPS benchmark or physical-device acceptance was performed.

## Glass building pieces — 2026-10-04

The catalog now contains 74 pieces: the previous 69 wood blueprints plus Tiny, Small, regular and Large Glass Panes and the Glass Door. Panel dimensions follow the community glass table, reordered upright. The panes are frameless and 0.2 studs thick; the door has a fixed dark round knob. Knob measurements, tint and material response are explicitly documented as thumbnail-derived estimates in [the glass reference](reference/glass.md).

Glass uses one shared untextured translucent material, retains instancing across legacy wood-field values, and does not cast an opaque rectangular shadow. The door knob uses the existing opaque hardware material. Broad bounds include its 0.7-stud depth; precise collisions retain clearance beside the knob. Single and mixed-group wood edits preserve fixed glass finishes. Existing save records are compatible and new glass records use the existing project format.

All 107 core tests and 71 browser scenarios passed, along with the production build. New checks cover all five dimensions, frameless pane geometry, knob bounds and precise clearance, import/export compatibility, fixed materials, mixed recoloring, group copying, undo/redo and persistence. Twenty panes with differing stored wood values share one instance batch. This verifies batching, not an FPS capacity claim.

The production UI check also passed after the catalog badge was made dynamic: all five cards and the 74-piece total, glass placement, fixed finish controls, axis copying, rotation/tilt, undo/redo, save/reload and compact layout. It uses an isolated browser context without a development API. Reproduce with `node scripts/verify-glass-live.mjs`; visual evidence: [glass catalog and scene](../artifacts/glass-building.png). No browser errors were reported. Transparent-instance sorting and animated door operation remain outside this change; see the reference notes for the rendering limitation.


## Store furniture — 2026-10-04

Added nine fixed-finish furnishings, bringing the catalog to 83: Armchair, Loveseat, Couch, Single Bed, Twin Bed, Toilet, Refrigerator, Stove and Dishwasher. Inspected each unboxed reference image plus seating and dishwasher showroom photos. Dimensions are explicitly estimates and carry an approximate marker in catalog and selection UI; see [source and reconstruction notes](reference/store-furniture.md).

Production build and 110 core tests passed. The full 72-scenario browser suite passed; after final rounded-arm, water-level and approximate-label refinements, the furniture browser scenario and core suite passed again. New checks cover all nine catalog IDs, save/import round trips, geometric bounds and triangle budgets, empty seat/under-bed/bowl collision space, fixed finishes and shared instancing. The browser scenario verifies group copying and rotation/tilt for seating, undo/redo, all-nine persistence, and compact controls. Twenty couches with alternating saved wood values occupy one instance batch. Independent review found no actionable defects and checked component convexity and face orientation.

The isolated production UI check passed without the development API: imports all nine, verifies catalog names/count, fixed-finish controls, refrigerator axis copying, rotation/tilt, undo/redo, save/reload and compact layout. Reproduce with `node scripts/verify-furniture-live.mjs` (default local production port 5179; override TIMBER_URL for Pages). Visual evidence: [catalog](../artifacts/store-furniture.png), [all nine models](../artifacts/store-furniture-scene.png). No whole-scene performance claim or live LT2 measurement acceptance is implied. Appliance opening and avatar sitting are not implemented.


## Lighting and Worklight refinement — 2026-10-04

Added five fixed-finish working fixtures, bringing the catalog to 88. Reference images informed their silhouettes, fabric shades, mounting hardware and Worklight reflector/stand. Dimensions and light response remain estimates; see [lighting references](reference/lighting.md).

114 core tests, the full 73-scenario browser suite and production build passed. After Worklight refinement, the focused lighting browser scenario passed again. Coverage includes saved boolean state, undo/redo, indexed bounded light allocation, rotations and floating origin, mixed toggles, copied disabled lights, reload, night preview and compact layout. Review identified the Worklight housing obscuring its reflector; the housing was recessed and a raycast regression now verifies reflector visibility. Rounded stand elbows use convex collision proxies.

The isolated production UI check passed without the development API: catalog/count, import, fixed finish, toggle, axis copying, rotate/tilt, undo/redo, persistence and compact controls. Reproduce with node scripts/verify-lighting-live.mjs; set TIMBER_URL to test another deployment. Visual evidence: [Worklight detail](../artifacts/worklight-detail.png) and [night scene](../artifacts/lighting-night.png). Rendering uses a fixed pool of two point and four spot emitters with cached shadows; these checks establish behavior, not a large-scene FPS result or exact live-game fidelity.


## Walking near lights: disappearing surfaces — 2026-10-04

Reproduced the reported grid-only scene with a single Worklight. Unassigned, zero-intensity light-pool slots still participated in the shadow shader but had no depth texture. WebGL rejected shaded draw calls with a texture-format/shadow-sampler mismatch. Initialize missing shadow maps for every pool slot before rendering; already initialized maps remain cached.

The new browser regression failed before the fix with GPU errors and passed afterward. All five fixtures now pass walking, quality-switch and leave/return range checks with GPU and JavaScript error capture. All 114 core tests, eight focused lighting/walking browser scenarios and the production build passed. The isolated production UI check also passed with a single Worklight, walk mode and no GPU errors: scripts/verify-lighting-walk-live.mjs. This is a rendering correction; builds and light state are unchanged.

## Basic logic and 3D wiring — 2026-10-04

Added 12 reference-based logic components and editable socket/segment wires. Boolean truth tables, shared bidirectional networks, exact scheduled button/delay edges, sustain retrigger, stable and unsettled feedback, pressure-plate walking contact and wired light control are implemented. Saved switches/settings and wire routes participate in project import/export, local saves, undo/redo, group moves and group copies. Sources, estimated measurements, behavior assumptions and deferred advanced components are documented in [the logic reference](reference/logic.md).

All 140 core tests pass, including 26 logic regressions. The 81-scenario browser run found an outdated catalog-count assertion and an unnecessary empty wire field in older project exports; both were corrected and the six affected/focused scenarios passed. The three logic browser scenarios passed again after the final geometry/cache refinements. This covers real socket clicks, powered lights, save/reload, deletion/undo, pressure-plate walking, mode transitions, all 12 models, visible timer faces and compact controls. Independent review's long-chain, runtime-reset, copied-route, shared-net, feedback-constant and moving-junction findings were reproduced and fixed. A 600-gate acyclic chain now settles without false feedback. Timer-face visibility is also guarded by a raycast test.

Production TypeScript/Vite compilation passes. The isolated production check uses the visible UI with no development API to verify the 100-item total, 12 logic cards, socket wiring, lever-to-inverter-to-Worklight behavior, disabled manual control on wired lights, saved state, export/reload, deletion/undo and compact Wire-mode exit. Reproduce with `node scripts/verify-logic-live.mjs`; override `TIMBER_URL` for Pages. No JavaScript or WebGL errors were reported. Images: [circuit](../artifacts/logic-circuit.png), [all models](../artifacts/logic-gallery.png), [timer detail](../artifacts/logic-timers.png).

Topology is cached for switch-only edits; acyclic components use a compiled dependency order, while actual feedback has a bounded solve budget. Wire transforms are retained during signal-only changes, and gate meshes share geometry across on/off states. Logic state does not write project history each frame. These checks establish behavior and batching, not a new large-scene FPS guarantee. Live LT2 timing/measurement acceptance and physical-device testing remain outstanding.

## Logic model fidelity correction — 2026-10-04

Corrected the lever using the user's Circuit Workbench top-down states and the unboxed game references: narrower mounting plate, thick base, crosswise hinge/grip, broad flat stem and opposing on/off positions. Also corrected button proportions, timer roof chamfers and face details, gate arrows/rear-symbol direction, pressure-plate board joints and fixed surface finishes. Matching neutral before/after views are stored in `artifacts/logic-models-*-before.png` and `artifacts/logic-models-*-after.png`; `artifacts/logic-lever-world.png` shows both poses under scene lighting. The visual review checks visible features; it does not establish exact Roblox dimensions.

All 146 core tests and the production build pass. Ten focused browser scenarios passed for wiring, source controls, timer/gallery rendering, legacy import/repeated saves, storage recovery and walking near each light fixture. After the final collision/picking refinements, all four logic browser scenarios passed again, including picking the visible ON grip above the base. The separately served production UI check also passes with no debug API, JavaScript or GPU errors; it verifies migrated lever height, the model revision marker, real socket wiring, controlled Worklight state, export/reload and delete/undo.

Independent review reproduced and helped resolve legacy edge-placement migration, state-dependent land bounds, tilted snapping and lighting-indicator orientation issues. Follow-up read-only checks covered 134 rotation/state snapping cases and legacy placements at both interior and outer map edges. Physical lever collisions and picking use the visible pose; placement/surface support reserve the union of both poses so switching cannot invalidate the build. Material/geometry sharing and instanced batching remain in use. No new large-scene FPS or physical-device claim is made.

## Wire and mixed multi-selection — 2026-10-04

Ctrl-click toggles individual wires alongside blueprints, and Ctrl-drag adds route segments intersecting the selection rectangle. Wire-only and mixed groups support batch deletion, duplicate, move, rotation, tilt, held placement and XYZ arrows. Circuit copies retain internal socket connections, free routes, neon colors and collar orientations. Explicitly selected wires attached to an unselected device receive free ends in the copied group. Deleting components still preserves unselected leads; moving components does not promote their attached wires into the explicit deletion selection. Each completed batch edit uses one undo action.

All 197 core tests, the 54 focused browser checks and the production build pass. Fifteen new core cases cover transformed routes, copied sockets and power, exact-limit diagonals, upright ground placement, grandfathered imports, collision/land checks, atomic history and route-frustum clipping. Six new browser cases cover Ctrl-click toggles, forward/reverse rectangles, mixed deletion, wire-only held copies, mixed arrow copies with working signals and unselected-lead preservation after moving a component. The earlier 46-scenario selection/gizmo/logic/wiring regression also passed.

Production acceptance passed through public import/export and controls, with no development API: `node scripts/verify-wire-selection-live.mjs` checks group selection/deletion, independent circuit copies and powered copied lamps, grouped undo/redo, save/reload and 390×844 control layout. `node scripts/verify-wires-live.mjs` also passed for existing wire placement, overpasses, end-only power, individual deletion and preserved disconnected routes. Both capture JavaScript and WebGL errors; none were reported. Screenshots and machine-readable outcomes are generated under `release/pages-verification`.

Review findings about upright ground clearance, legacy-route editability, inadvertent lead selection and exact-limit rounding were reproduced with failing tests and corrected. Preview anchor maps now contain only the assembly and referenced sockets; each pointer update validates once. A core test rejects full-world iteration during loose-wire bounds/placement/validation. Selection highlighting retains the shared wire batches; previews add at most three temporary batches and no lights. These checks establish bounded preview work and behavior, not a new whole-scene FPS or physical-device guarantee.
