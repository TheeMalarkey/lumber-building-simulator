# Blueprint fidelity audit — 2026-10-03

All 69 catalog names and outer dimensions match the public [LT2 blueprint table](https://lumber-tycoon-2.fandom.com/wiki/Blueprints). This pass also corrected wood requirements for six fences and twenty wedges. An independent transcription is regression-tested in `tests/fixtures/blueprint-table.json`.

Twenty-nine geometry recipes were corrected using 25 game thumbnails linked from that table. These are public 2022 image revisions, accessed on the date above. They establish visible forms, not exact internal measurements or current-client parity.

| Family | Correction | Still estimated |
|---|---|---|
| Six fences | Solid staggered vertical boards replace open post-and-rail fences | Board depth, relief, corner joints |
| Nine corrugated walls | Broad boards with subtle alternating relief, including both corner legs | Relief and seams |
| Three doors | Plain slab with dark circular knobs replaces invented paneling | Slab depth, knob size, reverse side |
| Two stairs | Two treads for Stairs; four for Steep Stairs | Exact source pivot |
| Chair | Solid back, simple seat and thicker legs | Internal part sizes |
| Two tables | Simple flush top and four legs, without invented aprons | Top and leg thickness |
| Ladder | Five cylindrical rungs | Rail and rung thickness |
| Four cabinets | Open tops; regular divider; square small corner; wide L-shaped corner with a 2×2-stud notch | Wall thickness, partitions and door outlines |
| Sink | Recessed basin, drain, tap and handles | Basin profile, hardware sizes and filled finish behavior |

Other recipes retain their existing primitive forms. Directly reviewed thumbnails and family-based inferences are distinguished per entry in [catalog-audit.json](catalog-audit.json). Entries without direct visual evidence are marked dimensions-confirmed rather than visually verified.

## Visual evidence

- [Structure before/after](../../artifacts/blueprint-comparison-structure.png)
- [Kitchen before/after](../../artifacts/blueprint-comparison-kitchen.png)
- [Reference contact sheet](../../artifacts/blueprint-reference-sheet.png)
- [Image URLs and SHA-256 provenance](../../artifacts/blueprint-references/sources.json)

Comparison columns show the wiki game thumbnail, previous simulator recipe, and revised simulator recipe. Previews are individually framed and are not at a uniform measurement scale. All 69 simulator previews were captured before and after; only the listed reference images were directly compared.

The reference countertop previews show a dark stone-like finish. That alone does not establish the material of a wood-filled structure, so countertops and sink surrounds retain the selected wood. Knobs, drain, basin and tap now use shared neutral materials reconstructed from the previews; live filled-state behavior remains unverified. Public imagery is retained as audit evidence and is not loaded by the production renderer.

## Validation and performance

The 60 core tests and 25 browser scenarios pass, including geometry bounds, nondegenerate UVs, shape raycasts, the independent catalog table, placement, moving, rotation, persistence and walking. Stair collision uses the same tread count as the rendered stairs.

Cached geometry and chunk instancing remain in place. A browser check confirms twenty sinks in one chunk share one instanced mesh, with four material groups. Doors have two groups. Hardware materials are shared across wood finishes, with no additional texture downloads. This is a batching check, not a fresh FPS benchmark; older benchmark results predate this audit.

Catalog IDs, outer dimensions and saved positions remain stable. Existing pieces adopt the revised geometry. Placement still uses conservative outer bounds, so empty cabinet interiors do not create newly usable placement space.

Exact internal dimensions, unseen faces, pivots, filled-material behavior and current game parity still require measurements or comparison in a live LT2 client. None is claimed as verified by these thumbnails.
