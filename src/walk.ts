import { Box3, BoxGeometry, BufferGeometry, Float32BufferAttribute, Euler, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Raycaster, Vector3 } from "three";
import classicHead from "./assets/classic-head.json";
import { ITEMS, stairTreadCount, type Vec3 } from "./catalog";
import type { Piece, World } from "./world";
import { landHeight } from "./plots";

// R6 head center is 4.5 studs; the classic visible mesh extends to 5.252.
export const WALK_EYE_HEIGHT = 4.5;
export const WALK_HEIGHT = 5.26;
export const WALK_RADIUS = 0.95;
export const WALK_STEP = 1.05;
type Bounds = { min: Vec3; max: Vec3 };
const EPS = 0.00001;
const stairCache = new WeakMap<Piece, Bounds[]>();

// Stairs use their actual treads. Other shapes deliberately use the world's
// conservative cached bounds (including wedges and decorative furniture).
function collisionBoxes(world: World, piece: Piece): Bounds[] {
  const item = ITEMS.get(piece.item)!;
  if (item.shape !== "stairs") return [world.bounds.get(piece.id)!];
  const cached = stairCache.get(piece);
  if (cached) return cached;
  const [w, h, d] = item.size, count = stairTreadCount(item);
  const rotation = new Euler(...(piece.rotation.map(v => v * Math.PI / 2) as Vec3), "YXZ");
  const boxes: Bounds[] = [];
  for (let i = 0; i < count; i++) {
    const height = h * (i + 1) / count, z = d / 2 - (i + 0.5) * d / count;
    const box = new Box3();
    for (const x of [-w / 2, w / 2]) for (const y of [-h / 2, -h / 2 + height])
      for (const zz of [z - d / count / 2, z + d / count / 2])
        box.expandByPoint(new Vector3(x, y, zz).applyEuler(rotation).add(new Vector3(...piece.position)));
    boxes.push({ min: box.min.toArray() as Vec3, max: box.max.toArray() as Vec3 });
  }
  stairCache.set(piece, boxes);
  return boxes;
}

