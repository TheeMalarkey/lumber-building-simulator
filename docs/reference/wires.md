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

Tube diameters **0.12 regular / 0.24 neon**, collar diameters **0.19 / 0.30**, and 0.14-stud collar lengths are visual reconstruction estimates, not measured Roblox part dimensions. Endpoint collars extend inward so routing coordinates remain the ends of the wire. Regular powered blue is visually estimated. Neon uses the published palette, but different rendering and lighting engines prevent exact screen-color parity.

## Placement and editing

Choose **Wire** on the toolbar, then **Wire** or **Neon** and a neon color. Click a surface or socket to start. Surface clicks add points in 3D, including walls and sloping blueprint faces. Click another socket or existing wire to finish a connection. For decorative or surface-ended routes, click the last surface point and press **Enter** or **Finish wire**. Clicking the same final point again also finishes. **Backspace** removes the last point; **Escape** cancels the unfinished route, then exits the tool. To delete a wire, click it in Wire mode and choose **Delete selected wire**.

The live meter measures the entire route. Invalid previews are red and cannot be placed. New tubes stay above the plot and inside active plots; routes crossing an unowned corner are rejected. Points are placed precisely on visible surfaces with clearance for the collar, independent of the blueprint's one-stud grid. No automatic curve or obstacle-routing system is added: the builder chooses the bends.

Sockets and wire junctions have screen-space snapping. Other blueprints occlude the target. The socket markers intentionally allow selecting the far socket on its own component, consistent with this editor's existing wiring aid. Wires can connect in either direction. Endpoint contact uses the visible endpoint/body radii plus a 0.005-stud tolerance for new wires, including a slightly raised neon-to-regular junction at ground level. Interior/interior crossings stay separate. Legacy-to-legacy connections retain their earlier 0.025-stud tolerance.

New wire types and colors persist in `.timber` export/import, local saves, group copies and history. Rigid connected assemblies carry their routes. Moving an individual connected component cannot stretch a new wire beyond its budget; invalid moves leave history and the original pieces unchanged. Plots containing new wire routes cannot be deactivated. Legacy untyped routes load unchanged even if they predate length limits or ground clearance. Imported oversized typed routes may move rigidly or shorten, but cannot become longer.

## Rendering and performance

Three instanced batches draw cylinders/collars, bend joints and soft neon halos. Geometry and GPU buffers are reused across power changes. Neon switches from shaded black plastic to emissive color; Violet receives no halo. The simulator uses a fixed pool of **two shadowless lights** selected from nearby powered neon. Performance mode disables this extra illumination. This approximates the game's per-segment SurfaceLights; it does not reproduce their exact brightness or light every distant neon simultaneously. Bloom uses local geometry rather than a full-screen postprocessing pass.

Electrical state remains the existing Circuit Workbench-derived simulation; color does not change signal propagation. Wire topology still has an edit-time CPU cost and instances still consume memory. This is not a promise of infinite capacity.

`tests/wires-core.test.ts` covers budgets, plot corners, metadata, copies, movement constraints, mixed-type electrical contacts and stable rendering batches. `tests/wires.spec.ts` exercises actual pointer/keyboard placement, saving, wall mounting, switching and walking. Browser images in `artifacts/wires-*.png` document simulator output, not a measurement of LT2.
