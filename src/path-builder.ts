import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { ITEMS, type Vec3 } from "./catalog";
import { buildPath, snapPathOnSurface } from "./build-path";
import { snapBlueprintOnSurface } from "./collision";
import { PathOverlay } from "./path-overlay";
import type { Editor } from "./editor";
import type { Piece } from "./world";

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;

/** Owns straight build gestures before selection listeners, leaving placed blueprints unchanged. */
export class PathBuilder {
  anchors:Vec3[]=[];
  preview:Piece[]=[];
  issue:ReturnType<Editor["world"]["placementIssue"]>=null;
  private dragPlane=new Plane(new Vector3(0,1,0));
  private surfaceNormal:Vec3=[0,1,0];
  private gesture:number|null=null;
  private gestureStart:[number,number]|null=null;
  private gestureOrigin:Vec3|null=null;
  private dragged=false;
  private gesturePreview=false;
  private endpointValid=false;
  private pending:[number,number]|null=null;
  private overlay=new PathOverlay();
  private ray=new Raycaster();
  private signature="";
  constructor(private host:Editor) {
    host.view.worldRoot.add(this.overlay.root);
    this.bind();
  }
  get eligible() {return this.host.placing && !this.host.moving && !this.host.groupPlacement;}
  get hasDraft() {return this.anchors.length>0;}
  private template():Piece {return {id:"path",...this.host.logicConfig,item:this.host.item,wood:this.host.wood,position:[0,0,0],rotation:[...this.host.rotation],...(ITEMS.get(this.host.item)!.fixedMaterial==='lighting'?{lightOn:this.host.lightOn}:{})};}
  syncUI() {
    $("path-controls").hidden=!this.eligible||!this.hasDraft;
    $("path-actions").hidden=!this.hasDraft;
    $("path-status").hidden=!this.hasDraft;
    $<HTMLButtonElement>("path-build").disabled=!this.preview.length || !!this.issue || this.gesture!==null;
    const count=`${this.preview.length} pieces`;
    $("path-status").textContent=this.issue==="overlap" ? `${count} · Pieces intersect. Retry the drag or enable Allow overlaps.`
      : this.issue==="below-ground" ? `${count} · Part of this run is below ground.`
      : this.issue==="outside-plots" ? `${count} · The full run must stay inside active plots.` : `${count} · Ready to build`;
    $("path-status").classList.toggle("invalid",!!this.issue);
    if(this.eligible) {
      $("placing-instruction").textContent="Click to place · Drag a straight run";
      $("placing-hold").hidden=this.hasDraft;
      $("preview-controls").hidden=this.hasDraft;
      $("commit-preview").hidden=!this.host.held;
    } else {$("placing-instruction").textContent="Click to place";$("placing-hold").hidden=false;}
    document.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach(button => button.disabled=this.hasDraft);
  }
  syncGizmo() {
    if(!this.hasDraft) return false;
    this.host.view.gizmo.setPieces([]);return true;
  }
  refresh() {
    if(!this.hasDraft) return;
    const key=JSON.stringify([this.anchors,this.host.item,this.host.wood,this.host.rotation,this.host.world.revision,this.host.world.allowOverlaps]);
    if(key===this.signature) return;
    this.signature=key;
    const result=buildPath(this.template(),this.anchors,{fill:false});
    this.preview=result.pieces;this.issue=this.host.world.placementBatchIssue(this.preview);
    this.host.view.showGhost(null);this.host.view.showGroupGhosts(this.preview,!this.issue);
    this.overlay.set(result.guide);this.syncGizmo();this.syncUI();
  }
  tick() {
    const coordinates=this.pending;this.pending=null;
    if(coordinates && this.gesture!==null) this.updateGesture(...coordinates);
    this.refresh();
  }
  cancel() {this.endCapture();this.clearDraft();}
  private clearDraft() {
    this.anchors=[];this.preview=[];this.issue=null;this.signature="";
    this.overlay.set([]);this.host.view.showGroupGhosts([]);this.host.view.gizmo.setPieces([]);
  }
  commit() {
    this.refresh();if(!this.preview.length) return;
    if(this.issue) {this.host.toast(this.issue==="overlap" ? "This run intersects blueprints. Retry it or enable Allow overlaps."
      : this.issue==="below-ground" ? "No part of a blueprint can go below ground." : "The entire run must stay inside active plots.");return;}
    const pieces=this.preview.map(p=>({...p,id:crypto.randomUUID()}));
    this.clearDraft();this.host.pointer=null;
    this.host.world.execute(pieces.map(p=>({before:null,after:p})));
    this.host.inspect();this.host.updateGhost();this.host.toast(`Built ${pieces.length} blueprint${pieces.length===1 ? "" : "s"} · one undo`);
  }
  private pointOnPlane(x:number,y:number) {
    const {view}=this.host,r=view.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2),view.camera.camera);
    const hit=this.ray.ray.intersectPlane(this.dragPlane,new Vector3());
    if(!hit || hit.distanceTo(view.camera.camera.position)>view.renderDistance) return null;
    const origin=this.gestureOrigin!;
    const snapped=snapPathOnSurface(hit.toArray() as Vec3,origin,this.surfaceNormal);
    const delta=snapped.map((v,i)=>v-origin[i]);
    const axis=delta.map(Math.abs).indexOf(Math.max(...delta.map(Math.abs)));
    return origin.map((v,i)=>i===axis ? snapped[i] : v) as Vec3;
  }
  private seed(x:number,y:number) {
    if(this.host.held && this.host.ghost) {
      this.surfaceNormal=[0,1,0];
      this.dragPlane.setFromNormalAndCoplanarPoint(new Vector3(...this.surfaceNormal),new Vector3(...this.host.ghost.position));
      return [...this.host.ghost.position] as Vec3;
    }
    const hit=this.host.view.pick(x,y);if(!hit) return null;
    const point=snapBlueprintOnSurface(hit.point,hit.normal,this.host.item,this.host.rotation);
    this.surfaceNormal=[...hit.normal];
    this.dragPlane.setFromNormalAndCoplanarPoint(new Vector3(...hit.normal),new Vector3(...hit.point));return point;
  }
  private capture(e:PointerEvent,origin:Vec3) {
    this.gesture=e.pointerId;this.pending=null;this.gestureStart=[e.clientX,e.clientY];this.gestureOrigin=origin;
    this.dragged=false;this.gesturePreview=false;this.endpointValid=false;
    const camera=this.host.view.camera,canvas=this.host.view.renderer.domElement;
    camera.selecting=true;camera.controls.enabled=false;camera.keys.clear();
    canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);canvas.style.cursor="grabbing";
  }
  private endCapture() {
    const id=this.gesture;this.gesture=null;this.pending=null;this.gestureStart=null;this.gestureOrigin=null;
    this.dragged=false;this.gesturePreview=false;this.endpointValid=false;if(id===null) return;
    const camera=this.host.view.camera,canvas=this.host.view.renderer.domElement;
    camera.selecting=false;camera.keys.clear();camera.controls.enabled=!camera.walking && !camera.flying;
    if(canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    canvas.style.cursor="";this.host.pointer=null;
  }
  private updateGesture(x:number,y:number) {
    if(!this.gestureStart || !this.gestureOrigin)return;
    if(!this.dragged && Math.hypot(x-this.gestureStart[0],y-this.gestureStart[1])<=5)return;
    this.dragged=true;
    const point=this.pointOnPlane(x,y);this.endpointValid=!!point;if(!point)return;
    if(!this.gesturePreview){this.gesturePreview=true;this.anchors=[[...this.gestureOrigin],point];this.signature="";}
    else this.anchors[1]=point;
  }
  private cancelGesture() {
    if(this.gesture===null) return;
    this.cancel();this.host.inspect();this.host.updateGhost();
  }
  private bind() {
    const canvas=this.host.view.renderer.domElement;
    const consume=(e:Event)=>{e.preventDefault();e.stopImmediatePropagation();};
    $("path-build").onclick=()=>{this.commit();canvas.focus({preventScroll:true});};
    $("path-cancel").onclick=()=>{this.cancel();this.host.inspect();this.host.updateGhost();canvas.focus({preventScroll:true});};
    canvas.addEventListener("pointerdown",e=>{
      if(this.gesture!==null) {consume(e);return;}
      if(!this.eligible || this.host.view.camera.flying || e.button!==0) return;
      if(!e.ctrlKey && !e.metaKey && !this.hasDraft && this.host.held &&
        this.host.view.gizmo.hit(e.clientX,e.clientY,this.host.view.camera.camera,canvas.getBoundingClientRect())!==null) return;
      consume(e);
      const point=this.seed(e.clientX,e.clientY);if(!point) return;
      this.capture(e,point);
    },true);
    canvas.addEventListener("pointermove",e=>{
      if(this.gesture===null) return;consume(e);
      if(e.pointerId===this.gesture) this.pending=[e.clientX,e.clientY];
    },true);
    canvas.addEventListener("pointerup",e=>{
      if(this.gesture===null) return;consume(e);
      if(e.button!==0 || e.pointerId!==this.gesture) return;
      this.updateGesture(e.clientX,e.clientY);const dragged=this.dragged,valid=this.endpointValid;this.endCapture();
      if(dragged&&!valid){this.clearDraft();this.host.inspect();this.host.updateGhost();}
      else if(dragged){this.refresh();if(!this.issue)this.commit();else this.host.inspect();}
      else if(!this.hasDraft){this.host.pointer=[e.clientX,e.clientY];this.host.updateGhost();this.host.place();}
    },true);
    canvas.addEventListener("pointercancel",e=>{if(this.gesture!==null) {consume(e);this.cancelGesture();}},true);
    canvas.addEventListener("lostpointercapture",e=>{
      if(this.gesture===e.pointerId && !canvas.hasPointerCapture(e.pointerId)) this.cancelGesture();
    },true);
    canvas.addEventListener("wheel",e=>{if(this.gesture!==null) consume(e);},{capture:true,passive:false});
    canvas.addEventListener("dblclick",e=>{if(this.eligible) consume(e);},true);
    window.addEventListener("blur",()=>this.cancelGesture());
    document.addEventListener("visibilitychange",()=>{if(document.hidden) this.cancelGesture();});
    window.addEventListener("keydown",e=>{
      if(document.querySelector("dialog[open]") || (e.target as HTMLElement).matches("input,textarea,select")) return;
      if(this.gesture!==null) {consume(e);if(e.code==="Escape") this.cancelGesture();return;}
      if(!this.hasDraft) return;
      if(e.code==="Enter") {consume(e);this.commit();}
      else if(e.code==="Escape") {consume(e);this.cancel();this.host.inspect();this.host.updateGhost();}
      else if(e.code==="KeyL" || e.code==="Delete" || e.code==="Backspace") consume(e);
    },true);
  }
}
