import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { Vec3 } from "./catalog";
export const round = (n: number) => Math.round(n * 10000) / 10000;
export const STUD_STEP = 1;
export const snapMovement = (value: number, origin = 0) =>
  round(origin + Math.round((value - origin) / STUD_STEP) * STUD_STEP);
export function rotatedSize(size: Vec3, rotation: Vec3): Vec3 {
  const m = new Matrix4().makeRotationFromEuler(
    new Euler(...(rotation.map((v) => (v * Math.PI) / 2) as Vec3), "YXZ"),
  ).elements;
  return [0, 1, 2].map((i) =>
    round(
      Math.abs(m[i]) * size[0] +
        Math.abs(m[4 + i]) * size[1] +
        Math.abs(m[8 + i]) * size[2],
    ),
  ) as Vec3;
}
export function snapOnSurface(
  point: Vec3,
  normal: Vec3,
  size: Vec3,
  step: number,
  supportDistance?: number,
): Vec3 {
  const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  // Snap the footprint edge, keeping odd-width pieces inside grid cells.
  // The support axis is solved separately below so contact stays flush.
  const result = point.map(
    (v, i) => Math.round((v - size[i] / 2) / step) * step + size[i] / 2,
  ) as Vec3;
  const support = supportDistance ?? normal.reduce(
    (sum, n, i) => sum + (Math.abs(n) * size[i]) / 2,
    0,
  );
  const plane = point.reduce((sum, n, i) => sum + n * normal[i], 0);
  const tangent = result.reduce(
    (sum, n, i) => sum + (i === axis ? 0 : n * normal[i]),
    0,
  );
  result[axis] = (plane + support - tangent) / normal[axis];
  return result.map(round) as Vec3;
}
export function quaternionRotation(rotation: Vec3) {
  return new Euler(
    (rotation[0] * Math.PI) / 2,
    (rotation[1] * Math.PI) / 2,
    (rotation[2] * Math.PI) / 2,
    "YXZ",
  );
}
/** Compose a world-axis quarter turn, then encode it in the existing save format.
 * Incrementing Euler pitch alone ties tilt to yaw and cannot reach all 24 poses.
 */
export function turnRotation(rotation: Vec3, axis: number): Vec3 {
  const turn = new Quaternion().setFromAxisAngle(new Vector3().setComponent(axis, 1), Math.PI / 2);
  const target = new Quaternion().setFromEuler(quaternionRotation(rotation)).premultiply(turn);
  const candidate = new Quaternion();
  // Enumerating integer quarter turns avoids Euler gimbal-lock rounding and
  // gives every equivalent pose one deterministic, file-compatible encoding.
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) {
    const encoded: Vec3 = [x, y, z];
    candidate.setFromEuler(quaternionRotation(encoded));
    if (Math.abs(candidate.dot(target)) > 1 - 1e-8) return encoded;
  }
  throw new Error("Cannot encode blueprint orientation.");
}
export function worldNormal(normal: Vector3, matrix: Matrix4): Vec3 {
  return normal.clone().transformDirection(matrix).toArray() as Vec3;
}
