import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { ITEMS, type Vec3 } from "./catalog";
import { buildPath, nextRampPoint, type BuildMode, type PathOptions, type WedgeMode } from "./build-path";
import { snapBlueprintOnSurface } from "./collision";
import { snapMovement } from "./placement";
import { PathOverlay } from "./path-overlay";
import type { AxisDrag } from "./move-gizmo";
import type { Editor } from "./editor";
import type { Piece } from "./world";

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;
type Draft = {anchors:Vec3[];selected:number;mode:PathOptions["mode"];planeY:number};
type Gesture = {id:number;start:[number,number];kind:"line"|"add"|"select"|"point";point?:Vec3;math?:AxisDrag;index?:number};

/** Owns build gestures before selection listeners; it never changes an existing blueprint. */
export class PathBuilder {
  mode:BuildMode="single";
  wedge:WedgeMode="ramp";
  fill=false;
  anchors:Vec3[]=[];
  selectedPoint=-1;
  preview:Piece[]=[];
  issue:ReturnType<Editor["world"]["placementIssue"]>=null;
  private draftMode:PathOptions["mode"]="line";
  private planeY=0;
  private gesture:Gesture|null=null;
  private suspended:Draft|null=null;
  private pending:[number,number]|null=null;
  private overlay=new PathOverlay();
  private ray=new Raycaster();
  private signature="";
  constructor(private host:Editor) {
    host.view.worldRoot.add(this.overlay.root);
    this.bind();
  }
  get eligible() {return this.host.placing && !this.host.moving && !this.host.groupPlacement && !this.host.orbit;}
  get hasDraft() {return this.anchors.length>0;}
  private template():Piece {return {id:"path",item:this.host.item,wood:this.host.wood,position:[0,0,0],rotation:[...this.host.rotation]};}
  syncUI() {
    $("path-controls").hidden=!this.eligible;
    if (this.mode==="wedge" && ITEMS.get(this.host.item)!.shape!=="wedge") this.mode="curve";
    $<HTMLSelectElement>("build-mode").value=this.mode;
    $<HTMLOptionElement>("wedge-build-option").disabled=ITEMS.get(this.host.item)!.shape!=="wedge";
    $<HTMLSelectElement>("wedge-mode").value=this.wedge;
    $("wedge-mode-row").hidden=this.mode!=="wedge";
    $("path-fill-row").hidden=this.mode==="single" && !this.hasDraft;
    $<HTMLInputElement>("path-fill").checked=this.fill;
    $("path-actions").hidden=!this.hasDraft;
    $("path-status").hidden=!this.hasDraft;
    $<HTMLButtonElement>("path-remove").hidden=this.draftMode==="line";
    $<HTMLButtonElement>("path-remove").disabled=this.selectedPoint<0;
    $<HTMLButtonElement>("path-build").disabled=!this.preview.length || !!this.issue || !!this.gesture;
    const count=`${this.anchors.length} points · ${this.preview.length} pieces`;
    $("path-status").textContent=this.issue==="overlap" ? `${count} · Pieces intersect. Adjust the path or enable Allow overlaps.`
      : this.issue==="below-ground" ? `${count} · Part of this path is below ground.`
      : this.issue==="outside-plots" ? `${count} · The full path must stay inside active plots.` : `${count} · Ready to build`;
    $("path-status").classList.toggle("invalid",!!this.issue);
    $("path-hint").textContent=this.mode==="single" && !this.hasDraft ? "Ctrl + drag builds a straight run."
      : this.mode==="line" || this.draftMode==="line" && this.hasDraft ? "Drag A to B. Release to build; Esc cancels."
      : this.mode==="wedge" && this.wedge==="ramp" ? "Click ramp points. Heights follow wedge rise; adjust with X/Y/Z arrows. Enter builds."
      : "Click curve points. Select a dot to adjust with X/Y/Z arrows. Enter builds.";
    if (this.eligible) {
      $("placing-instruction").textContent=this.mode==="single" ? "Click to place · Ctrl-drag a run" : this.mode==="line" ? "Drag to build" : "Click curve points · Enter to build";
      $("placing-hold").hidden=this.mode!=="single" || this.hasDraft;
      $("preview-controls").hidden=this.mode!=="single" || this.hasDraft;
      if(this.hasDraft) {$("elevation-row").hidden=true;$("transform-section").hidden=true;}
    } else {$("placing-instruction").textContent="Click to place";$("placing-hold").hidden=false;}
  }
  syncGizmo() {
    if(!this.hasDraft) return false;
    const point=this.selectedPoint>=0 ? this.anchors[this.selectedPoint] : null;
    this.host.view.gizmo.setPieces(point ? [{...this.template(),item:"tiny-tile",position:[...point],rotation:[0,0,0]}] : []);
    return true;
  }
  refresh() {
    if(!this.hasDraft) return;
    const key=JSON.stringify([this.anchors,this.draftMode,this.fill,this.wedge,this.host.item,this.host.wood,this.host.rotation,this.host.world.revision,this.host.world.allowOverlaps]);
    if(key===this.signature) return;
    this.signature=key;
    const points=this.anchors.length===1 && this.draftMode!=="line"
      ? [this.anchors[0],[this.anchors[0][0]+.01,this.anchors[0][1],this.anchors[0][2]] as Vec3] : this.anchors;
    const result=buildPath(this.template(),points,{mode:this.draftMode,fill:this.fill,wedge:this.wedge});
    this.preview=result.pieces;this.issue=this.host.world.placementBatchIssue(this.preview);
    this.host.view.showGhost(null);this.host.view.showGroupGhosts(this.preview,!this.issue);
    this.overlay.set(this.anchors.length>1 ? result.guide : [],this.anchors,this.selectedPoint);
    this.syncGizmo();this.syncUI();
  }
  tick() {
    const coordinates=this.pending;this.pending=null;
    if(coordinates && this.gesture) this.updateGesture(...coordinates);
    this.refresh();
    this.overlay.update(this.host.view.camera.camera,this.host.view.element.clientHeight);
  }
  cancel(restoreSuspended=false) {
    this.endCapture();this.clearDraft();
    if(restoreSuspended) this.restoreDraft();else this.suspended=null;
  }
  private clearDraft() {
    this.anchors=[];this.selectedPoint=-1;this.preview=[];this.issue=null;this.signature="";
    this.overlay.set([],[],-1);this.host.view.showGroupGhosts([]);this.host.view.gizmo.setPieces([]);
  }
  private restoreDraft() {
    const old=this.suspended;this.suspended=null;
    if(old) {this.anchors=old.anchors;this.selectedPoint=old.selected;this.draftMode=old.mode;this.planeY=old.planeY;this.signature="";this.refresh();}
  }
  commit() {
    this.refresh();if(!this.preview.length) return;
    if(this.issue) {this.host.toast(this.issue==="overlap" ? "This path intersects blueprints. Adjust it or enable Allow overlaps."
      : this.issue==="below-ground" ? "No part of a blueprint can go below ground." : "The entire path must stay inside active plots.");return;}
    const pieces=this.preview.map(p=>({...p,id:crypto.randomUUID()}));
    this.clearDraft();this.restoreDraft();this.host.pointer=null;
    this.host.world.execute(pieces.map(p=>({before:null,after:p})));
    this.host.inspect();this.host.toast(`Built ${pieces.length} blueprint${pieces.length===1 ? "" : "s"} · one undo`);
  }
  private pointOnPlane(x:number,y:number) {
    const {view}=this.host,r=view.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2),view.camera.camera);
    const hit=this.ray.ray.intersectPlane(new Plane(new Vector3(0,1,0),-this.planeY),new Vector3());
    if(!hit || hit.distanceTo(view.camera.camera.position)>view.renderDistance) return null;
    const origin=this.anchors[0];return [snapMovement(hit.x,origin[0]),origin[1],snapMovement(hit.z,origin[2])] as Vec3;
  }
  private seed(x:number,y:number,mode:PathOptions["mode"]) {
    if(this.host.held && this.host.ghost) {this.planeY=this.host.ghost.position[1];return [...this.host.ghost.position] as Vec3;}
    const hit=this.host.view.pick(x,y);if(!hit) return null;
    let rotation=this.host.rotation;
    if(mode==="wedge" && this.wedge==="wall-arch") rotation=buildPath(this.template(),[[0,0,0],[.01,0,0]],{mode,fill:false,wedge:this.wedge}).pieces[0].rotation;
    const point=snapBlueprintOnSurface(hit.point,hit.normal,this.host.item,rotation);
    point[1]+=snapMovement(Number($<HTMLInputElement>("elevation").value)||0);
    this.planeY=hit.point[1];return point;
  }
  private capture(e:PointerEvent,gesture:Gesture) {
    this.gesture=gesture;this.pending=null;
    const camera=this.host.view.camera,canvas=this.host.view.renderer.domElement;
    camera.selecting=true;camera.controls.enabled=false;camera.keys.clear();
    canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);canvas.style.cursor="grabbing";
  }
  private endCapture() {
    const old=this.gesture;this.gesture=null;this.pending=null;if(!old) return;
    const camera=this.host.view.camera,canvas=this.host.view.renderer.domElement;
    camera.selecting=false;camera.keys.clear();camera.controls.enabled=!camera.walking && !camera.flying;
    if(canvas.hasPointerCapture(old.id)) canvas.releasePointerCapture(old.id);
    canvas.style.cursor="";this.host.pointer=null;
  }
  private updateGesture(x:number,y:number) {
    const g=this.gesture;if(!g) return;
    if(g.kind==="line") {
      const point=this.pointOnPlane(x,y);if(point) this.anchors[1]=point;
    } else if(g.kind==="point") {
      const v=this.host.view,delta=v.gizmo.delta(g.math!,x,y,v.camera.camera,v.renderer.domElement.getBoundingClientRect());
      if(delta) this.anchors[g.index!]=g.point!.map((p,i)=>p+delta[i]) as Vec3;
    }
  }
  private cancelGesture() {
    const g=this.gesture;if(!g) return;
    this.endCapture();
    if(g.kind==="point") this.anchors[g.index!]=g.point!;
    else if(g.kind==="line") {this.clearDraft();this.restoreDraft();}
    this.signature="";this.refresh();this.host.inspect();
  }
  private bind() {
    const canvas=this.host.view.renderer.domElement;
    const consume=(e:Event)=>{e.preventDefault();e.stopImmediatePropagation();};
    $<HTMLSelectElement>("build-mode").onchange=e=>{
      this.cancel();this.mode=(e.target as HTMLSelectElement).value as BuildMode;this.host.inspect();this.host.updateGhost();canvas.focus({preventScroll:true});
    };
    $<HTMLSelectElement>("wedge-mode").onchange=e=>{
      this.cancel();this.wedge=(e.target as HTMLSelectElement).value as WedgeMode;this.host.inspect();this.host.updateGhost();canvas.focus({preventScroll:true});
    };
    $<HTMLInputElement>("path-fill").onchange=e=>{this.fill=(e.target as HTMLInputElement).checked;this.refresh();this.syncUI();};
    $("path-build").onclick=()=>{this.commit();canvas.focus({preventScroll:true});};
    $("path-cancel").onclick=()=>{this.cancel(true);this.host.inspect();this.host.updateGhost();canvas.focus({preventScroll:true});};
    $("path-remove").onclick=()=>{
      if(this.selectedPoint>=0) this.anchors.splice(this.selectedPoint,1);
      this.selectedPoint=Math.min(this.selectedPoint,this.anchors.length-1);
      if(!this.hasDraft) this.clearDraft();else {this.signature="";this.refresh();}
      this.host.inspect();canvas.focus({preventScroll:true});
    };
    canvas.addEventListener("pointerdown",e=>{
      if(this.gesture) {consume(e);return;}
      if(!this.eligible || this.host.view.camera.flying || e.button!==0) return;
      const v=this.host.view,r=canvas.getBoundingClientRect();
      if(this.hasDraft && this.selectedPoint>=0 && !e.ctrlKey && !e.metaKey) {
        const axis=v.gizmo.hit(e.clientX,e.clientY,v.camera.camera,r);
        const math=axis!==null ? v.gizmo.begin(axis,e.clientX,e.clientY,v.camera.camera,r) : null;
        if(math) {
          consume(e);this.capture(e,{id:e.pointerId,start:[e.clientX,e.clientY],kind:"point",math,index:this.selectedPoint,point:[...this.anchors[this.selectedPoint]]});return;
        }
      }
      const line=e.ctrlKey || e.metaKey || this.mode==="line";
      if(line) {
        consume(e);canvas.focus({preventScroll:true});
        const oldPlaneY=this.planeY;
        const point=this.seed(e.clientX,e.clientY,"line");if(!point) return;
        if(this.hasDraft && this.draftMode!=="line" && !this.suspended)
          this.suspended={anchors:structuredClone(this.anchors),selected:this.selectedPoint,mode:this.draftMode,planeY:oldPlaneY};
        this.anchors=[point,[...point]];this.selectedPoint=-1;this.draftMode="line";this.signature="";
        this.capture(e,{id:e.pointerId,start:[e.clientX,e.clientY],kind:"line"});this.refresh();this.host.inspect();return;
      }
      if(this.mode==="single" && !this.hasDraft) return;
      consume(e);
      const hit=this.overlay.hit(e.clientX,e.clientY,v.camera.camera,r);
      if(hit>=0) {
        this.selectedPoint=hit;this.overlay.set(buildPath(this.template(),this.anchors,{mode:this.draftMode,fill:this.fill,wedge:this.wedge}).guide,this.anchors,hit);
        this.syncGizmo();this.capture(e,{id:e.pointerId,start:[e.clientX,e.clientY],kind:"select"});this.host.inspect();return;
      }
      if(this.hasDraft && this.draftMode==="line") return;
      let point=this.hasDraft ? this.pointOnPlane(e.clientX,e.clientY) : this.seed(e.clientX,e.clientY,this.mode==="single" ? "line" : this.mode);
      if(!point) return;
      if(this.hasDraft && this.mode==="wedge" && this.wedge==="ramp") point=nextRampPoint(this.anchors[this.anchors.length-1],point,this.host.item);
      this.capture(e,{id:e.pointerId,start:[e.clientX,e.clientY],kind:"add",point});
    },true);
    canvas.addEventListener("pointermove",e=>{
      if(!this.gesture) return;consume(e);
      if(e.pointerId===this.gesture.id) this.pending=[e.clientX,e.clientY];
    },true);
    canvas.addEventListener("pointerup",e=>{
      const g=this.gesture;if(!g) return;consume(e);
      if(e.button!==0 || e.pointerId!==g.id) return;
      this.updateGesture(e.clientX,e.clientY);this.endCapture();
      if(g.kind==="line") {this.refresh();if(!this.issue) this.commit();else {this.selectedPoint=1;this.signature="";this.refresh();this.host.inspect();}}
      else if(g.kind==="add" && Math.hypot(e.clientX-g.start[0],e.clientY-g.start[1])<=5) {
        this.draftMode=this.mode==="single" ? "line" : this.mode;
        if(!this.anchors.some(p=>p.every((v,i)=>v===g.point![i]))) this.anchors.push(g.point!);
        this.selectedPoint=this.anchors.length-1;this.signature="";this.refresh();this.host.inspect();
      } else {this.signature="";this.refresh();this.host.inspect();}
    },true);
    canvas.addEventListener("pointercancel",e=>{if(this.gesture) {consume(e);this.cancelGesture();}},true);
    canvas.addEventListener("lostpointercapture",e=>{
      // A queued loss from a cancelled gesture must not cancel a new capture.
      if(this.gesture?.id===e.pointerId && !canvas.hasPointerCapture(e.pointerId)) this.cancelGesture();
    },true);
    canvas.addEventListener("wheel",e=>{if(this.gesture) consume(e);},{capture:true,passive:false});
    canvas.addEventListener("dblclick",e=>{if(this.eligible && (this.mode!=="single" || this.hasDraft)) consume(e);},true);
    window.addEventListener("blur",()=>this.cancelGesture());
    document.addEventListener("visibilitychange",()=>{if(document.hidden) this.cancelGesture();});
    window.addEventListener("keydown",e=>{
      if(document.querySelector("dialog[open]") || (e.target as HTMLElement).matches("input,textarea,select")) return;
      if(this.gesture) {consume(e);if(e.code==="Escape") this.cancelGesture();return;}
      if(!this.hasDraft) return;
      if(e.code==="Enter") {consume(e);this.commit();}
      else if(e.code==="Escape") {consume(e);this.cancel(true);this.host.inspect();this.host.updateGhost();}
      else if(e.code==="KeyL") consume(e);
      else if(e.code==="Delete" || e.code==="Backspace") {consume(e);$("path-remove").click();}
    },true);
  }
}
