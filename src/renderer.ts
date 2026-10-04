import * as T from "three";
import { World, CHUNK, chunkKey, type Piece } from "./world";
import { ITEMS, type Vec3, CATALOG } from "./catalog";
import { geometryFor } from "./geometry";
import { makeMaterials, makeBlueprintHardwareMaterials, makeGlassMaterial, makeFurnitureMaterials } from "./materials";
import { quaternionRotation, STUD_STEP } from "./placement";
import { CameraController } from "./camera";
import { Terrain } from "./terrain";
import { PLOT_SIZE } from "./plots";
import { GRID_FRAGMENT } from "./grid";
import { MoveGizmo } from "./move-gizmo";
import { pieceBounds } from "./world";
export interface Pick {
  point: Vec3;
  normal: Vec3;
  id?: string;
}
export class Viewport {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera: CameraController;
  worldRoot = new T.Group();
  gizmo = new MoveGizmo();
  materials = makeMaterials();
  hardwareMaterials = makeBlueprintHardwareMaterials();
  glassMaterial = makeGlassMaterial();
  furnitureMaterials = makeFurnitureMaterials();
  private glassDoorMaterials = [this.glassMaterial,this.hardwareMaterials[0]];
  private blueprintMaterials = new Map([...this.materials].map(([id, wood]) => [id, [wood, ...this.hardwareMaterials]]));
  loaded = new Map<string, T.Group>();
  raycaster = new T.Raycaster();
  ghost: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial> = new T.Mesh(
    new T.BoxGeometry(),
    new T.MeshStandardMaterial({
      color: 0xe6b268,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      roughness: 0.5,
    }),
  );
  selection = new T.Box3Helper(new T.Box3(), 0xe9ac50);
  selectionLines = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({color:0xe9ac50,depthTest:false,depthWrite:false}));
  groupGhosts = new T.Group();
  private highlighted: readonly Piece[] = [];
  grid: T.Mesh;
  terrain = new Terrain();
  sun = new T.DirectionalLight(0xffefdb, 3.0);
  renderDistance = 384;
  quality = "balanced";
  adaptive = true;
  origin = new T.Vector3();
  lastSync = 0;
  frames: number[] = [];
  fps = 60;
  frameMs = 16.7;
  onFrame = () => {};
  onStats = () => {};
  private previous = performance.now();
  private lastStats = 0;
  private pixelScale = 1;
  private disposed = false;
  private plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  private tmpMesh = new T.Mesh();
  private queue: string[] = [];
  private desired = new Set<string>();
  constructor(
    public element: HTMLElement,
    public world: World,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0xd8dbce);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.domElement.setAttribute("aria-label", "3D building viewport");
    this.renderer.domElement.tabIndex = 0;
    element.prepend(this.renderer.domElement);
    this.camera = new CameraController(this.renderer.domElement, this.world);
    this.worldRoot.add(this.camera.walker.avatar);
    this.scene.background = new T.Color(0xd8dbce);
    this.scene.fog = new T.FogExp2(0xd8dbce, 0.0038);
    this.scene.add(
      this.worldRoot,
      new T.HemisphereLight(0xe8f0ff, 0x8d9478, 2.3),
    );
    this.sun.position.set(35, 55, 22);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -65,
      right: 65,
      top: 65,
      bottom: -65,
      near: 1,
      far: 180,
    });
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);
    this.worldRoot.add(this.terrain);
    this.grid = new T.Mesh(
      new T.PlaneGeometry(1024, 1024, 16, 16),
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        uniforms: {
          uOffset: { value: new T.Vector2() },
          uCamera: { value: new T.Vector2() },
          uColor: { value: new T.Color(0x493c28) },
          uStep: { value: STUD_STEP },
          uMajorStep: { value: PLOT_SIZE / 5 },
          uMajorOffset: { value: PLOT_SIZE / 2 },
          uPlots: { value: Array.from({ length: 25 }, (_, i) => i === 12 ? 1 : 0) },
        },
        vertexShader:
          "varying vec2 vPos; uniform vec2 uOffset; void main(){vPos=position.xy+uOffset;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader: GRID_FRAGMENT,
      }),
    );
    this.grid.rotation.x = -Math.PI / 2;
    this.grid.position.y = 0.02;
    this.grid.renderOrder = 1;
    this.scene.add(this.grid);
    this.ghost.visible = false;
    this.ghost.castShadow = false;
    this.worldRoot.add(this.ghost);
    this.selection.visible = false;
    (this.selection.material as T.Material).depthTest = false;
    this.selection.renderOrder = 10;
    this.worldRoot.add(this.selection);
    this.selectionLines.visible = false;
    this.selectionLines.renderOrder = 10;
    this.worldRoot.add(this.selectionLines, this.groupGhosts, this.gizmo.root);
    new ResizeObserver(() => this.resize()).observe(element);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      element.dispatchEvent(new CustomEvent("graphicslost"));
    });
  }
  resize() {
    const w = this.element.clientWidth,
      h = this.element.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.camera.aspect = w / h;
    this.camera.camera.updateProjectionMatrix();
  }
  setPlots(ids: readonly number[]) {
    this.terrain.setPlots(ids);
    const mask = (this.grid.material as T.ShaderMaterial).uniforms.uPlots.value as number[];
    for (let i = 0; i < 25; i++) mask[i] = Number(ids.includes(i));
  }
  setQuality(value: string) {
    this.quality = value;
    this.renderer.shadowMap.enabled = value !== "performance";
    this.pixelScale =
      value === "quality"
        ? Math.min(devicePixelRatio, 2)
        : value === "performance"
          ? 0.8
          : Math.min(devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(this.pixelScale);
    this.resize();
  }
  materialFor(item: string, wood: string): T.MeshStandardMaterial | T.MeshStandardMaterial[] {
    if(ITEMS.get(item)!.fixedMaterial === "furniture") return this.furnitureMaterials;
    if(ITEMS.get(item)!.fixedMaterial === "glass") return item === "glass-door" ? this.glassDoorMaterials : this.glassMaterial;
    const shape = ITEMS.get(item)!.shape;
    return shape === "door" || shape === "sink" ? this.blueprintMaterials.get(wood)! : this.materials.get(wood)!;
  }
  private buildChunk(key: string) {
    let group = this.loaded.get(key);
    if (!group) {
      group = new T.Group();
      const c = key.split(",").map(Number);
      group.position.set(c[0] * CHUNK, c[1] * CHUNK, c[2] * CHUNK);
      this.worldRoot.add(group);
      this.loaded.set(key, group);
    }
    const batches = new Map<string, Piece[]>();
    for (const id of this.world.chunks.get(key) ?? []) {
      const p = this.world.pieces.get(id)!;
      const k = p.item + "|" + (ITEMS.get(p.item)!.fixedMaterial ?? p.wood);
      if (!batches.has(k)) batches.set(k, []);
      batches.get(k)!.push(p);
    }
    const old = new Map(
      group.children.map((m) => [m.name, m as T.InstancedMesh]),
    );
    for (const [k, pieces] of batches) {
      let mesh = old.get(k);
      old.delete(k);
      if (mesh && mesh.instanceMatrix.count < pieces.length) {
        group.remove(mesh);
        mesh.dispose();
        mesh = undefined;
      }
      if (!mesh) {
        const first = pieces[0];
        mesh = new T.InstancedMesh(
          geometryFor(first.item),
          this.materialFor(first.item, first.wood),
          Math.max(8, 2 ** Math.ceil(Math.log2(pieces.length))),
        );
        mesh.name = k;
        mesh.castShadow = ITEMS.get(first.item)!.fixedMaterial !== "glass";
        mesh.receiveShadow = true;
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        group.add(mesh);
      }
      mesh.count = pieces.length;
      mesh.userData.ids = pieces.map((p) => p.id);
      const m = new T.Matrix4(),
        q = new T.Quaternion(),
        v = new T.Vector3();
      pieces.forEach((p, i) => {
        v.fromArray(p.position).sub(group!.position);
        q.setFromEuler(quaternionRotation(p.rotation));
        m.compose(v, q, new T.Vector3(1, 1, 1));
        mesh!.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.computeBoundingBox();
    }
    for (const m of old.values()) {
      group.remove(m);
      m.dispose();
    }
    if (!batches.size) {
      this.worldRoot.remove(group);
      this.loaded.delete(key);
    }
  }
  sync(force = false) {
    const now = performance.now();
    if (force || now - this.lastSync > 400) {
      this.lastSync = now;
      this.desired.clear();
      const p = this.camera.camera.position;
      // Index lookup is bounded by render distance, not total saved chunk count.
      const n = Math.ceil(this.renderDistance / CHUNK),
        cx = Math.floor(p.x / CHUNK),
        cy = Math.floor(p.y / CHUNK),
        cz = Math.floor(p.z / CHUNK);
      for (let x = cx - n; x <= cx + n; x++)
        for (let y = cy - n; y <= cy + n; y++)
          for (let z = cz - n; z <= cz + n; z++) {
            const k = `${x},${y},${z}`;
            if (!this.world.chunks.get(k)?.size) continue;
            const dx = (x + 0.5) * CHUNK - p.x,
              dy = (y + 0.5) * CHUNK - p.y,
              dz = (z + 0.5) * CHUNK - p.z;
            if (dx * dx + dy * dy + dz * dz < (this.renderDistance + 56) ** 2)
              this.desired.add(k);
          }
      for (const [k, g] of this.loaded) {
        const c = g.position;
        if (
          c.distanceTo(p) > this.renderDistance + 128 ||
          !this.world.chunks.get(k)?.size
        ) {
          this.worldRoot.remove(g);
          for (const m of g.children) (m as T.InstancedMesh).dispose();
          this.loaded.delete(k);
        }
      }
      this.queue = [...this.desired].filter((k) => !this.loaded.has(k));
      this.queue.sort((a, b) => {
        const distance = (key: string) =>
          key
            .split(",")
            .reduce(
              (s, c, i) => s + (Number(c) * CHUNK - p.getComponent(i)) ** 2,
              0,
            );
        return distance(a) - distance(b);
      });
    }
    for (const k of this.world.dirty) {
      if (this.loaded.has(k) || this.desired.has(k)) this.buildChunk(k);
    }
    this.world.dirty.clear();
    const start = performance.now();
    while (this.queue.length && (performance.now() - start < 7 || force)) {
      const k = this.queue.shift()!;
      if (!this.loaded.has(k)) this.buildChunk(k);
    }
  }
  pick(clientX: number, clientY: number, exclude?: string | ReadonlySet<string> | null): Pick | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new T.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      (-(clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.camera.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(ndc, this.camera.camera);
    this.raycaster.far = this.renderDistance;
    const candidates = this.world.rayCandidates(
      this.raycaster.ray.origin.toArray() as Vec3,
      this.raycaster.ray.direction.toArray() as Vec3,
      this.renderDistance,
    );
    let best: T.Intersection | null = null;
    let id: string | undefined;
    for (const candidate of candidates) {
      if (best && candidate.distance > best.distance) break;
      const p = candidate.piece;
      if (typeof exclude === "string" ? p.id === exclude : exclude?.has(p.id)) continue;
      this.tmpMesh.geometry = geometryFor(p.item);
      this.tmpMesh.position.fromArray(p.position);
      this.tmpMesh.rotation.copy(quaternionRotation(p.rotation));
      this.tmpMesh.updateMatrixWorld(true);
      const hits = this.raycaster.intersectObject(this.tmpMesh, false);
      if (hits[0] && (!best || hits[0].distance < best.distance)) {
        best = hits[0];
        id = p.id;
        best.normal = hits[0]
          .face!.normal.clone()
          .transformDirection(this.tmpMesh.matrixWorld);
      }
    }
    if (best)
      return {
        id,
        point: best.point.toArray() as Vec3,
        normal: best.normal!.toArray() as Vec3,
      };
    const ground = this.raycaster.ray.intersectPlane(
      this.plane,
      new T.Vector3(),
    );
    if (
      ground &&
      ground.distanceTo(this.camera.camera.position) < this.renderDistance
    )
      return { point: ground.toArray() as Vec3, normal: [0, 1, 0] };
    return null;
  }
  showGhost(p: Piece | null, valid = true) {
    this.ghost.visible = !!p;
    if (!p) return;
    this.ghost.geometry = geometryFor(p.item);
    this.ghost.position.fromArray(p.position);
    this.ghost.rotation.copy(quaternionRotation(p.rotation));
    (this.ghost.material as T.MeshStandardMaterial).color.set(
      valid ? 0xe7b465 : 0xe15d4f,
    );
  }
  showGroupGhosts(pieces: readonly Piece[], valid = true) {
    this.ghost.visible = false;
    const material = this.ghost.material;
    material.color.set(valid ? 0xe7b465 : 0xe15d4f);
    const batches = new Map<string, Piece[]>();
    for (const p of pieces) { if (!batches.has(p.item)) batches.set(p.item,[]);batches.get(p.item)!.push(p); }
    const old = new Map(this.groupGhosts.children.map(m=>[m.name,m as T.InstancedMesh]));
    const matrix = new T.Matrix4(), q=new T.Quaternion(), position=new T.Vector3(), scale=new T.Vector3(1,1,1);
    for (const [item, batch] of batches) {
      let mesh=old.get(item);old.delete(item);
      if (mesh && mesh.instanceMatrix.count<batch.length) {this.groupGhosts.remove(mesh);mesh.dispose();mesh=undefined;}
      if (!mesh) {
        mesh=new T.InstancedMesh(geometryFor(item),material,Math.max(8,2**Math.ceil(Math.log2(batch.length))));
        mesh.name=item;mesh.frustumCulled=false;this.groupGhosts.add(mesh);
      }
      mesh.count=batch.length;
      batch.forEach((p,i)=>{matrix.compose(position.fromArray(p.position),q.setFromEuler(quaternionRotation(p.rotation)),scale);mesh!.setMatrixAt(i,matrix);});
      mesh.instanceMatrix.needsUpdate=true;
    }
    for (const mesh of old.values()) { this.groupGhosts.remove(mesh);mesh.dispose(); }
  }
  selectMany(pieces: readonly Piece[]) {
    // World edits replace records. Reuse outlines while inspector-only state changes.
    if (pieces.length === this.highlighted.length && pieces.every((p, i) => p === this.highlighted[i])) return;
    this.highlighted = [...pieces];
    this.select(pieces.length === 1 ? pieces[0] : null);
    this.selectionLines.visible=pieces.length>1;
    if (pieces.length<=1) {this.selectionLines.geometry.setDrawRange(0,0);return;}
    const data=new Float32Array(pieces.length*24*3);
    const edges=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
    let index=0;
    for (const p of pieces) {
      const b=this.world.bounds.get(p.id) ?? pieceBounds(p);
      for (const edge of edges) for (const corner of edge) for (let axis=0;axis<3;axis++)
        data[index++]=(corner&(1<<axis))?b.max[axis]+.04:b.min[axis]-.04;
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.BufferAttribute(data,3));geometry.computeBoundingSphere();
    this.selectionLines.geometry.dispose();this.selectionLines.geometry=geometry;
  }
  select(p: Piece | null) {
    this.selection.visible = !!p;
    if (p) {
      const box = geometryFor(p.item).boundingBox!.clone();
      const matrix = new T.Matrix4().compose(
        new T.Vector3(...p.position),
        new T.Quaternion().setFromEuler(quaternionRotation(p.rotation)),
        new T.Vector3(1, 1, 1),
      );
      this.selection.box.copy(box.applyMatrix4(matrix)).expandByScalar(0.04);
    }
  }
  private tick() {
    if (this.disposed) return;
    const now = performance.now(),
      ms = now - this.previous;
    this.previous = now;
    this.frames.push(ms);
    if (this.frames.length > 240) this.frames.shift();
    this.camera.update(Math.min(ms / 1000, 0.05));
    this.onFrame();
    this.sync();
    const camera = this.camera.camera;
    this.gizmo.update(camera, this.element.clientHeight);
    this.terrain.followCamera(camera.position.x, camera.position.z);
    this.origin.set(
      Math.floor(camera.position.x / CHUNK) * CHUNK,
      Math.floor(camera.position.y / CHUNK) * CHUNK,
      Math.floor(camera.position.z / CHUNK) * CHUNK,
    );
    this.worldRoot.position.copy(this.origin).negate();
    const saved = camera.position.clone();
    camera.position.sub(this.origin);
    this.grid.position.set(0, -this.origin.y + 0.02, 0);
    (this.grid.material as T.ShaderMaterial).uniforms.uOffset.value.set(
      this.origin.x,
      -this.origin.z,
    );
    (this.grid.material as T.ShaderMaterial).uniforms.uCamera.value.set(
      saved.x,
      -saved.z,
    );
    this.sun.target.position.copy(this.camera.controls.target).sub(this.origin);
    this.sun.position
      .copy(this.sun.target.position)
      .add(new T.Vector3(35, 55, 22));
    this.scene.fog instanceof T.FogExp2 &&
      (this.scene.fog.density = 1.8 / this.renderDistance);
    this.renderer.render(this.scene, camera);
    camera.position.copy(saved);
    camera.updateMatrixWorld();
    if (now - this.lastStats > 800) {
      this.lastStats = now;
      this.frameMs =
        this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
      this.fps = Math.round(1000 / this.frameMs);
      if (
        this.adaptive &&
        this.frames.length > 120 &&
        this.frameMs > 30 &&
        this.pixelScale > 0.6
      ) {
        this.pixelScale = Math.max(0.6, this.pixelScale - 0.1);
        this.renderer.setPixelRatio(this.pixelScale);
        this.resize();
      }
      this.onStats();
    }
  }
  get stats() {
    return {
      fps: this.fps,
      frameMs: this.frameMs,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      total: this.world.pieces.size,
      visibleChunks: this.loaded.size,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      pixelRatio: this.renderer.getPixelRatio(),
      backend: "WebGL2",
    };
  }
  thumbnails() {
    const result = new Map<string, string>();
    const r = new T.WebGLRenderer({ alpha: true, antialias: true });
    r.setSize(200, 150);
    r.setPixelRatio(1);
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.25;
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xffffff, 0x8b7560, 3));
    const light = new T.DirectionalLight(0xffffff, 3);
    light.position.set(5, 10, 7);
    scene.add(light);
    const camera = new T.PerspectiveCamera(30, 4 / 3, 0.1, 100);
    const mesh = new T.Mesh();
    scene.add(mesh);

    for (const item of CATALOG) {
      mesh.geometry = geometryFor(item.id);
      mesh.material = this.materialFor(item.id, "oak");
      const n = Math.max(...item.size);
      camera.position.set(n * 1.65, n * 1.18, n * 1.8);
      camera.lookAt(0, 0, 0);
      r.render(scene, camera);
      result.set(item.id, r.domElement.toDataURL("image/webp", 0.8));
    }
    r.dispose();

    return result;
  }
}
