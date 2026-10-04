# Store furniture reconstruction

Reference review: 2026-10-04. Nine non-light furnishings from [Fancy Furnishings](https://lumber-tycoon-2.fandom.com/wiki/Fancy_Furnishings) are included in the separate **Store furniture** category. These are bought placeables, not wood-filled blueprints. Lighting and functional appliance doors are separate future work.

## Evidence and accuracy

Each linked item's unboxed image was directly inspected. Seating was also checked against the showroom photo on the Armchair page, and the dishwasher against its in-game countertop display. The sources establish the designs and finishes, but do **not** publish exact dimensions. The dimensions below are estimates, not certified game measurements. Cabinet-compatible appliances use the existing four-stud cabinet width and 2.4-stud counter-support height as their scale reference. Perspective images cannot establish exact hidden dimensions.

| Item / source | Estimated width × height × depth | Reconstructed details |
| --- | --- | --- |
| [Armchair](https://lumber-tycoon-2.fandom.com/wiki/Armchair) | 4 × 4 × 4 | Warm beige body, rounded arms and back ends, continuous seat, four black feet |
| [Loveseat](https://lumber-tycoon-2.fandom.com/wiki/Loveseat) | 6 × 4 × 4 | Wider matching two-person design |
| [Couch](https://lumber-tycoon-2.fandom.com/wiki/Couch) | 8 × 4 × 4 | Wide matching three-person design |
| [Single Bed](https://lumber-tycoon-2.fandom.com/wiki/Single_Bed) | 4 × 3 × 8 | Brown frame, higher headboard, lower footboard, white mattress and one pillow, black feet |
| [Twin Bed](https://lumber-tycoon-2.fandom.com/wiki/Twin_Bed) | 6 × 3 × 8 | Wider frame and two pillows; both beds are called Bed in-game |
| [Toilet](https://lumber-tycoon-2.fandom.com/wiki/Toilet) | 2.6 × 3.5 × 4 | White tank, raised lid, flush lever, oval open bowl, blue-gray water and dark drain |
| [Refrigerator](https://lumber-tycoon-2.fandom.com/wiki/Refrigerator) | 4 × 6 × 4 | White two-door cabinet, two vertical gray handles, separate doors and interior shelves |
| [Stove](https://lumber-tycoon-2.fandom.com/wiki/Stove) | 4 × 2.8 × 4 | Dark gray body, plain dark cooktop, slanted rear strip, horizontal handle and inset window |
| [Dishwasher](https://lumber-tycoon-2.fandom.com/wiki/Dishwasher) | 4 × 2.4 × 4 | Gray shell, white front, dark horizontal handle; fits beneath existing countertop |

Geometry, RGB colors, radii, internal shelves, and hardware positions are authored reconstructions. Rounded silhouettes follow the reference instead of adding modern upholstery seams or stove burners not visible there. Static closed appliances do not reproduce opening, wiring or storage interaction. Seating does not yet trigger an avatar sitting pose. Beds remain decorative, consistent with the reference's lack of a lying interaction.

## Implementation

The recipes are in `src/furniture-geometry.ts`. All pieces retain fixed finishes during single and mixed selection edits. Surfaces share one material palette, cached geometry, and instanced batches per item/chunk, regardless of the legacy saved wood field. There are no new texture downloads, physics objects, lights or per-frame animation systems.

Collision is assembled from the modeled convex components, including separate sectors around the toilet bowl. Empty seat and under-bed space remain empty. Furniture uses the existing ground, land, overlap, rotation, group-copy and save validation. The render budget test limits each model to fewer than 1,800 triangles; this is a geometry check, not a whole-scene FPS guarantee.

Current-client measurements and exact live Roblox appearance remain unverified. These limitations should stay visible in release notes until an in-game measurement reference is available.
