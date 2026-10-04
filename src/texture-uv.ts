import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";

// One repeat per eight studs. This is a documented visual approximation, not
// a claim that the Roblox material renderer uses this exact scaling.
export const TEXTURE_TILE_STUDS = 8;

/** Bake a constant-scale, orthonormal surface projection once per component.
 * The source wood's grain runs along U, so align U to the component's longest
 * axis projected onto each face. End faces use the next available axis.
 * Call with split face vertices / flat normals before merging components.
 */
export function applyPhysicalUVs(
  geometry: BufferGeometry,
  size: readonly number[],
  grainAxis?: 0 | 1 | 2,
): void {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const axes = [0, 1, 2].sort((a, b) => size[b] - size[a]);
  if (grainAxis !== undefined) axes.unshift(...axes.splice(axes.indexOf(grainAxis), 1));
  const uv = new Float32Array(position.count * 2);
  const n = new Vector3(), u = new Vector3(), v = new Vector3(), p = new Vector3();
  for (let i = 0; i < position.count; i++) {
    n.fromBufferAttribute(normal, i).normalize();
    for (const axis of axes) {
      u.set(0, 0, 0).setComponent(axis, 1);
      u.addScaledVector(n, -u.dot(n));
      if (u.lengthSq() > 1e-8) break;
    }
    u.normalize();
    v.crossVectors(n, u).normalize();
    p.fromBufferAttribute(position, i);
    uv[i * 2] = p.dot(u) / TEXTURE_TILE_STUDS;
    uv[i * 2 + 1] = p.dot(v) / TEXTURE_TILE_STUDS;
  }
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
}
