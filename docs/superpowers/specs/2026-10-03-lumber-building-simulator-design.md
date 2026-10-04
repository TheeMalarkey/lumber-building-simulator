# Lumber Building Simulator — first-release design

Date: 2026-10-03
Status: Approved for implementation. The delivered first version and remaining fidelity/scale gates are recorded in ../../VALIDATION.md.

## Purpose and agreed scope

Build a desktop-first 3D web editor for freely designing structures with Lumber Tycoon 2 blueprint pieces. Priorities, in order, are accurate pieces and placement, responsive interaction at large build sizes, and strong visual quality. The user selected blueprint construction pieces first and approved the proposed design direction.

The first release covers the obtainable blueprint catalog, including blueprint furniture, with all pieces available immediately. Conveyors, machinery, logic simulation, vehicles, harvesting, an economy, multiplayer, and Roblox import/export are outside this release. Export means this simulator's own project format. These boundaries preserve the user's immediate focus on building.

There will be no application-imposed piece count, plot size, or height cap. Hardware, browser storage, coordinate precision, and practical render distance still bound capacity. Never describe the application as literally infinite or promise a piece count without measurements.

Assumptions for this release: keyboard and mouse, one local user, modern desktop browser, and an expandable flat building environment. Mobile editing and cloud accounts are future work.

## Recommended approach

Use TypeScript, Vite, and Three.js, with the editor interface kept separate from the render loop. Use Three.js WebGPURenderer with its WebGL 2 fallback, validating both backends during implementation. If a required rendering feature fails the compatibility probe, use the stable supported path and document the outcome before adding effects.

A general-purpose game engine would be useful if physics and gameplay were central, but this release benefits from direct control of rendering and editor data. A custom graphics engine would add substantial work without improving catalog and placement fidelity by itself.

The application remains a portable static web build. A local development server provides previews; publishing or paid hosting is not part of this specification.

## Catalog and fidelity

Create a versioned catalog manifest separate from code. Each entry contains a stable ID, displayed LT2 name, category, dimensions in studs, geometry recipe, placement anchor, orientation rules, material regions, thumbnail recipe, reference sources, and verification status.

Categories follow the blueprint manager: Walls, Floors, Doors, Wedges, Furniture, and Other. Search finds names across categories. Cards show a rendered thumbnail and name; the selected item shows dimensions and its current wood finish. Thumbnails are generated once and cached, rather than running a separate live 3D scene for every card.

The community blueprint table is a research starting point, not a certified inventory. Its introductory count and table must be reconciled. Before claiming catalog completeness, maintain a coverage table mapping every obtainable blueprint to an implemented entry and reference. Unobtainable test assets are excluded and recorded as such.

Geometry must reproduce visible construction: corners are actual corner forms, wedges have the correct slope, and fences, stairs, doors, and furniture have their own shapes. Do not substitute a bounding box for a finished item. Repeated component meshes share geometry.

Keep evidence labels distinct:

- Reference documented: dimensions or appearance supported by a cited source.
- Observed: checked against an accessible gameplay reference or direct measurement.
- Approximate: a provisional reconstruction awaiting verification.

Any approximate item remains marked in the catalog audit and inspector. A playable preview may contain clearly marked approximations; final LT2 fidelity acceptance requires resolution of those gaps. No unsupported exact-match claim is permitted.

Wood finishes use shared materials with coherent grain direction, roughness, and color. Audit the available wood appearance references separately; do not present invented finishes as exact LT2 materials. Geometry accuracy takes priority over surface embellishment.

## Camera and interface

The viewport occupies most of the window. A collapsible left sidebar contains category tabs, search, and catalog cards. A compact inspector shows the selected piece, dimensions, wood, and transform. A top toolbar provides undo, redo, save/export, import, and view settings. A small status area displays saving state and optional performance statistics.

Right-mouse hold enables looking and flying with WASD; Q/E move vertically, Shift increases speed, and the wheel adjusts travel speed while flying. Release returns control to the editor cursor. F focuses the selected item. An optional orbit view helps inspect a building. Input handling must release held keys on window blur and never intercept typing in fields.

