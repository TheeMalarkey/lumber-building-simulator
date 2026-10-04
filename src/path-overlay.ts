import { BufferAttribute, BufferGeometry, Group, InstancedMesh, Line, LineBasicMaterial,
  Matrix4, MeshBasicMaterial, PerspectiveCamera, Quaternion, SphereGeometry, Vector3, Color } from "three";
import type { Vec3 } from "./catalog";

/** One guide and one marker batch, independent of the number of preview blueprints. */
export class PathOverlay {
  root = new Group();
  private line = new Line(new BufferGeometry(),new LineBasicMaterial({color:0xf7cf87,depthTest:false,depthWrite:false,toneMapped:false}));
  private markers = new InstancedMesh(new SphereGeometry(1,12,8),new MeshBasicMaterial({color:0xffffff,depthTest:false,depthWrite:false,toneMapped:false}),8);
  private points: readonly Vec3[]=[];
  private selected=-1;
  constructor() {
    this.line.renderOrder=25;this.markers.renderOrder=26;this.markers.frustumCulled=false;
    this.root.add(this.line,this.markers);this.root.visible=false;
  }
  set(guide: readonly Vec3[], points: readonly Vec3[], selected:number) {
    this.points=points;this.selected=selected;this.root.visible=points.length>0;
    const capacity=this.line.geometry.getAttribute("position")?.count ?? 0;
    if (capacity<guide.length) this.line.geometry.setAttribute("position",new BufferAttribute(new Float32Array(3*2**Math.ceil(Math.log2(Math.max(8,guide.length)))),3));
    const attribute=this.line.geometry.getAttribute("position");
    guide.forEach((p,i)=>attribute.setXYZ(i,...p));
    if (attribute) attribute.needsUpdate=true;
    this.line.geometry.setDrawRange(0,guide.length);this.line.frustumCulled=false;
    if (this.markers.instanceMatrix.count<points.length) {
      const old=this.markers;this.root.remove(old);
      this.markers=new InstancedMesh(old.geometry,old.material,2**Math.ceil(Math.log2(points.length)));
      this.markers.renderOrder=26;this.markers.frustumCulled=false;this.root.add(this.markers);old.dispose();
    }
    this.markers.count=points.length;
  }
  update(camera:PerspectiveCamera,height:number) {
    if (!this.root.visible) return;
    const matrix=new Matrix4(),rotation=new Quaternion(),scale=new Vector3(),position=new Vector3();
    this.points.forEach((p,i)=>{
      position.fromArray(p);
      const depth=-position.clone().applyMatrix4(camera.matrixWorldInverse).z;
      scale.setScalar(Math.max(.01,depth)*2*Math.tan(camera.fov*Math.PI/360)*7/height);
      this.markers.setMatrixAt(i,matrix.compose(position,rotation,scale));
      this.markers.setColorAt(i,new Color(i===this.selected ? 0xa6e787 : 0xf7cf87));
    });
    this.markers.instanceMatrix.needsUpdate=true;
    if(this.markers.instanceColor) this.markers.instanceColor.needsUpdate=true;
  }
  hit(x:number,y:number,camera:PerspectiveCamera,rect:DOMRect) {
    let best=14,hit=-1;
    this.points.forEach((point,i)=>{
      const p=new Vector3(...point).project(camera);if(p.z<-1 || p.z>1) return;
      const distance=Math.hypot(rect.left+(p.x+1)*rect.width/2-x,rect.top+(1-p.y)*rect.height/2-y);
      if(distance<best) {best=distance;hit=i;}
    });
    return hit;
  }
}
