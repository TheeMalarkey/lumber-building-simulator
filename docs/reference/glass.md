# Glass building pieces

Reference checked 2026-10-04: [Glass Panes, LT2 community wiki](https://lumber-tycoon-2.fandom.com/wiki/Glass_Panes). The reference lists exactly five placeable glass products, all with a fixed color and 0.2-stud panel thickness. These are purchased placeables in LT2 rather than wood-filled blueprints.

| Item | Panel width × height × thickness | Game price |
| --- | --- | --- |
| Tiny Glass Pane | 1 × 1 × 0.2 | $12 |
| Small Glass Pane | 2 × 2 × 0.2 | $50 |
| Glass Pane | 4 × 4 × 0.2 | $220 |
| Large Glass Pane | 8 × 8 × 0.2 | $550 |
| Glass Door | 4 × 8 × 0.2 | $720 |

The wiki records flat dimensions (for example 8 × 0.2 × 4 for the door); the simulator presents them upright for window placement. Rotation and tilt allow either orientation. Existing wood blueprints and saves retain their IDs and dimensions.

## Visual evidence

- [Large pane thumbnail](https://static.wikia.nocookie.net/lumber-tycoon-2/images/e/e4/THUMBlargeglasspane.webp/revision/latest?cb=20260921014231): thin, plain, translucent panel without a frame or mullions.
- [Regular pane](https://static.wikia.nocookie.net/lumber-tycoon-2/images/0/0c/THUMBglasspane.webp/revision/latest?cb=20260921014130), [small pane](https://static.wikia.nocookie.net/lumber-tycoon-2/images/4/49/THUMBsmallglasspane.webp/revision/latest?cb=20260921013922), [tiny pane](https://static.wikia.nocookie.net/lumber-tycoon-2/images/c/c4/THUMBtinyglasspane.webp/revision/latest?cb=20260921013325): individual references linked by the same table.
- [Glass door thumbnail](https://static.wikia.nocookie.net/lumber-tycoon-2/images/c/c0/THUMBglassdoor.webp/revision/latest?cb=20260921014018): tall frameless panel, dark cylindrical knob near the left edge and middle height. The pane and door thumbnails were directly inspected; the smaller pane forms follow the listed family dimensions.

Panel dimensions are reference-backed. Knob radius (0.3), length (0.25 on each face), inset (0.5) and height (4 studs) are estimates from the door thumbnail. The full 0.7-stud hardware depth is included in movement/ground/plot bounds; precise collision uses the panel and knobs separately.

Tint, opacity and roughness are reconstructions, not measured Roblox properties. Glass uses one shared lightly tinted translucent material without wood textures; door knobs remain opaque. Glass ignores the wood palette, including mixed selections. Ordinary instancing is retained without per-pane refraction passes or per-frame transparent-instance sorting. Intersecting, differently lit glass layers can therefore have blending-order limitations. Doors are placed as closed, static building pieces, consistent with the existing door tools.

Exact current-client appearance and interactive door operation have not been verified against a live LT2 session.
