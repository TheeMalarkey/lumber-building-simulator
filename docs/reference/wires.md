# Placed wires and neon wires

References inspected 4 October 2026. These are original reconstructed meshes, not extracted game assets. The coiled **THUMBbasicwire** image is packaging artwork and is **not** a placed-wire model reference.

## Evidence and limits

| Reference | Used for |
| --- | --- |
| [Wire article](https://lumber-tycoon-2.fandom.com/wiki/Wire) | Explicit 20-stud maximum, dark gray/off and blue/on, cylindrical body with enlarged ends, bidirectional signals |
| [Placed wires on land](https://lumber-tycoon-2.fandom.com/wiki/File:Screenshot_2025-06-08_224055.png) | Actual placed cylinders and wider ends; replaces the misleading coil thumbnail as the geometry reference |
| [Neon Wires](https://lumber-tycoon-2.fandom.com/wiki/Neon_Wires) | 16-unit maximum, thicker body, Really black plastic while off, named BrickColors while on; Violet has no bloom |
| [Powered neon in the game](https://lumber-tycoon-2.fandom.com/wiki/File:Neon_Wires_Full_Graphics_Settings.png) | Straight installed tubes beside levers, relative thickness, color and glow |
| [Bright Gift](https://lumber-tycoon-2.fandom.com/wiki/Bright_Gift) | Pink neon released in the 2025 gift |
| [Roblox's published BrickColor palette](https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/engine/datatypes/BrickColor.yaml) | RGB values below |

The wire article's floor-count analogy conflicts with its stated maximum; this implementation uses the explicit **20 studs**. Limits apply to the sum of all straight segments, including bends. This interpretation and the precise placement gestures still need comparison against a live LT2 client. No undocumented bend-count restriction is presented as a game rule.

| Neon | BrickColor | sRGB |
| --- | --- | --- |
| White | Institutional white | `#F8F8F8` |
| Red | Really red | `#FF0000` |
| Orange | Neon orange | `#D5733D` |
| Yellow | New Yeller | `#FFFF00` |
| Green | Lime green | `#00FF00` |
| Cyan | Toothpaste | `#00FFFF` |
| Blue | Really blue | `#0000FF` |
| Violet | Eggplant | `#7B007B` |
| Pink | Hot pink | `#FF00BF` |

Tube diameters **0.20 regular / 0.24 neon**, collar diameters **0.28 / 0.30**, and 0.14-stud collar lengths are visual reconstruction estimates, not measured Roblox part dimensions. Regular wire thickness was corrected using player feedback; the accepted neon dimensions are unchanged. Endpoint collars extend inward so routing coordinates remain the ends of the wire. Regular powered blue is visually estimated. Neon uses the published palette, but different rendering and lighting engines prevent exact screen-color parity.

## Placement and editing

Choose **Wire** on the toolbar, then **Wire** or **Neon** and a neon color. Click a surface or socket to start. Surface clicks add points in 3D, including walls and sloping blueprint faces. Click another socket or existing wire to finish. **Shift-click an existing wire** to add a bend on its outside surface and continue building an overpass. For decorative or surface-ended routes, click the last surface point and press **Enter** or **Finish wire**. Clicking the same final point again also finishes. **Backspace** removes the last point; **Escape** cancels the unfinished route, then exits the tool. In **Select** mode, click a wire to highlight that individual route, then press **Delete** / **Backspace** or use **Delete wire**. **Escape** or **Done** clears the selection. Visible tubes, end caps and bends are selectable; a wire behind a blueprint is occluded. Wire mode also retains its **Delete selected wire** action.

The live meter measures the entire route. Invalid previews are red and cannot be placed. New tubes stay above the plot and inside active plots; routes crossing an unowned corner are rejected. Wires can rest on other wires, but tubes, bends and end caps cannot penetrate them. This applies even when blueprint overlap is enabled, and includes typed wire moves and copies. Separate leads may meet within a shared component socket; this never permits coincident runs beyond that connector. Points snap to the outside of a wire, preferring its upper surface; vertical wires use the visible side. Placement is independent of the blueprint's one-stud grid. No automatic curve or obstacle-routing system is added: the builder chooses the bends.

Sockets and wires have screen-space snapping. Other blueprints occlude the target. The socket markers intentionally allow selecting the far socket on its own component, consistent with this editor's existing wiring aid. **Only touching end caps share power between wires**, in either direction. A body resting on another body, or an end resting on a body, does not connect electrically. This corrects the earlier endpoint-to-segment assumption using player feedback. Contact uses the actual collar shapes with 0.006-stud tolerance, including the 0.005-stud surface placement clearance. It does not bridge visible gaps based on endpoint radii alone. The corrected contact rule applies to loaded projects too; old body junctions must be reconnected at the ends.

In **Select** mode, **Ctrl-click** toggles a wire or blueprint in the selection, and **Ctrl-drag** adds both types to the group. Wire drag-box tests use the actual route segments rather than the empty interior of a bent route's bounding box. **Delete / Backspace** and the panel's delete button remove all selected objects in one undo action. **G / Move**, **Ctrl+D / Duplicate**, **R / Rotate**, **T / Tilt** and the X/Y/Z arrows work for wire-only and mixed groups. The wire panel also offers **Copy with arrows**.

Copying selected components includes their internal wiring and end-connected free routes. Explicitly selected wires are added once, including decorative routes; socket references are remapped to the new components. A selected wire leading to an unselected component copies with a free end at that socket's position. Moving a wire without its component likewise releases that endpoint. Types, colors, bends and collar orientations stay with the group. Moving components does not silently select their attached wires.

Deleting a circuit component leaves its **unselected** connected wires exactly where they were, with the removed socket converted to a free end. The other endpoint, bends, type and color stay intact. Undo restores the component and socket connections together; redo, save and reload preserve the detached routes. Select the wires too to delete a complete circuit group.

New wire types and colors persist in `.timber` export/import, local saves, group copies and history. Rigid connected assemblies carry their routes and the orientation of their collar faces, so rotating or tilting does not break a touching connection. Moving an individual connected component cannot stretch a new wire beyond its budget; invalid moves leave history and the original pieces unchanged. Plots containing new wire routes cannot be deactivated. Legacy untyped routes load unchanged even if they predate length limits or ground clearance. Imported oversized typed routes may move rigidly or shorten, but cannot become longer.

## Rendering and performance

Three instanced batches draw cylinders/collars, bend joints and soft neon halos. Multi-selection highlights share those batches. Move/copy previews add at most three temporary batches and no scene lights; their anchor lookup includes only selected components and referenced sockets, without copying unrelated scene pieces. Unchanged arrow positions skip repeated validation and redraw. Rendering, collision and contact share the same geometry recipe. Spatial buckets restrict overlap and end-contact checks to nearby candidates; detailed collision meshes have a bounded cache. The collision index and circuit topology are reused across power changes. Neon switches from shaded black plastic to emissive color; Violet receives no halo. The simulator uses a fixed pool of **two shadowless lights** selected from nearby powered neon. Performance mode disables this extra illumination. This approximates the game's per-segment SurfaceLights; it does not reproduce their exact brightness or light every distant neon simultaneously. Bloom uses local geometry rather than a full-screen postprocessing pass.

Electrical state remains the existing Circuit Workbench-derived simulation; color does not change signal propagation. Wire topology still has an edit-time CPU cost and instances still consume memory. This is not a promise of infinite capacity.

`tests/wires-core.test.ts` and `tests/wire-collision-core.test.ts` cover budgets, land, metadata, copies, atomic movement rejection, actual tube/collar/bend collisions, touching versus separated ends, body isolation, and stable rendering batches. `tests/wires.spec.ts` exercises actual pointer/keyboard placement, overpasses, stacked wires, saving, wall mounting, switching and walking. Browser images in `artifacts/wires-*.png` document simulator output, not a measurement of LT2.

`tests/assembly-core.test.ts` covers mixed copies, socket remapping, rigid transforms, upright grounding, exact-limit wire precision, imported-route compatibility, frustum selection and bounded anchor lookup. `tests/wire-selection.spec.ts` covers Ctrl selection, wire-only copying, mixed axis copies, signal, grouped history and preservation of unselected leads. `node scripts/verify-wire-selection-live.mjs` repeats production acceptance with public UI/import/export controls and no development API; set `TIMBER_URL` to check Pages.