The empty project opens on a softly lit neutral ground with a subtle stud grid, sky, and a short control hint. The interface should remain readable at common desktop sizes and browser zoom levels without covering the placement target. Catalog selection must not accidentally place an object in the viewport.

## Placement and editing

Selecting a catalog piece enters placement mode with a transparent ghost. The cursor targets the ground or a nearby piece's surface. Rotate and tilt commands adjust orientation; repeated placement retains the chosen piece, finish, and orientation. Escape cancels placement. Validity is communicated through outline, color, and a short reason when placement is rejected.

Placement uses dimensions and anchors in stud units, not rounded display meshes. Verify LT2's translation increments, rotation and tilt steps, pivot offsets, surface-relative alignment, and overlap rules using observed examples before labeling this mode an LT2 match. Do not infer the complete placement algorithm from item dimensions alone.

The placement module isolates these rules from camera and rendering code so measured corrections do not require rewriting the editor. Use stable discrete coordinates for supported snap increments and canonical orientations where applicable; preserve any verified fractional offsets without accumulating floating-point drift. Any provisional rule is recorded in a placement evidence matrix.

Required reference cases include adjacent walls, stacked walls, inside and outside corners, thin tiles, floors against walls, wedges in each supported orientation, doors in openings, and placement on an elevated or rotated support. Compare the same cases after save and reload.

Clicking a placed item selects it. Support moving, duplicating, deleting, changing wood, and undo/redo. A move keeps the original until the replacement is committed; cancelling restores it. Editing and placement preview share the same snapping rules. Selection, ghost, and outlines render separately from static batches so moving the pointer does not rebuild the world.

A command history stores changes rather than whole-world snapshots. New edits after undo discard the redo branch. History has a memory budget independent of world size; exhausting that budget trims the oldest history and never deletes built pieces.

## World data and rendering

Separate modules own catalog definitions, world records, placement rules, editor commands, spatial queries, renderer batches, persistence, and UI. Rendering objects are derived from world records and are never the authoritative save format.

Each placed piece has a stable ID, catalog ID, position, orientation, and finish ID. Selection and history refer to stable IDs rather than GPU instance indices.

Partition the world into spatial chunks, initially 64 studs per axis, with indices for items whose bounds intersect multiple chunks. Choose batch ownership once per item and prevent duplicate rendering. Maintain a fast broad-phase spatial index so pointer targeting and overlap checks examine relevant candidates rather than scanning every piece each frame.

Batch repeated geometry and materials within chunks using instancing. Maintain explicit mappings between piece IDs and instance slots. Add, move, delete, undo, and recolor update only affected batches and bounds. Test deletion compaction so selection cannot silently switch to another item.

Cull chunks outside the camera view and unload distant GPU resources with hysteresis to avoid boundary thrashing. Apply a configurable visible range. Rehydrate nearby chunks incrementally; background loading must not freeze camera controls. Keep an inexpensive overview representation for distant occupied areas where useful. Build data remains saved when visual detail is unloaded.

Use a render origin near the camera and chunk-relative coordinates to limit visible precision errors far from the starting area. Document the numeric range of persisted coordinates. Large saved projects must support chunk loading so the complete world need not remain resident as render objects.

Placed construction is static. It does not receive a physics body or per-piece update callback. Offload expensive encoding and large import processing to a worker as needed. Cap outstanding work and cancel stale requests when the camera moves or a project is replaced.

## Visual quality policy

Retain LT2 proportions and recognizable silhouettes while improving lighting and clarity. Use consistent wood grain, sky/environment illumination, antialiasing, and restrained contact shading. Keep shadows near the camera with a bounded shadow workload. Do not create a light or a shadow map for each item.

Offer Performance, Balanced, and Quality presets plus explicit render-distance and resolution controls. Adaptive quality uses measured frame time and hysteresis to reduce expensive effects before input becomes sluggish. Users can lock quality. A quality adjustment never changes saved geometry or placement behavior.

