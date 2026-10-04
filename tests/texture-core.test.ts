import { describe, expect, it } from "vitest";
import { BoxGeometry, Vector2, Vector3 } from "three";
import { CATALOG } from "../src/catalog";
import { geometryFor } from "../src/geometry";
import { applyPhysicalUVs, TEXTURE_TILE_STUDS } from "../src/texture-uv";

describe("physical material coordinates", () => {
  it("keeps texture density constant on every catalog triangle, including slopes", () => {
    const a = new Vector3(), b = new Vector3();
    const ua = new Vector2(), ub = new Vector2();
    for (const item of CATALOG) {
      const geometry = geometryFor(item.id);
      const positions = geometry.getAttribute("position");
      const uv = geometry.getAttribute("uv");
      expect(uv.count, item.id).toBe(positions.count);
      expect([...uv.array].every(Number.isFinite), item.id).toBe(true);
      for (let i = 0; i < positions.count; i += 3) {
        for (let edge = 0; edge < 3; edge++) {
          const j = i + edge, k = i + (edge + 1) % 3;
          a.fromBufferAttribute(positions, j);
          b.fromBufferAttribute(positions, k);
          ua.fromBufferAttribute(uv, j);
          ub.fromBufferAttribute(uv, k);
          expect(ua.distanceTo(ub), `${item.id} triangle ${i / 3}`).toBeCloseTo(
            a.distanceTo(b) / TEXTURE_TILE_STUDS, 5,
          );
        }
        const du1 = uv.getX(i + 1) - uv.getX(i), dv1 = uv.getY(i + 1) - uv.getY(i);
        const du2 = uv.getX(i + 2) - uv.getX(i), dv2 = uv.getY(i + 2) - uv.getY(i);
        expect(Math.abs(du1 * dv2 - du2 * dv1), item.id).toBeGreaterThan(1e-9);
      }
    }
  });

  it("aligns source U grain with long posts and horizontal rails without stretching", () => {
    for (const size of [[1, 8, 1], [8, 0.4, 0.4], [0.4, 0.4, 8]]) {
      const longest = size.indexOf(Math.max(...size));
      const g = new BoxGeometry(...size as [number, number, number]);
      applyPhysicalUVs(g, size);
      const positions = g.getAttribute("position"), normals = g.getAttribute("normal"), uv = g.getAttribute("uv");
      for (let i = 0; i < positions.count; i++) {
        if (Math.abs(normals.getComponent(i, longest)) < 0.01) {
          expect(uv.getX(i)).toBeCloseTo(positions.getComponent(i, longest) / TEXTURE_TILE_STUDS, 6);
        }
      }
      g.dispose();
    }
  });

  it("reuses geometry and baked UV buffers across instances", () => {
    const first = geometryFor("smooth-wall");
    const again = geometryFor("smooth-wall");
    expect(again).toBe(first);
    expect(again.getAttribute("uv")).toBe(first.getAttribute("uv"));
  });
});