/** Rendering-independent feet-position controller, in absolute world studs. */
export class WalkPhysics {
  position = new Vector3();
  velocity = new Vector3();
  grounded = false;
  constructor(readonly world: World) {}
  private nearby(position = this.position, extra = 0) {
    return this.world.query([position.x, position.y + WALK_HEIGHT / 2, position.z], WALK_HEIGHT + extra)
      .flatMap(piece => collisionBoxes(this.world, piece));
  }
  private overlaps(position: Vector3, box: Bounds) {
    return position.x + WALK_RADIUS > box.min[0] + EPS && position.x - WALK_RADIUS < box.max[0] - EPS &&
      position.z + WALK_RADIUS > box.min[2] + EPS && position.z - WALK_RADIUS < box.max[2] - EPS &&
      position.y + WALK_HEIGHT > box.min[1] + EPS && position.y < box.max[1] - EPS;
  }
  canOccupy(position: Vector3) {
    return position.y >= landHeight(position.x, position.z, this.world.plots) - EPS && !this.nearby(position).some(box => this.overlaps(position, box));
  }
  spawn(reference: Vector3) {
    // Land on a valid surface immediately, instead of dropping from the flycam.
    const top = Math.max(0, Math.min(100000, reference.y)) + WALK_HEIGHT;
    for (let ring = 0; ring <= 40; ring++) {
      const count = ring ? ring * 8 : 1;
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        const x = reference.x + Math.cos(angle) * ring * 2.2;
        const z = reference.z + Math.sin(angle) * ring * 2.2;
        const supports = this.world.rayCandidates([x, top, z], [0, -1, 0], top)
          .flatMap(hit => collisionBoxes(this.world, hit.piece))
          .filter(box => x >= box.min[0] && x <= box.max[0] && z >= box.min[2] && z <= box.max[2])
          .map(box => box.max[1]).filter(y => y >= 0 && y <= top);
        for (const y of [landHeight(x, z, this.world.plots), ...supports.sort((a, b) => b - a)]) {
          const candidate = new Vector3(x, y, z);
          if (this.canOccupy(candidate)) {
            this.position.copy(candidate);
            this.velocity.set(0, 0, 0);
            this.grounded = true;
            return true;
          }
        }
      }
    }
    return false;
  }
  update(dt: number, direction: Vector3, fast = false, jump = false) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const duration = Math.min(dt, 0.1), steps = Math.ceil(duration * 120), step = duration / steps;
    const movement = new Vector3(direction.x, 0, direction.z);
    if (movement.lengthSq() > 1) movement.normalize();
    movement.multiplyScalar(fast ? 24 : 16);
    this.velocity.x = movement.x;
    this.velocity.z = movement.z;
    if (jump && this.grounded) { this.velocity.y = 50; this.grounded = false; }
    for (let i = 0; i < steps; i++) {
      const boxes = this.nearby(this.position, 1);
      for (const axis of ["x", "z"] as const) {
        const amount = this.velocity[axis] * step;
        if (!amount) continue;
        const candidate = this.position.clone();
        candidate[axis] += amount;
        const groundY = landHeight(candidate.x, candidate.z, this.world.plots);
        if (candidate.y < groundY) {
          const lifted = candidate.clone().setY(groundY);
          if (!this.canOccupy(lifted)) continue;
          candidate.y = groundY;
        }
        const blocked = boxes.filter(box => this.overlaps(candidate, box));
        if (blocked.length && this.grounded) {
          const height = Math.max(...blocked.map(box => box.max[1]));
          const lifted = candidate.clone().setY(height);
          const above = this.position.clone().setY(height);
          if (height > this.position.y && height - this.position.y <= WALK_STEP + EPS &&
              !boxes.some(box => this.overlaps(lifted, box) || this.overlaps(above, box))) {
            this.position.copy(lifted);
            continue;
          }
        }
        const index = axis === "x" ? 0 : 2;
        for (const box of blocked) candidate[axis] = amount > 0
          ? Math.min(candidate[axis], box.min[index] - WALK_RADIUS)
          : Math.max(candidate[axis], box.max[index] + WALK_RADIUS);
        this.position.copy(candidate);
      }
      this.velocity.y -= 196.2 * step;
      const oldY = this.position.y, amount = this.velocity.y * step;
      this.position.y += amount;
      this.grounded = false;
      for (const box of boxes) {
        if (!this.overlaps(this.position, box)) continue;
        if (amount < 0 && oldY >= box.max[1] - EPS) {
          this.position.y = Math.max(this.position.y, box.max[1]);
          this.velocity.y = 0;
          this.grounded = true;
        } else if (amount > 0 && oldY + WALK_HEIGHT <= box.min[1] + EPS) {
          this.position.y = Math.min(this.position.y, box.min[1] - WALK_HEIGHT);
          this.velocity.y = 0;
        }
      }
      const groundY = landHeight(this.position.x, this.position.z, this.world.plots);
      if (this.position.y <= groundY) { this.position.y = groundY; this.velocity.y = 0; this.grounded = true; }
    }
  }
  cameraPosition(target: Vector3, desired: Vector3) {
    const delta = desired.clone().sub(target), length = delta.length();
    if (!length) return target.clone();
    const direction = delta.clone().divideScalar(length);
    let distance = length;
    // An expanded-box ray leaves room for the camera's near plane.
    const midpoint = target.clone().add(desired).multiplyScalar(0.5);
    for (const box of this.nearby(midpoint, length / 2)) {
      let near = 0, far = length;
      for (let axis = 0; axis < 3; axis++) {
        const origin = target.getComponent(axis), d = direction.getComponent(axis);
        const min = box.min[axis] - 0.25, max = box.max[axis] + 0.25;
        if (Math.abs(d) < EPS) { if (origin < min || origin > max) far = -1; }
        else {
          const a = (min - origin) / d, b = (max - origin) / d;
          near = Math.max(near, Math.min(a, b));
          far = Math.min(far, Math.max(a, b));
        }
      }
      if (near <= far && far >= 0) distance = Math.min(distance, Math.max(0, near - 0.05));
    }
    if (direction.y < 0) distance = Math.min(distance, Math.max(0, (target.y - 0.3) / -direction.y));
    return target.clone().addScaledVector(direction, distance);
  }
}

