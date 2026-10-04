import { BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial } from "three";
import type { Vec3 } from "./catalog";

/** A single guide draw call for the straight drag preview. */
export class PathOverlay {
  root=new Group();
  private line=new Line(new BufferGeometry(),new LineBasicMaterial({color:0xf7cf87,depthTest:false,depthWrite:false,toneMapped:false}));
  constructor() {
    this.line.geometry.setAttribute("position",new BufferAttribute(new Float32Array(6),3));
    this.line.renderOrder=25;this.line.frustumCulled=false;
    this.root.add(this.line);this.root.visible=false;
  }
  set(guide: readonly Vec3[]) {
    this.root.visible=guide.length===2;
    if(!this.root.visible) return;
    const attribute=this.line.geometry.getAttribute("position");
    guide.forEach((p,i)=>attribute.setXYZ(i,...p));
    attribute.needsUpdate=true;
  }
}
