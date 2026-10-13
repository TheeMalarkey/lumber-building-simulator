# Conveyors and movable wood reference

Research date: 2026-10-12. Scope: the current conveyor family and loose logs/planks. This modeling brief distinguishes visible evidence from measurements still needed. No application code changed.

## Evidence confidence

- **Observed:** directly inspected unboxed image or identified gameplay frame.
- **Documented:** community-wiki description, not independently measured in Roblox.
- **Unknown:** requires a calibrated view or controlled gameplay experiment.
- **Proposed:** simulator design, not a claim about the original engine.

## Catalog and behavior

The [Conveyors reference](https://lumber-tycoon-2.fandom.com/wiki/Conveyors) lists ten products:

| Product | Listed price |
| --- | ---: |
| Straight Conveyor | 80 |
| Tilted Conveyor | 95 |
| Funnel Conveyor | 60 |
| Tight Turn Conveyor | 100 |
| Switch Conveyor | 320 |
| Wood Sweeper | 430 |
| Straight Conveyor Switch Left | 480 |
| Straight Conveyor Switch Right | 480 |
| Conveyor Supports | 12 |
| Turn Conveyor Supports | 20 |

Documented behavior: transport acts on loose objects contacting the top or underside. Most conveyors have a side knob for manual or wired direction control. Supports adapt beneath tilted conveyors. Historical integrated-support variants are distinct from current separate supports. Exact signal polarity, trigger semantics, speed and contact mechanics remain unmeasured.

## Unboxed visual references

All ten images below were directly inspected. They show one perspective/state each, not calibrated dimensions. They came from the unboxed column, not the box packaging. Reference assets should remain separate from authored application assets.

| Product | Observed details | Source image |
| --- | --- | --- |
| Straight | Pale cylindrical rollers; charcoal rails with stepped lower flanges; orange circular control with a short tab; no rubber belt or integral legs. Approximately eight rollers visible, pending a top-view count. | [Straight](https://static.wikia.nocookie.net/lumber-tycoon-2/images/3/32/THUMBstraight.png/revision/latest?cb=20220126205915) |
| Tilted | Exposed rollers, taller dark side profiles and tabbed control. Perspective does not establish rise or slope. Do not assume a rotated straight model is sufficient. | [Tilted](https://static.wikia.nocookie.net/lumber-tycoon-2/images/7/76/THUMBvertical.png/revision/latest?cb=20260928001339) |
| Funnel | Roller bed with side profiles tapering downward toward an open edge. The image does not establish a wider mouth. | [Funnel](https://static.wikia.nocookie.net/lumber-tycoon-2/images/d/de/THUMBfunnel.png/revision/latest?cb=20220126205915) |
| Tight Turn | Fan of tapered rollers converging at an inner corner; segmented curved outer rail and compact inner post. | [Turn](https://static.wikia.nocookie.net/lumber-tycoon-2/images/6/6e/THUMBturn.png/revision/latest?cb=20220126205915) |
| Switch | Two fan-shaped roller regions, central gray region, yellow divider arm, dark rails and corner posts. | [Switch](https://static.wikia.nocookie.net/lumber-tycoon-2/images/4/44/THUMBswitch.png/revision/latest?cb=20220126205915) |
| Wood Sweeper | Rectangular frame; pale rollers with dark gaps; yellow segmented/pronged assembly along one edge; orange side control. A still does not establish its travel path. | [Sweeper](https://static.wikia.nocookie.net/lumber-tycoon-2/images/1/12/THUMBsweeper.png/revision/latest?cb=20220126205915) |
| Straight Switch Left | Broad parallel roller field, yellow diagonal bar, corner hinge/post and side frame. Distinct from the fan-roller Switch Conveyor. | [Left](https://static.wikia.nocookie.net/lumber-tycoon-2/images/d/d5/THUMBstraightswitchleft.png/revision/latest?cb=20220126205913) |
| Straight Switch Right | Parallel rollers, differently positioned pivot, yellow bar and orange control. Confirm handedness from travel direction, not image left/right. | [Right](https://static.wikia.nocookie.net/lumber-tycoon-2/images/9/93/THUMBstraightswitchright.png/revision/latest?cb=20220126205915) |
| Supports | Four separate dark rectangular plates/feet; no continuous platform. Installed height remains unknown. | [Supports](https://static.wikia.nocookie.net/lumber-tycoon-2/images/6/6d/THUMBsupports.png/revision/latest?cb=20220126205914) |
| Turn Supports | Separate dark support pieces including an angled corner-like part. Installed spacing and orientation need measurement. | [Turn supports](https://static.wikia.nocookie.net/lumber-tycoon-2/images/8/89/THUMBturnsupports.png/revision/latest?cb=20220126205914) |

Color descriptions refer to displayed appearance. Exact RGB, materials, roughness, radii, wall thickness and underside geometry remain unknown. Thumbnail lighting varies; sampled image colors are not original material values.

## Movable wood

[Logs](https://lumber-tycoon-2.fandom.com/wiki/Logs) documents carryable raw wood with outer bark and an inner core. The exposed core uses the corresponding plank color and is not universally lighter than bark. Raw logs are not saved as part of a base in the same way as planks.

[Planks](https://lumber-tycoon-2.fandom.com/wiki/Planks) documents bark removal, configurable rectangular cross-sections and repeated sawmill processing. Planks supply material to blueprints. Keep this separate from the existing creative placement workflow.

For modeling, verify bark on longitudinal faces and core on cut ends. Do not assume conventional round logs: check blocky cross-sections, taper and branch joins. Validate straight cut segments separately from connected branches. Plank sizes vary; one fixed decorative mesh cannot cover transport tests.

The [Sawmills reference](https://lumber-tycoon-2.fandom.com/wiki/Category:Sawmills) gives future interfaces: X starts at 0.6 units, Y at 0.4, with 0.2-unit control increments. Most mills accept 10.9-unit lengths; Sawmax 02L accepts 18.9. These are processing constraints, not conveyor dimensions or loose-wood size caps.

## Gameplay evidence

[Aptyn's auto wood sorter tutorial](https://www.youtube.com/watch?v=hz95SJBruM0), published June 18, 2023, is a useful system reference. The frame around [4:25](https://www.youtube.com/watch?v=hz95SJBruM0&t=265s) was directly inspected: connected roller beds, yellow diverters, detectors and small wood pieces show transport surfaces in use. No speed or dimensions were measured.

Description-provided chapters for further inspection: 5:48 construction; 13:19 potential issues; 15:35 turning; 17:41 wood spacing. These chapters are not claimed as watched. The description recommends ice wood for lower friction; this is not a measured friction coefficient.

[2016 conveyor switch demonstration](https://www.youtube.com/watch?v=Aii15It2pmE): located but not watched this pass. Use only as supplementary evidence; prefer current footage if details conflict.

## Measurements still required

| Parameter | Required evidence | Current status |
| --- | --- | --- |
| Overall width, depth, height | Top/side views with a known-size blueprint in the same plane | Unknown for all variants |
| Usable width | Inner rail-to-rail measurement | Unknown |
| Roller count, radius, spacing | Close top/end views | Straight provisionally eight; other counts unverified |
| Crest and rail elevations | Calibrated side view | Unknown |
| Tilt rise and run | Both endpoints against a grid | Unknown; no assumed angle |
| Turn radius and angle | Calibrated top view | Fan shape observed; dimensions unknown |
| Diverter pivot and endpoints | Both states, top view | One still per variant inspected |
| Sweeper path | Complete cycle, side/top views | Unknown |
| Support adjustment | Installed straight, turn and tilted examples | Thumbnail only |
| Knob and wire anchor | Both sides and attachment demonstration | Appearance observed; coordinates unknown |
| Transport speed | Known distance divided by elapsed time, repeated trials | Unknown |
| Control semantics | High/low, pulses, disconnect and manual while wired | Unknown |
| Contact behavior | Top, underside, rail, seam and rotated module tests | Broad top/underside behavior documented |
| Wood mass and friction | Equal-size species under repeatable pushes/slides | Unknown |

Measure against a known blueprint in the same plane, then repeat with a second reference. Record source, view, ratio, inferred studs and uncertainty. Do not infer exact scale from a perspective thumbnail. For speed, track the same wood point across a measured distance and distinguish acceleration, steady movement and module transfer.

## Proposed simulator approach

Start with Straight Conveyor and rectangular movable planks, then straight log segments. Keep the conveyor structure static and instanced. Simulate awake wood using spatial queries and fixed time steps. Preserve rail obstructions while choosing a stable contact surface for the rollers. These are implementation proposals, not recovered LT2 engine behavior.

Wood should rotate, fall, stack and collide with existing detailed geometry. Transport must depend on contact rather than a wood center entering a box or snapping to a centerline. Test long pieces bridging modules and small pieces crossing seams. Keep motion constants adjustable until measured.

Reuse existing selection, wiring, controls, copying and undo. Save species, dimensions and transforms. Retaining raw logs across reloads would preserve simulator work but differs from the documented game behavior. Economy, chopping, tree growth and sawmill processing are not required for the first transport slice.

## Validation before expansion

1. Compare front, side, top, underside and three-quarter screenshots against calibrated references, including rail and roller heights.
2. Verify forward/reverse behavior and steady signals, pulses, disconnection and manual control.
3. Test short, wide, long, diagonal and stacked wood, off-center entry, two-module contact, seams and gravity at exits.
4. Check save/load, copy, undo and removal preserve unrelated wood and circuits.
5. Benchmark empty layouts separately from moving-wood layouts using frame time and simulation cost.
6. Expand to funnel/tilted, turns, diverters, sweeper and supports after their geometry and transfers are verified.

The visual references support reconstruction work. Exact scale and motion fidelity still require measurements and both-state screenshots.
