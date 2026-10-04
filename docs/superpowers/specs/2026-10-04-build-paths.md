# Drag and curve building

Implement Single, Straight drag, Curve and Smart wedge curve modes in the blueprint inspector. Ctrl-left-drag temporarily starts a straight run during new-piece placement; Ctrl remains multi-select in selection mode. Single clicks retain single-piece behavior.

Straight drags preview a fixed path and apply on release in one history action. Curves use multiple clicked control points, selected point axis arrows, Remove point, Build path/Enter and Cancel/Escape. Fill span samples at one-stud spacing including endpoints; normal spacing follows blueprint dimensions. Placements preserve stud translations and keep blueprint geometry unchanged.

Smart wedges offer Ramp and Wall/arch choices. Ramp points acquire the selected wedge's rise/run by default and allow Y edits; pieces match the resulting slope. Wall/arch wedges align their triangular faces to the curve plane and adapt catalog wedge ratios to bends. Tight joints require the explicit Allow overlaps option. Candidate-to-candidate and existing-world collisions, ground and plot boundaries are validated atomically.

Curves require continuous orientations. Keep existing quarter-turn file representations, accept finite fractional quarter-turns for generated curves, compose R/T without losing those poses, and use actual solid collision for rotated boxes. Preview batches remain instanced. Input updates coalesce to animation frames; curve markers and guides share a small overlay. No world piece-count cap is introduced.

Preserve builds, privacy, project files, existing selection and camera controls. Publish through the already authorized main-branch GitHub Pages workflow after tests and isolated production checks.
