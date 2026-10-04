import * as T from "three";
import { makeTerrainMaterials } from "./materials";
import { plotCenter, PLOT_SIZE, GRASS_HEIGHT } from "./plots";
import { applyPhysicalUVs } from "./texture-uv";

function plane(size: number) {
  const geometry = new T.PlaneGeometry(size, size, 32, 32);
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size / 8, uv.getY(i) * size / 8);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Two terrain draw calls plus one optional border pass, for all 25 cells. */
export class Terrain extends T.Group {
  private materials = makeTerrainMaterials();
  grass = new T.Mesh(plane(2048), this.materials.grass);
  plots = new T.InstancedMesh(new T.BoxGeometry(PLOT_SIZE, -GRASS_HEIGHT, PLOT_SIZE), this.materials.plot, 25);
  borders = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0xd0b27a, transparent: true, opacity: .48, depthWrite: false }));
  private layout = "";
  constructor() {
    super();
    this.grass.position.y = GRASS_HEIGHT;
    applyPhysicalUVs(this.plots.geometry, [PLOT_SIZE, -GRASS_HEIGHT, PLOT_SIZE]);
    this.grass.receiveShadow = this.plots.receiveShadow = true;
    this.add(this.grass, this.plots, this.borders);
    this.setPlots([12]);
  }
  setPlots(ids: readonly number[]) {
    const layout = ids.join(",");
    if (layout === this.layout) return;
    this.layout = layout;
    this.plots.count = ids.length;
    const matrix = new T.Matrix4(), lines: number[] = [];
    ids.forEach((id, i) => {
      const [x, z] = plotCenter(id);
      this.plots.setMatrixAt(i, matrix.makeTranslation(x, GRASS_HEIGHT / 2, z));
      const x0 = x - 20, x1 = x + 20, z0 = z - 20, z1 = z + 20;
      lines.push(x0, .012, z0, x1, .012, z0, x1, .012, z0, x1, .012, z1,
        x1, .012, z1, x0, .012, z1, x0, .012, z1, x0, .012, z0);
    });
    this.plots.instanceMatrix.needsUpdate = true;
    this.plots.computeBoundingBox(); this.plots.computeBoundingSphere();
    this.borders.geometry.dispose();
    this.borders.geometry = new T.BufferGeometry();
    this.borders.geometry.setAttribute("position", new T.Float32BufferAttribute(lines, 3));
    this.borders.geometry.computeBoundingSphere();
  }
  followCamera(x: number, z: number) {
    // Move by whole texture repeats: the grass stays visually fixed in world space.
    // Small triangles avoid depth interpolation errors from a 20,000-stud plane.
    this.grass.position.set(Math.floor(x / 64) * 64, GRASS_HEIGHT, Math.floor(z / 64) * 64);
  }
}
