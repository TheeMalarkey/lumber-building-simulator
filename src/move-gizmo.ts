import { Group, Mesh, CylinderGeometry, ConeGeometry, MeshBasicMaterial, Vector2, Vector3,
  Plane, Raycaster, PerspectiveCamera, CanvasTexture, Sprite, SpriteMaterial } from 'three';
import { selectionBounds } from './selection';
import type { Piece } from './world';
import type { Vec3 } from './catalog';

export interface AxisDrag { axis: number; plane: Plane; start: number }
const AXES = [new Vector3(1,0,0), new Vector3(0,1,0), new Vector3(0,0,1)];
type Rect = {left:number;top:number;width:number;height:number};

/** Absolute-world drag math stays independent of the renderer's floating origin. */
export class MoveGizmo {
  root = new Group();
  private handles: Group[] = [];
  private ray = new Raycaster();
  constructor() {
    const shaft = new CylinderGeometry(.018,.018,.72,8);
    const head = new ConeGeometry(.065,.2,12);
    ['#fa6b66','#81df81','#70baff'].forEach((color,i) => {
      const group = new Group();
      const material = new MeshBasicMaterial({color,depthTest:false,depthWrite:false,toneMapped:false});
      const line = new Mesh(shaft,material); line.position.y=.46;
      const tip = new Mesh(head,material); tip.position.y=.92;
      line.renderOrder=30; tip.renderOrder=30;
      group.add(line,tip);
      group.quaternion.setFromUnitVectors(AXES[1],AXES[i]);
      const canvas = document.createElement('canvas'); canvas.width=64;canvas.height=64;
      const ctx=canvas.getContext('2d')!;
      ctx.font='bold 44px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.lineWidth=6;ctx.strokeStyle='#18251f';ctx.strokeText('XYZ'[i],32,34);
      ctx.fillStyle=color;ctx.fillText('XYZ'[i],32,34);
      const label = new Sprite(new SpriteMaterial({map:new CanvasTexture(canvas),depthTest:false,depthWrite:false,toneMapped:false}));
      label.position.y=1.19;label.scale.setScalar(.28);label.renderOrder=31;
      group.add(label);this.root.add(group);this.handles.push(group);
    });
    this.root.visible=false;
  }
  setPieces(pieces: readonly Piece[]) {
    this.root.visible=pieces.length>0;
    if (pieces.length) this.root.position.fromArray(selectionBounds(pieces).center);
  }
  update(camera: PerspectiveCamera, height: number) {
    if (!this.root.visible) return;
    const center=this.root.position.clone().applyMatrix4(camera.matrixWorldInverse);
    const scale=Math.max(.01,-center.z)*2*Math.tan(camera.fov*Math.PI/360)*90/height;
    this.root.scale.setScalar(scale);
    const origin=this.root.position.clone().project(camera);
    AXES.forEach((axis,i) => {
      const end=this.root.position.clone().addScaledVector(axis,scale).project(camera);
      const pixels=Math.hypot((end.x-origin.x)*camera.aspect,(end.y-origin.y))*height/2;
      this.handles[i].visible=center.z<-.1 && pixels>15;
    });
  }
  private screenRay(x:number,y:number,camera:PerspectiveCamera,rect:Rect) {
    this.ray.setFromCamera(new Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
    return this.ray.ray;
  }
  hit(x:number,y:number,camera:PerspectiveCamera,rect:Rect): number | null {
    if (!this.root.visible) return null;
    const project=(p:Vector3) => {
      p.project(camera);return new Vector2(rect.left+(p.x+1)*rect.width/2,rect.top+(1-p.y)*rect.height/2);
    };
    const start=project(this.root.position.clone()), cursor=new Vector2(x,y);
    let best=10,found:number|null=null;
    AXES.forEach((axis,i) => {
      if (!this.handles[i].visible) return;
      const end=project(this.root.position.clone().addScaledVector(axis,this.root.scale.x));
      const segment=end.clone().sub(start),t=cursor.clone().sub(start).dot(segment)/segment.lengthSq();
      // Leave the selection center free for ordinary selection/double-clicks.
      if (t<.2 || t>1.2) return;
      const distance=cursor.distanceTo(start.clone().addScaledVector(segment,Math.min(t,1.1)));
      if (distance<best) {best=distance;found=i;}
    });
    return found;
  }
  begin(axis:number,x:number,y:number,camera:PerspectiveCamera,rect:Rect): AxisDrag | null {
    const direction=camera.getWorldDirection(new Vector3()),unit=AXES[axis];
    direction.addScaledVector(unit,-direction.dot(unit));
    if (direction.lengthSq()<1e-6) return null;
    const plane=new Plane().setFromNormalAndCoplanarPoint(direction.normalize(),this.root.position);
    const hit=this.screenRay(x,y,camera,rect).intersectPlane(plane,new Vector3());
    return hit ? {axis,plane,start:hit.dot(unit)} : null;
  }
  delta(drag:AxisDrag,x:number,y:number,camera:PerspectiveCamera,rect:Rect): Vec3 | null {
    const hit=this.screenRay(x,y,camera,rect).intersectPlane(drag.plane,new Vector3());
    if (!hit) return null;
    const delta:Vec3=[0,0,0];delta[drag.axis]=Math.round(hit.dot(AXES[drag.axis])-drag.start);
    return delta;
  }
}
