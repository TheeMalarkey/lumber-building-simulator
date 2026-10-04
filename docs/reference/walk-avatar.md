# Classic R6 character proportions

The avatar follows the R6 mannequin bundled with Roblox, `content/models/Thumbnails/Mannequins/R6.rbxmx`, inspected on 2026-10-03. Coordinates below are relative to the feet, with the mannequin's common Z offset removed.

| Part | Size in studs (X, Y, Z) | Center above feet |
|---|---|---|
| Torso | 2, 2, 1 | 3 |
| Each arm | 1, 2, 1 | 3 |
| Each leg | 1, 2, 1 | 1 |
| Head Part | 2, 1, 1 | 4.5 |

Arm centers are at X = ±1.5 and leg centers at X = ±0.5. Shoulder animation pivots are 3.5 studs above the feet. Arms meet the torso without the previous gaps or lowered shoulders.

The head Part's box is not its visible shape. The mannequin uses a Head SpecialMesh with scale 1.25 on all axes, also shown in [Roblox's Humanoid documentation](https://create.roblox.com/docs/reference/engine/classes/Humanoid). The bundled `content/avatar/heads/head.mesh` was converted into `src/assets/classic-head.json`, preserving its positions, normals, and 846 triangles, with that scale applied once. The JSON records the source SHA-256; `scripts/convert-classic-head.mjs` reproduces the conversion from an installed reference file. No Roblox installation or network access is required at runtime.

The visible head measures approximately 1.497 × 1.503 × 1.497 studs and reaches 5.252 studs above the ground. Camera eye height is 4.5; the conservative standing collision height is 5.26 to keep the mesh below ceilings. The face remains a reconstructed smile, projected onto the head surface once during construction. Body colors and animation remain the simulator's interpretation.

Only one local avatar is rendered. Its head is loaded once, and the mesh adds no work per blueprint. Movement collision remains a simplified controller rather than Roblox's physics engine.
