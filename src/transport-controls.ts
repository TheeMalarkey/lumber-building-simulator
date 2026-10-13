import type {Editor} from './editor';
import {Raycaster,Vector2,Vector3} from 'three';
import type {Vec3} from './catalog';

export class TransportControls {
 private panel=document.createElement('div');
 private run=document.createElement('button');private reset=document.createElement('button');
 private revision=-1;private generation=-1;
 private held:{pointer:number;distance:number;position:Vector2;walking:boolean}|null=null;
 private ray=new Raycaster();private target=new Vector3();
 constructor(private e:Editor){
  this.panel.className='transport-controls';this.panel.hidden=true;this.panel.setAttribute('aria-label','Wood physics');
  this.run.id='transport-run';this.run.title='Pause or resume loose wood physics. Hold left click to grab wood; scroll while holding to adjust distance.';
  this.reset.id='transport-reset';this.reset.textContent='Reset';this.reset.title='Restore wood to its positions when loaded or placed, then pause';
  this.panel.append(this.run,this.reset);document.getElementById('viewport')!.append(this.panel);
  this.run.onclick=()=>{
   const t=e.view.transport;
   this.release();if(!t.simulation.running)t.start();else t.paused=!t.paused;
   this.tick();e.view.renderer.domElement.focus({preventScroll:true});
  };
  this.reset.onclick=()=>{this.release();e.view.transport.reset();this.tick();e.view.renderer.domElement.focus({preventScroll:true});};
  const canvas=e.view.renderer.domElement,viewport=canvas.parentElement!;
  const consume=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
  // Ancestor capture runs before blueprint selection, wire tools and camera input.
  viewport.addEventListener('pointerdown',event=>{
   if(event.target!==canvas||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||e.placing||e.logicTools.wiring||e.view.camera.flying||document.querySelector('dialog[open]'))return;
   if(e.view.gizmo.hit(event.clientX,event.clientY,e.view.camera.camera,canvas.getBoundingClientRect())!==null)return;
   const hit=e.view.pick(event.clientX,event.clientY);
   if(!hit?.id||e.world.pieces.get(hit.id)?.item!=='loose-plank'||e.logicTools.pickWireAt(event.clientX,event.clientY))return;
   if(!e.view.transport.beginGrab(hit.id,hit.point))return;
   consume(event);e.pickSelection(null);
   this.held={pointer:event.pointerId,distance:e.view.camera.camera.position.distanceTo(new Vector3(...hit.point)),position:new Vector2(event.clientX,event.clientY),walking:e.view.camera.walking};
   e.view.camera.controls.enabled=false;canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';
  },true);
  viewport.addEventListener('pointermove',event=>{if(!this.held||this.held.pointer!==event.pointerId)return;consume(event);this.held.position.set(event.clientX,event.clientY);},true);
  viewport.addEventListener('pointerup',event=>{if(this.held&&event.button===0&&event.pointerId===this.held.pointer){consume(event);this.release();}},true);
  viewport.addEventListener('wheel',event=>{
   if(!this.held)return;consume(event);const units=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
   this.held.distance=Math.max(2,Math.min(e.view.renderDistance,this.held.distance+units*.015));
  },{capture:true,passive:false});
  canvas.addEventListener('pointercancel',()=>this.release());canvas.addEventListener('lostpointercapture',event=>{if(event.pointerId===this.held?.pointer)this.release();});
  window.addEventListener('blur',()=>this.release());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.release();});
  window.addEventListener('keydown',event=>{
   if(!this.held)return;
   if(event.code==='Escape'){consume(event);this.release();}
   else if(event.ctrlKey||event.metaKey||['KeyB','KeyV','KeyG','KeyC','Delete','Backspace'].includes(event.code))this.release();
  },true);
 }
 private release(){
  const held=this.held;if(!held)return;this.held=null;this.e.view.transport.endGrab();
  const canvas=this.e.view.renderer.domElement;canvas.style.cursor='';this.e.view.camera.controls.enabled=!this.e.view.camera.walking&&!this.e.view.camera.flying;
  if(canvas.hasPointerCapture(held.pointer))canvas.releasePointerCapture(held.pointer);
 }
 tick(){
  if(this.revision!==this.e.world.revision||this.generation!==this.e.world.generation){this.revision=this.e.world.revision;this.generation=this.e.world.generation;this.panel.hidden=!this.e.world.looseIds.size;}
  const t=this.e.view.transport;
  if(this.held){
   if(!t.simulation.grabbedId||t.paused||this.e.placing||this.e.logicTools.wiring||this.held.walking!==this.e.view.camera.walking||document.querySelector('dialog[open]'))this.release();
   else {const canvas=this.e.view.renderer.domElement,rect=canvas.getBoundingClientRect(),p=this.held.position,camera=this.e.view.camera.camera;camera.updateMatrixWorld();this.ray.setFromCamera(new Vector2((p.x-rect.left)/rect.width*2-1,1-(p.y-rect.top)/rect.height*2),camera);this.ray.ray.at(this.held.distance,this.target);t.simulation.moveGrab(this.target.toArray() as Vec3);}
  }
  const text=t.paused?'Resume wood':'Pause wood';if(this.run.textContent!==text)this.run.textContent=text;this.reset.hidden=!t.simulation.running;
 }
}
