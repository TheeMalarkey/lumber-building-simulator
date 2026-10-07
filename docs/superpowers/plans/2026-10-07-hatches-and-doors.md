# Hatches and doors implementation plan

**Goal:** Add the LT2 Hatch and make Basic, Half, Fat and Glass Doors operable by their controls and wires, with multiple visual checks.

**Architecture:** Preserve each piece's closed placement transform. A shared hinge transform drives instanced rendering, precise collisions, picking and moving door sockets. Store only the requested open state; animation poses remain transient. Keep the hatch motor bar stationary and swing the diamond-plate panel upward.

**Scope:** This first release covers the hatch and four door variants. Icicle lights are excluded. Other researched machinery and advanced logic are later milestones. Existing saves and builds must remain usable.

**References:** Hatch unboxed reference on the LT2 wiki, Aptyn's hatch garage demonstration, existing audited door models, and the user's upward-opening correction. Hatch footprint is 4 by 4 by 1 studs. Fine hinge measurements and motion duration remain reconstruction estimates until measured in a live client.

- [x] Add shared hinge math, saved state and a reference-based hatch recipe; test upward travel, rotated mounts and persistence.
- [x] Integrate instanced moving panels, live collision/picking and wire controls; test manual operation, signals, blocked movement and undo.
- [x] Capture closed/open front, side and three-quarter views; inspect and adjust the design. Capture an actual wired assembly and walking interaction.
- [x] Run affected regressions and production checks, document fidelity limits, privacy-scan and prepare the verified build for publication.

Validation: 243 core tests and 73 distinct affected browser tests passed. Production-path smoke checks verified hatch import, open-state reload, catalog availability, eight gallery images, phone-width layout and zero page errors. Screenshot comparison corrected the hatch panel to its lower mounting position. Review findings about plot removal, avatar-blocked travel and moving-wire collisions were reproduced and covered by regression tests. GitHub Pages publication uses the repository's existing main-branch workflow.

**Review focus:** Open doors across spatial cells; reloading or undoing during movement; tilted hatches near ground/plot edges; moving sockets preserving wires; contact with the walking avatar. No physics bodies or per-panel material allocations are needed for idle pieces.