## Saving and recovery

Use IndexedDB for versioned local project metadata and chunk records. Save dirty chunks with a debounced transaction and display Saving, Saved, or a clear failure state. Keep the previous consistent revision available until a new revision commits. On restart, detect and recover an interrupted save without silently dropping pieces.

Export a versioned project file containing catalog version, project metadata, chunks, and piece records. Import validates version, record types, finite transforms, valid orientations, known IDs, duplicate IDs, and file/resource size before replacing the active project. Reject unsupported future versions and unknown catalog IDs with a precise explanation; leave the current project and original import file intact. Never silently discard unknown pieces.

An import error leaves the current project intact. Confirm replacement when the current project has unsaved changes. Storage quota failures retain edits in memory, stop reporting Saved, and offer export. Large imports and exports show progress and allow cancellation without corrupting the project.

## Performance and correctness acceptance

Record browser version, renderer backend, GPU, viewport size, device pixel ratio, quality preset, visible-piece count, and total-piece count with each benchmark. Results on the development machine do not certify every device.

Measure 1,000-, 10,000-, and 100,000-piece fixtures. The first two are routine acceptance scenes; 100,000 is a stress investigation, not a guaranteed capacity. Include both repeated pieces and mixed catalog/material scenes, dense visible construction, and a large spread-out world. A single hidden or repeated-object fixture cannot establish general capacity.

The initial performance target is a 60 FPS median with 95th-percentile frame time below 25 ms during a repeatable camera path through the 10,000-piece fixture on the recorded development desktop at 1920x1080, device pixel ratio 1, Balanced quality. Target visible placement feedback within 50 ms. Report achieved values and any failed target rather than redefining a test until it passes.

Track draw calls, triangles, CPU frame time, available GPU timing, estimated resource memory, placement/selection latency, save duration, and loading time. Browser memory estimates must be labeled as estimates. Verify that distant saved construction does not create proportional per-frame work.

Automated checks cover geometry bounds against catalog dimensions, snapping and orientation cases, chunk queries across boundaries, stable selection after instance deletion, command history, project round trips, invalid imports, and interrupted saves. These tests verify the editor's rules; observed gameplay comparison separately verifies LT2 fidelity.

Real browser acceptance covers camera and focus controls, catalog interaction, repeated placement, moving/cancelling, deleting, undo/redo, wood changes, saving/reloading, import/export, resizing, backend fallback, and recovery after input focus loss. Inspect screenshots for materials, shadows, grid clarity, outlines, and clipping. Compilation alone does not establish visual or interactive acceptance.

## Delivery sequence

1. Reconcile the blueprint inventory and establish the catalog/placement evidence matrices. Record unresolved fidelity gaps explicitly.
2. Validate the renderer and interaction architecture with representative walls, corners, tiles, and wedges plus measured scaling fixtures.
3. Complete the obtainable blueprint catalog and placement behavior using the same data-driven path.
4. Complete editing, persistence, recovery, and file interchange.
5. Refine visual quality, run the benchmark matrix, and deliver the portable build with a verified local preview.

Each stage preserves the full first-release objective. An early preview is a milestone, not a claim that the complete catalog or simulator is finished. If exact reference evidence is unavailable, continue independent editor work and request only the missing evidence needed to close fidelity gaps.

## References and limitations of current research

- Blueprint names, dimensions, and categories: https://lumber-tycoon-2.fandom.com/wiki/Blueprints
- Blueprint manager categories: https://lumber-tycoon-2.fandom.com/wiki/Blueprint_Manager
- Instancing behavior: https://threejs.org/docs/pages/InstancedMesh.html
- WebGPU and WebGL 2 fallback: https://threejs.org/docs/pages/WebGPURenderer.html

Research on 2026-10-03 retrieved indexed excerpts from the community wiki; direct page access was blocked. The blueprint count, full geometry, wood appearance, and exact placement rules have not yet been independently certified. Three.js documentation confirmed instancing and backend fallback support, but those features do not establish application performance until measured.
