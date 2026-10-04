# Blueprint fidelity audit and corrections

**Goal:** Compare all 69 catalog entries with the public LT2 blueprint table and correct clearly visible recipe differences.
**Architecture:** Keep catalog IDs and outer placement bounds stable. Rebuild shared cached geometry, consolidate fixed hardware into material groups, and keep chunk instancing. Share stair tread count with walking collision.
**Evidence:** Public Blueprints table and its linked 420px thumbnails (2022 image revisions, accessed 2026-10-03). No claim of live-client or exact internal part measurements.

- [x] Record an independent names/dimensions/cost fixture; fail against known fence and wedge cost errors.
- [x] Add shape regressions for visible reference features: solid board fences, plain doors, 2/4 stair treads, solid chair back, open cabinet tops, L-shaped wide corner, recessed sink.
- [x] Correct geometry and fixed knob/basin/tap surfaces; preserve wood selection on filled structural surfaces. Do not infer a permanent marble countertop from a catalog thumbnail.
- [x] Check every model against its bounds, UVs, picking, placement and walk collision; preserve instancing.
- [x] Generate before/after comparisons and per-item evidence/confidence notes.
- [x] Run core/browser/build/package checks and update the portable package.

Internal board thicknesses, offsets, hardware radii and cabinet subdivisions reconstructed from thumbnails remain estimates. Backside detail, live pivots, material behavior after filling and current-client parity remain acceptance gates.
