# Build Paths Implementation Plan

> Execute inline using superpowers:executing-plans, with test-first tasks.

**Goal:** Build straight, filled and multi-point curved blueprint paths, including adaptive wedge ramps and arches.

**Architecture:** Pure path generation and batch validation feed an isolated path interaction controller. The existing editor supplies templates, camera and atomic commits. A small guide/point overlay uses the current floating-origin renderer.

**Tech Stack:** Existing TypeScript, Three.js, Vitest and Playwright; no new dependencies.

**Spec:** docs/superpowers/specs/2026-10-04-build-paths.md

## Constraints

Preserve existing builds and author privacy. Keep ground/plot checks mandatory, overlaps explicit, movement in studs, unchanged blueprint meshes, instanced previews and one undo per run. Continuous poses must round-trip alongside old quarter-turn projects.

## Review Focus

Cancellation and modifier precedence; camera or mode changes during gestures; candidate collisions within one batch; repeated or coincident curve points; backwards paths, slope transitions and floating origins.

## Tasks

- [x] Test and implement continuous orientation round-trip/composition and rotated-box SAT compatibility in placement.ts, project.ts and collision.ts.
- [x] Test and implement path generation in build-path.ts and atomic World.placementBatchIssue, covering line spacing, fill endpoints, curves, adaptive wedges, degenerate input and boundaries.
- [x] Test and implement path controls in path-builder.ts, point overlay in path-overlay.ts and minimal editor integration, covering Ctrl drag, edit arrows, release/Enter commits, cancellation and grouped undo.
- [x] Run focused and full regressions, inspect rendered curves, validate a production build without debug API, update documentation/package and prepare the GitHub Pages release.
