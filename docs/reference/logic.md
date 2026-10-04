# Logic reference and reconstruction

This milestone adds 12 logic components, bringing the catalog to 100 placeable items, plus editable 3D wires. Models are authored reconstructions of the unboxed game images inspected on 4 October 2026. They are not extracted Roblox assets. All bounds carry the approximate marker in the editor; exact dimensions, colors, socket locations and live-game timing have not been measured.

| Component and visual reference | Estimated bounds, X / Y / Z studs | Reconstructed details |
| --- | --- | --- |
| [Lever](https://lumber-tycoon-2.fandom.com/wiki/Lever) | 2 / 2 / 1.5 | Gray base, pale pivot and stem, orange cylindrical grip; handle turns with its saved switch state |
| [Button](https://lumber-tycoon-2.fandom.com/wiki/Button) | 2 / 0.5 / 1.5 | Low gray base, orange circular button that depresses during its pulse |
| [Pressure Plate](https://lumber-tycoon-2.fandom.com/wiki/Pressure_Plate) | 4 / 0.3 / 4 | Thin gray frame, five wooden planks, nail heads and side socket |
| [AND](https://lumber-tycoon-2.fandom.com/wiki/AND_Gate), [OR](https://lumber-tycoon-2.fandom.com/wiki/OR_Gate), [XOR](https://lumber-tycoon-2.fandom.com/wiki/XOR_Gate), [NAND](https://lumber-tycoon-2.fandom.com/wiki/NAND_Gate), [NOR](https://lumber-tycoon-2.fandom.com/wiki/NOR_Gate), [XNOR](https://lumber-tycoon-2.fandom.com/wiki/XNOR_Gate) | 2 / 1 / 2 each | Chamfered gray housings, base lip, distinct logic symbols, output arrows and round side sockets |
| [Signal Inverter](https://lumber-tycoon-2.fandom.com/wiki/Signal_Inverter) | 2 / 1 / 2 | Matching gate housing, NOT symbol, one input and one output |
| [Signal Delay](https://lumber-tycoon-2.fandom.com/wiki/Signal_Delay) | 2 / 2.5 / 2 | Tall chamfered housing, orange stopwatch face, 12 rounded blue meter sections, black slider and white setting marker |
| [Signal Sustain](https://lumber-tycoon-2.fandom.com/wiki/Signal_Sustain) | 2 / 2.5 / 2 | Hourglass face and continuous rounded blue meter distinguish it from Delay |

The timers' setting markers follow their selected setting. Their blue meter geometry is static, not a verified reproduction of the game's timing animation. Basic logic glyphs and timer faces are original canvas drawings shared by instances. No reference thumbnails are redistributed as model textures. See `artifacts/logic-gallery.png` and `artifacts/logic-timers.png` for the rendered reconstruction.

## Electrical behavior

Behavior is ported from the user's [Circuit Workbench](https://github.com/TheeMalarkey/circuit-workbench), reviewed at commit `9b87fdb24a608bf5f991c21fc3467ccb85267ea7`, particularly the gate evaluation, `settleTiming` and `advanceTiming` in `dist/app.js`. That source was read without modifying its repository. The values below describe parity with that simulator, not an independent measurement of live LT2.

- Gates use ordinary Boolean truth tables. Unconnected inputs are false. Inverter negates its input; NAND/NOR/XNOR negate AND/OR/XOR.
- A lever retains its saved state. A button emits a 350 ms pulse; pressing again restarts its release time.
- Delay schedules both input edges by setting × 200 ms, settings 1 through 12. It preserves pulse width even when rendering frames span several electrical events.
- Sustain passes input through at setting 1. Settings 2 through 12 remain high for setting × 200 ms after release; a new high input renews the hold.
- Wires carry signals in both directions. Any high output on a joined wire network drives its inputs. Shared sockets and endpoints touching segments join; segment-interior crossings stay separate. Geometric junction tolerance is 0.025 stud.
- A wire to a light's Switch socket continuously controls whether it is on. Disconnecting restores the saved manual switch setting. This continuous-drive interpretation remains an integration assumption pending live-client comparison.
- The walking avatar activates pressure plates. Loose objects, vehicles and wood physics are not simulated; they cannot activate a plate in this milestone.
- Stable Boolean feedback can settle. Outputs that oscillate in repeating feedback or exhaust its bounded solve budget are marked amber and shown as unsettled in the inspector; those outputs drive low until an input or topology change allows them to settle. Forced constant outputs in the same feedback group retain their valid state. Use Delay for a clock. Memory boards are not included yet.

Simulation advances by event time, with idle frames doing no circuit solves. It pauses with the page and clamps long rendering gaps to 250 ms; it is not a wall-clock timer. A per-frame event budget prevents a feedback clock from blocking rendering. Valid acyclic chains use a compiled dependency order, without a 512-gate propagation limit. Socket topology is reused for switch-only changes. Rendering uses shared instanced wire segments and socket indicators. These choices do not promise unlimited circuit capacity; topology edits, large feedback components and frequent light changes still cost CPU/GPU time.

## Building and editing

Choose **Build → Logic**, place components, then select one to operate its switch/button or choose a timer setting. **Wire** shows the sockets: click a socket, optional surface bends, then another socket or an existing wire. The inspector's socket buttons also start a wire. Inactive outputs are orange in Wire mode, inputs are pale, and powered sockets/wires glow blue. **Backspace** removes the last bend; **Escape** cancels the unfinished wire, then exits Wire mode. Click an existing wire and choose **Delete selected wire** to remove it. Selecting Build, Select, Move, Orbit or Walk cancels wiring.

Wires anchor to components as they move. Entire connected assemblies carry their internal bends and junctions during rigid moves/turns. Wires with external connections keep their world-space routing while the selected socket follows its component. Group copies copy internal connections and prune links to unselected components. Deleting components removes their socket-attached wires in the same undo entry. Copies, undo/redo, `.timber` export/import and local saves include switch settings and wires. Pending button pulses, queued timer edges and pressure-plate contact reset when loading a project.

Wire length and component placement are simulator extensions: wires currently have no game-shop length limit and components use this editor's one-stud placement. Advanced memory boards, displays, sensors, hatches, doors and machine inputs are follow-on integrations. No claim of full Link's Logic catalog coverage or live-game-perfect geometry is made.
