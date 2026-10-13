# Conveyor transport implementation plan

**Goal:** Build the first reference-informed Straight Conveyor and a reversible rigid-body plank transport test.

**Architecture:** Conveyors and plank starting positions use existing catalog, placement, history and project persistence. A separate fixed-step physics world simulates planks without mutating saved pieces. Static collision comes from the existing convex model components. Sleeping bodies and a spatial broadphase limit work. Editing ends the preview; reset restores authored positions.

**Spec:** `docs/reference/conveyors-and-movable-wood.md`

**Accuracy boundary:** Eight exposed long rollers, stepped dark rails and an orange side control follow the inspected unboxed reference. The 4 x 8 footprint follows the user's flat-wall comparison. Rail height, fine hardware, speed, gravity and signal polarity are reconstructed, not verified LT2 measurements. Other conveyor variants and raw logs follow after this slice.

- [x] Add reference-informed model, catalog entries and circuit input/manual reversal.
- [x] Add fixed-step rigid-body transport, actual contact-driven movement, stacking and reset.
- [x] Add compact test controls; preserve project/history data.
- [x] Verify falling, stacking, transfer, reversal and rotated placement with automated tests.
- [x] Inspect several rendered model angles and test the browser controls.
- [ ] Build, privacy-check and publish only after validation.

Review focus: wood must not move while airborne or beside rails; seams must transfer; reset must preserve original transforms; editing must not leave stale physics bodies; existing projects must remain valid.

## Verification ledger

- 253 core tests passed; production TypeScript/Vite build passed.
- Browser transport controls and three existing visual regression cases passed. Four screenshots inspected: three-quarter, side, top and low views.
- Independent review identified stale animated-door and land collision. Door poses now invalidate colliders and wake supported wood; land edits reset the preview. Added support-release and land-edit regression coverage.
- Isolated Chrome physics sample: 100 falling planks, 360 steps at 120 Hz; approximately 4.9 ms setup, 0.4 ms median step and 4.2 ms p95 step. All 100 slept. This measures physics only, not an overall FPS guarantee.
- Ruling: use an explicit reversible free-camera test for this first slice. Starting placement, changing geometry/land, entering Walk or Reset restores authored plank poses. Manual/wired direction changes remain live. This avoids persisting transient simulation states before a complete loose-object editing system exists.
- Remaining: raw logs, variable plank sizes, other conveyor products, in-game measurement calibration, direct loose-wood grabbing and full player/wood dynamics.

## Model correction

- Corrected roller orientation: eight long rollers span local Z; transport runs across local X. Removed the invented lower crossbars and replaced tall uniform side walls with stepped blocks and lips.
- Applied the user's further rail feedback: taller upper/lower sections and wider lower ledges. Kept saved bottom support positions; bounds now include the actual raised geometry.
- Matched the control's scale and location more closely; the tab and wire socket now follow the rail, with visible manual/wired reversal states and separate instanced batches.
- Inspected the actual reference beside the rebuilt model and captured top, side, underside and in-scene views. Corrected roller cap/rail coplanarity found in that comparison.
- Final correction checks: 256 core tests passed; nine transport/logic interaction browser cases passed, including visible wired reversal. Production build and diff checks passed. Publication privacy scan found no personal paths or credentials in the change; reference downloads and comparison screenshots remain ignored.
