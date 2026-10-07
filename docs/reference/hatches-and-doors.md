# Hatches and working doors

The Hatch is in the Logic catalog. Hover its round control, or a door's black handle, and press **E** or click. The existing inspector also provides an Open/Close action and a wire input. An attached wire controls the requested state: powered opens, unpowered closes. The hatch bar and its wire socket stay fixed; door sockets follow their handles.

## Reference and confidence

- [LT2 Hatch reference](https://lumber-tycoon-2.fandom.com/wiki/Hatch): community-documented 4 × 4 × 1 stud assembly, manually and electrically operated.
- [Unboxed Hatch image](https://static.wikia.nocookie.net/lumber-tycoon-2/images/3/37/THUMBhatch.png/revision/latest?cb=20250729001814): inspected against the implementation's closed front and top views. The panel mounts near the bottom of a dark gray motor bar, with a black control face and orange ring. The initial high-mounted panel was corrected during screenshot review.
- Upward opening is confirmed by the user's in-game correction. The implementation uses positive local X rotation about the bar-side edge, so rotating or tilting the whole assembly retains the same local hinge direction.
- [Roblox material documentation](https://create.roblox.com/docs/parts/materials): classic DiamondPlate color and normal maps, shared across all instances. Exact asset IDs, hashes and sources are in the texture manifest.
- Basic, Half, Fat and Glass Doors retain the previously audited slab, glazing and black knob designs. Their hinge is opposite the knob. See the existing blueprint and glass references for model dimensions.

The 0.18-stud plate, bar depth, pivot position, control details, 90-degree travel and 0.65-second motion are reconstructions, not measurements extracted from a Roblox client. Screenshots verify this simulator's appearance and direction; they do not establish exact game timing or physics parity.

## Behavior and performance

The visible transform also drives picking and convex collision, allowing a character through an open doorway. A blocked sweep stops safely; a player stepping away allows it to resume. Doors stop before stretching typed wires beyond their budget or pulling them through other wires (unless Allow overlaps is enabled). Active plots and ground bounds remain enforced.

Only moving assemblies update their instance matrices. Resting doors perform no per-frame sweep tests. A hatch uses two shared instanced batches per chunk: its fixed motor and moving plate. Textures and materials are shared, including catalog thumbnails.

Saved projects retain requested manual state. Animation progress is transient and is reevaluated after loading; moving/copying a piece previews its closed placement, then reapplies its requested state. The simulator does not currently implement hatch elevators carrying characters or loose objects.

## Visual review

The [screenshot gallery](../../public/hatch-review/index.html) contains closed front/top, open side/rear, a wired hatch, and all four door variants closed/open. Automated tests additionally cover E/click, undo, signal changes, walking clearance, blocked travel, inverted mounts, spatial cell boundaries, land removal, persistence validation, and wire intersections.
