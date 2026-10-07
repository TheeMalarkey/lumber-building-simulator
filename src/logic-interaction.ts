import type {Editor} from './editor';
import type {Piece} from './world';
import {isDoor,doorProgress} from './door-design';

/** Direct interactions use the visible control surfaces, never the piece bounds. */
export class LogicInteraction {
  private canvas:HTMLCanvasElement;
  private hint:HTMLElement;
  private label:HTMLElement;
  private clickHint:HTMLElement;
  private pointer:[number,number]|null=null;
  private buttons=0;
  private modified=false;
  private eHeld=false;
  private signature='';
  private pressed:{id:string;pointerId:number;x:number;y:number;generation:number}|null=null;

  constructor(private e:Editor,private enabled:()=>boolean,private activate:(id:string)=>void) {
    this.canvas=e.view.renderer.domElement;
    this.hint=document.getElementById('logic-hover')!;
    this.label=document.getElementById('logic-hover-label')!;
    this.clickHint=document.getElementById('logic-hover-click')!;
    const canvas=this.canvas;
    canvas.addEventListener('pointermove',event=>{
      this.pointer=[event.clientX,event.clientY];this.buttons=event.buttons;
      this.modified=event.ctrlKey||event.metaKey||event.altKey||event.shiftKey;
    },true);
    canvas.addEventListener('pointerleave',()=>{this.pointer=null;this.hide();});
    canvas.addEventListener('pointerdown',event=>{
      this.pointer=[event.clientX,event.clientY];
      this.modified=event.ctrlKey||event.metaKey||event.altKey||event.shiftKey;
      // Clicking back into the world ends text entry before testing the cap.
      if(event.button===0&&!this.modified)canvas.focus({preventScroll:true});
      const target=event.button===0 && event.buttons===1 && !this.modified ? this.target() : null;
      this.buttons=event.buttons;this.hide();
      if(!target||(target.item!=='button'&&!isDoor(target.item)))return;
      event.preventDefault();event.stopImmediatePropagation();
      this.pressed={id:target.id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,generation:e.world.generation};
      canvas.setPointerCapture(event.pointerId);
    },true);
    canvas.addEventListener('pointerup',event=>{
      this.buttons=event.buttons;this.pointer=[event.clientX,event.clientY];
      this.modified=event.ctrlKey||event.metaKey||event.altKey||event.shiftKey;
      const pressed=this.pressed;
      if(!pressed||event.button!==0||event.pointerId!==pressed.pointerId)return;
      event.preventDefault();event.stopImmediatePropagation();
      const target=this.target();this.cancelPress();
      if(target?.id===pressed.id && pressed.generation===e.world.generation &&
        Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)<=5)this.activate(target.id);
      this.signature='';
    },true);
    canvas.addEventListener('dblclick',event=>{
      const target=this.target();if(!this.modified&&target&&(target.item==='button'||isDoor(target.item))){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    canvas.addEventListener('pointercancel',()=>this.reset());
    canvas.addEventListener('lostpointercapture',()=>{this.pressed=null;this.buttons=0;this.signature='';});
    window.addEventListener('blur',()=>this.reset());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.reset();});
    window.addEventListener('keydown',event=>{
      this.modified=event.ctrlKey||event.metaKey||event.altKey||event.shiftKey;
      if(event.code!=='KeyE')return;
      if(this.eHeld){event.preventDefault();event.stopImmediatePropagation();return;}
      if(event.repeat||this.keyboardBlocked())return;
      const target=this.target();if(!target)return;
      event.preventDefault();event.stopImmediatePropagation();
      this.eHeld=true;e.view.camera.keys.delete('KeyE');this.activate(target.id);this.signature='';
    },true);
    window.addEventListener('keyup',event=>{
      this.modified=event.ctrlKey||event.metaKey||event.altKey||event.shiftKey;
      if(event.code==='KeyE')this.eHeld=false;
    },true);
  }

  private keyboardBlocked() {
    return !!document.querySelector('dialog[open]') || !!document.activeElement?.closest(
      'input,select,textarea,[contenteditable]:not([contenteditable="false"])');
  }
  private available() {
    const {camera}=this.e.view;
    return this.pointer && !this.buttons && !this.modified && this.enabled() &&
      !this.e.placing && !camera.flying && !camera.selecting &&
      !this.keyboardBlocked() && document.elementFromPoint(...this.pointer)===this.canvas;
  }
  private target():Piece|null {
    if(!this.available())return null;
    const [x,y]=this.pointer!,{view,world}=this.e;
    // Movement arrows own their pixels, even when a control sits behind one.
    view.camera.camera.updateMatrixWorld();
    if(view.gizmo.hit(x,y,view.camera.camera,this.canvas.getBoundingClientRect())!==null)return null;
    const hit=view.pick(x,y),p=hit?.id?world.pieces.get(hit.id):undefined;
    // Surface 2 is the orange control; 10 is the lever grip's orange end caps.
    if(p?.item==='lever'&&(hit!.surface===2||hit!.surface===10))return p;
    if(p&&isDoor(p.item)&&(p.item==='hatch'?[2,3].includes(hit!.surface!):hit!.surface===1))return p;
    return p?.item==='button'&&hit!.surface===2?p:null;
  }
  private cancelPress() {
    const pressed=this.pressed;this.pressed=null;
    if(pressed&&this.canvas.hasPointerCapture(pressed.pointerId))this.canvas.releasePointerCapture(pressed.pointerId);
  }
  private hide() {
    if(!this.hint.hidden){this.hint.hidden=true;this.canvas.classList.remove('logic-hovering');}
    this.signature='';
  }
  private reset() {
    this.cancelPress();this.pointer=null;this.buttons=0;this.modified=false;this.eHeld=false;this.hide();
  }
  tick() {
    if(!this.available()){this.hide();return;}
    const {view,world}=this.e,camera=view.camera.camera,gizmo=view.gizmo.root;
    const signature=[...this.pointer!,...camera.position.toArray(),...camera.quaternion.toArray(),camera.fov,camera.aspect,
      world.generation,world.revision,view.logic.circuit.version,view.doors.version,view.renderDistance,
      gizmo.visible,...gizmo.position.toArray(),gizmo.scale.x,this.canvas.clientWidth,this.canvas.clientHeight].join('|');
    if(signature===this.signature)return;
    const target=this.target();
    if(!target){this.hide();this.signature=signature;return;}
    this.signature=signature;
    const label=isDoor(target.item)?(this.e.view.logic.circuit.connected(target.id)?'Controlled by wire':doorProgress(target)>.5?'Close '+(target.item==='hatch'?'hatch':'door'):'Open '+(target.item==='hatch'?'hatch':'door')):target.item==='button'?'Press button':target.logicOn?'Switch off':'Switch on';
    if(this.label.textContent!==label)this.label.textContent=label;
    this.clickHint.hidden=target.item!=='button'&&!isDoor(target.item);this.hint.hidden=false;
    this.canvas.classList.add('logic-hovering');
    const [x,y]=this.pointer!;
    const left=`${Math.max(8,Math.min(x+16,innerWidth-this.hint.offsetWidth-8))}px`;
    const top=`${Math.max(8,Math.min(y+18,innerHeight-this.hint.offsetHeight-8))}px`;
    if(this.hint.style.left!==left)this.hint.style.left=left;
    if(this.hint.style.top!==top)this.hint.style.top=top;
  }
}