export class WalkController extends WalkPhysics {
  avatar = new Group();
  private limbs: Group[] = [];
  private phase = 0;
  constructor(world: World) {
    super(world);
    this.avatar.name = "Walk avatar";
    this.avatar.visible = false;
    const skin = new MeshStandardMaterial({ color: 0xf0c786, roughness: 0.85 });
    const shirt = new MeshStandardMaterial({ color: 0x4387bb, roughness: 0.9 });
    const pants = new MeshStandardMaterial({ color: 0x314454, roughness: 0.9 });
    const face = new MeshStandardMaterial({ color: 0x302921, roughness: 1 });
    const part = (parent: Group, size: number[], position: number[], material: MeshStandardMaterial) => {
      const mesh = new Mesh(new BoxGeometry(...(size as [number, number, number])), material);
      mesh.position.set(...(position as [number, number, number]));
      mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    part(this.avatar, [2, 2, 1], [0, 3, 0], shirt);
    const headGeometry = new BufferGeometry();
    headGeometry.setAttribute("position", new Float32BufferAttribute(classicHead.positions, 3));
    headGeometry.setAttribute("normal", new Float32BufferAttribute(classicHead.normals, 3));
    headGeometry.setIndex(classicHead.indices);
    const head = new Mesh(headGeometry, skin);
    head.name = "Head";
    head.position.y = WALK_EYE_HEIGHT;
    head.castShadow = head.receiveShadow = true;
    this.avatar.add(head);
    head.updateMatrixWorld(true);
    // Bake the smile onto the curved head once, with no per-frame projection.
    const ray = new Raycaster();
    const facialMark = (width: number, height: number, x: number, y: number) => {
      const geometry = new PlaneGeometry(width, height, 4, 2);
      geometry.rotateY(Math.PI);
      geometry.translate(x, y, 0);
      const positions = geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        ray.set(new Vector3(positions.getX(i), positions.getY(i), -2), new Vector3(0, 0, 1));
        const hit = ray.intersectObject(head, false)[0];
        positions.setZ(i, (hit?.point.z ?? -0.7) - 0.006);
      }
      geometry.computeVertexNormals();
      this.avatar.add(new Mesh(geometry, face));
    };
    for (const x of [-0.25, 0.25]) facialMark(0.11, 0.17, x, 4.62);
    facialMark(0.42, 0.065, 0, 4.25);
    for (const x of [-0.22, 0.22]) facialMark(0.06, 0.13, x, 4.31);
    for (const [x, y, material] of [[-1.5, 3.5, skin], [1.5, 3.5, skin], [-0.5, 2, pants], [0.5, 2, pants]] as const) {
      const pivot = new Group(); pivot.position.set(x, y, 0); this.avatar.add(pivot);
      part(pivot, [1, 2, 1], [0, y === 3.5 ? -0.5 : -1, 0], material); this.limbs.push(pivot);
    }
  }
  animate(dt: number, direction: Vector3) {
    this.avatar.position.copy(this.position);
    const moving = direction.lengthSq() > 0.01;
    if (moving) {
      const angle = Math.atan2(-direction.x, -direction.z);
      const difference = Math.atan2(Math.sin(angle - this.avatar.rotation.y), Math.cos(angle - this.avatar.rotation.y));
      this.avatar.rotation.y += difference * Math.min(1, dt * 14);
      this.phase += dt * (this.velocity.length() > 20 ? 14 : 10);
    }
    this.limbs.forEach((limb, index) => {
      const target = !this.grounded ? (index < 2 ? -1.7 : 0.25) : moving ? Math.sin(this.phase) * 0.6 * (index % 2 ? 1 : -1) * (index < 2 ? -1 : 1) : 0;
      limb.rotation.x += (target - limb.rotation.x) * Math.min(1, dt * 18);
    });
  }
}
