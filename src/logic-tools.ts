import {Vector3} from 'three';
import {ITEMS,type Vec3} from './catalog';
import {portsFor,portPosition,wirePath,endpointPosition,type Endpoint,type Wire} from './logic-ports';
import {NEON_COLORS,wireCollarRadius,wireLength,wireLimit,wireRouteIssue,type NeonColor,type WireStyle} from './wire-design';
import type {Editor} from './editor';
import {LogicInteraction} from './logic-interaction';
import type {WireSurface} from './wire-shape';
import {WireView} from './wire-view';
import type {Piece} from './world';
import {setPaletteColor} from './palette-color';
import {wireThumbnail} from './wire-thumbnail';
const $=(id:string)=>document.getElementById(id)!;

export class LogicTools {
 wiring=false;private start:Endpoint|null=null;private bends:Vec3[]=[];
 private down:number[]|null=null;private previousStatus='';private generation=-1;private revision=-1;
 private style:WireStyle={kind:'wire'};private pointer:[number,number]|null=null;private previewKey='';private previewEnd:Endpoint|null=null;
 private previewId=crypto.randomUUID();private previewIssue:string|null=null;
 private startSurface?:WireSurface;
 private previewPath:Vec3[]=[];
 private interaction:LogicInteraction;
 private previewView?:WireView;private previewWires?:Wire[];private previewValid?:boolean;private previewRevision=-1;
 private draftView?:WireView;private paletteContext='';
 private movingWire:Wire|null=null;
 private labelPoint=new Vector3();
 constructor(private e:Editor){
  this.interaction=new LogicInteraction(e,()=>!this.wiring,id=>this.activate(id));
  $('wire-color-toggle').onclick=()=>this.colorPopup(!!$('wire-colors').hidden);
  $('wire-colors').replaceChildren(...Object.entries(NEON_COLORS).map(([id,c])=>{
   const b=document.createElement('button');b.dataset.wireColor=id;b.title=c.label+' neon';b.setAttribute('aria-label',b.title);b.style.setProperty('--wire-color','#'+c.hex.toString(16).padStart(6,'0'));
   b.onclick=()=>{
    if(this.wiring){this.style={kind:'neon',color:id as NeonColor};this.previewKey='';}
    else {const selected=this.e.wireSelection;this.e.world.execute([],this.e.world.wires.map(w=>selected.has(w.id)&&w.kind==='neon'?{...w,color:id as NeonColor}:w));}
    this.colorPopup(false);this.status();this.e.inspect();canvas.focus({preventScroll:true});
   };return b;
  }));
  document.addEventListener('pointerdown',event=>{if(!$('wire-palette-panel').contains(event.target as Node))this.colorPopup(false);},true);
  $('logic-action').onclick=()=>this.activate();
  $('logic-timing').onchange=()=>{const p=e.selectedPieces[0];if(!p)return;e.world.execute([{before:p,after:{...p,timing:Number(($('logic-timing') as HTMLSelectElement).value)}}]);this.inspect();};
  $('logic-ports').onclick=event=>{const port=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-port]')?.dataset.port;if(port&&e.selected)this.begin({piece:e.selected,port});};
  const canvas=e.view.renderer.domElement;
  canvas.addEventListener('pointerdown',event=>{if(!this.wiring||event.button!==0)return;event.stopImmediatePropagation();event.preventDefault();this.down=[event.clientX,event.clientY];canvas.focus();},true);
  canvas.addEventListener('pointerup',event=>{
   if(!this.wiring||event.button!==0)return;event.stopImmediatePropagation();event.preventDefault();
   if(!this.down||Math.hypot(event.clientX-this.down[0],event.clientY-this.down[1])>5){this.down=null;return;}this.down=null;
   this.click(event.clientX,event.clientY,event.shiftKey);
  },true);
  canvas.addEventListener('dblclick',event=>{if(this.wiring){event.stopImmediatePropagation();event.preventDefault();}},true);
  canvas.addEventListener('pointermove',event=>{
   this.pointer=[event.clientX,event.clientY];
  });
  window.addEventListener('keydown',event=>{
   if((event.target as HTMLElement).matches('input,select,textarea')||document.querySelector('dialog[open]'))return;
   if(event.code==='Escape'&&!$('wire-colors').hidden){event.preventDefault();event.stopImmediatePropagation();this.colorPopup(false);canvas.focus({preventScroll:true});return;}
   if(event.code==='Enter'&&$('wire-palette-panel').contains(event.target as Node))return;
   if(event.code==='Escape'&&!$('build-panel').hidden)return;
   if(this.wiring&&['Escape','Backspace','Delete','Enter'].includes(event.code)){
    event.preventDefault();event.stopImmediatePropagation();
    if(event.code==='Escape'){if(this.movingWire)this.toggle(false);else if(this.start)this.cancel();else this.toggle(false);}
    else if(event.code==='Backspace'&&this.start){if(this.bends.length){this.bends.pop();this.previewKey='';this.status();}else this.cancel(!!this.movingWire);}
    else if(event.code==='Enter')this.finishSurface();
    else if(event.code==='Delete'&&this.start){if(this.movingWire)this.toggle(false);else this.cancel();}return;
   }
  },true);
 }
 private surfacePoint(point:Vec3,normal:Vec3):Vec3{return point.map((v,i)=>v+normal[i]*(wireCollarRadius(this.style)+.005)) as Vec3;}
 clearSelection(){this.e.wireSelection.clear();this.e.view.logic.wires.select(null);this.colorPopup(false);this.colorUI();}
 pickWireAt(x:number,y:number){
  const hit=this.e.view.pick(x,y),wire=this.e.view.logic.wires.pick(this.e.view.raycaster);
  // An actual visible surface wins over the screen-space placement snap radius.
  const id=wire ? !hit||wire.distance<=new Vector3(...hit.point).distanceTo(this.e.view.camera.camera.position)+.001 ? wire.id : null
    : hit?.id ? null : this.hitWire(x,y)?.id;
  return id&&this.e.world.wires.some(w=>w.id===id)?id:null;
 }
 selectAt(x:number,y:number){
  const id=this.pickWireAt(x,y);if(!id)return false;
  this.e.pickSelections([],[id]);return true;
 }
 showPreview(wires:Wire[],pieces:Map<string,Piece>,valid=true){
  if(!wires.length){if(this.previewView)this.previewView.root.visible=false;this.previewWires=undefined;return;}
  if(!this.previewView){this.previewView=new WireView();this.previewView.root.remove(...this.previewView.lights);this.e.view.worldRoot.add(this.previewView.root);}
  this.previewView.root.visible=true;
  if(this.previewWires===wires&&this.previewValid===valid&&this.previewRevision===this.e.world.revision)return;
  this.previewWires=wires;this.previewValid=valid;this.previewRevision=this.e.world.revision;
  this.previewView.rebuild(wires,pieces);this.previewView.preview(valid);
 }
 private selectionUI(){
  this.e.view.logic.wires.selectMany(this.e.placing?[]:this.e.wireSelection);this.colorUI();
 }
 private colorPopup(open:boolean){
  $('wire-colors').hidden=!open;$('wire-color-toggle').setAttribute('aria-expanded',String(open));
 }
 private colorUI(){
  const selected=this.wiring||this.e.placing?[]:this.e.selectedWires,neon=selected.filter(w=>w.kind==='neon'),panel=$('wire-palette-panel');
  const context=this.wiring?this.style.kind??'wire':selected.length?JSON.stringify([[...this.e.selection].sort(),[...this.e.wireSelection].sort()]):'';
  if(context!==this.paletteContext){this.paletteContext=context;this.colorPopup(false);}
  const hasNeon=this.wiring?this.style.kind==='neon':!!neon.length,withInspector=!$('edit-panel').hidden;
  const hasOptions=(this.wiring||!!selected.length)&&!withInspector;
  panel.hidden=!hasOptions&&!hasNeon;
  panel.classList.toggle('with-inspector',withInspector);
  $('wire-options').hidden=!hasOptions;$('wire-color-toggle').hidden=!hasNeon;
  if(!hasNeon)this.colorPopup(false);
  ($('wire-overlap-toggle') as HTMLInputElement).checked=this.e.world.allowOverlaps;
  ($('wire-axis-copy-toggle') as HTMLInputElement).checked=this.e.copyWithArrows;
  const colors=this.wiring?[this.style.color??'white']:neon.map(w=>w.color??'white'),color=colors[0]??'white',mixed=new Set(colors).size>1;
  const label=`Neon color: ${mixed?'Mixed colors':NEON_COLORS[color].label}`,toggle=$('wire-color-toggle');
  toggle.title=label;toggle.setAttribute('aria-label',label);
  setPaletteColor(toggle,colors.map(id=>'#'+NEON_COLORS[id].hex.toString(16).padStart(6,'0')));
  const kind=this.wiring?this.style.kind??'wire':selected[0]?.kind??'wire',multiple=selected.length>1;
  const name=multiple?`${selected.length} wires`:kind==='neon'?'Neon Wire':'Wire';
  $('wire-name').textContent=name;$('wire-category').textContent=multiple?'GROUP SELECTION':'WIRES';
  const image=$('wire-preview') as HTMLImageElement;image.hidden=multiple;
  const thumbnail=wireThumbnail(kind,'#'+NEON_COLORS[color].hex.toString(16).padStart(6,'0'));
  if(image.getAttribute('src')!==thumbnail)image.src=thumbnail;image.alt=name+' preview';
  $('wire-selection-actions').hidden=this.wiring||!selected.length||withInspector;
  document.querySelectorAll<HTMLButtonElement>('[data-wire-color]').forEach(b=>b.setAttribute('aria-pressed',String(!mixed&&b.dataset.wireColor===color)));
 }
 private cancel(keepMoving=false){
  if(!keepMoving&&this.movingWire){this.movingWire=null;this.e.view.logic.hideWires([]);}
  this.start=null;this.bends=[];this.startSurface=undefined;this.previewEnd=null;this.previewPath=[];this.previewIssue=null;this.previewKey='';if(this.draftView)this.draftView.root.visible=false;this.status();
 }
 get selectedKind(){return this.wiring?this.style.kind:null;}
 chooseWire(kind:'wire'|'neon'){
  this.style=kind==='neon'?{kind,color:this.style.color??'white'}:{kind};
  this.toggle(true);
  this.e.view.renderer.domElement.focus({preventScroll:true});
 }
 relocate(wire:Wire){
  this.toggle(true);this.movingWire=structuredClone(wire);
  this.style=wire.kind==='neon'?{kind:'neon',color:wire.color??'white'}:{kind:'wire'};
  this.e.view.logic.hideWires([wire.id]);this.status();this.e.catalog();this.e.updateWorldUI();
  this.e.view.renderer.domElement.focus({preventScroll:true});
 }
 toggle(value=!this.wiring){
  if(value){this.e.pickSelection(null);this.e.panel('project-menu',false);}
  this.wiring=value;this.clearSelection();this.cancel();
  $('select-tool').classList.toggle('active',!value);
  this.e.view.logic.showSockets=value;this.e.view.logic.refresh();this.status();this.e.catalog();
 }
 begin(endpoint:Endpoint,surface?:WireSurface){if(!this.wiring)this.toggle(true);this.start=endpoint;this.startSurface=surface;this.bends=[];this.previewEnd=null;this.previewPath=[];this.previewIssue=null;this.previewKey='';this.status();}
 private visible(point:Vec3,owner?:string){
  const c=this.e.view.camera.camera,rect=this.e.view.renderer.domElement.getBoundingClientRect(),p=new Vector3(...point),v=p.clone().project(c);
  const hit=this.e.view.pick(rect.x+(v.x+1)*rect.width/2,rect.y+(1-v.y)*rect.height/2);
  return !hit||(owner&&hit.id===owner)||p.distanceTo(c.position)<=new Vector3(...hit.point).distanceTo(c.position)+.02;
 }
 private hitPort(x:number,y:number):Endpoint|null{
  const rect=this.e.view.renderer.domElement.getBoundingClientRect(),camera=this.e.view.camera.camera;let best=20*20,result:Endpoint|null=null;
  for(const id of this.e.world.logicIds){const p=this.e.world.pieces.get(id)!;
   if(new Vector3(...p.position).distanceToSquared(camera.position)>128*128)continue;
   for(const port of portsFor(p.item)){const v=new Vector3(...portPosition(p,port.id)).project(camera);if(v.z< -1||v.z>1)continue;
    const d=(rect.x+(v.x+1)*rect.width/2-x)**2+(rect.y+(1-v.y)*rect.height/2-y)**2;
    if(d<best&&this.visible(portPosition(p,port.id),id)){best=d;result={piece:id,port:port.id};}
   }
  }return result;
 }
 private hitWire(x:number,y:number){
  const rect=this.e.view.renderer.domElement.getBoundingClientRect(),camera=this.e.view.camera.camera;let best=9*9,result:{id:string;point:Vec3}|null=null;
  for(const wire of this.e.world.wires){if(wire.id===this.movingWire?.id)continue;const path=wirePath(wire,this.e.world.pieces);
   for(let i=1;i<path.length;i++){const a=new Vector3(...path[i-1]),b=new Vector3(...path[i]),p=a.clone().project(camera),q=b.clone().project(camera);if(p.z>1||q.z>1||p.z< -1||q.z< -1)continue;
    const ax=rect.x+(p.x+1)*rect.width/2,ay=rect.y+(1-p.y)*rect.height/2,bx=rect.x+(q.x+1)*rect.width/2,by=rect.y+(1-q.y)*rect.height/2;
    const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1))),dist=(ax+t*dx-x)**2+(ay+t*dy-y)**2;
    if(dist<best){const da=-a.clone().applyMatrix4(camera.matrixWorldInverse).z,db=-b.clone().applyMatrix4(camera.matrixWorldInverse).z,worldT=t*da/(db*(1-t)+t*da),point=a.lerp(b,worldT).toArray() as Vec3;if(this.visible(point)){best=dist;result={id:wire.id,point};}}
   }
  }
  if(!result)return null;
  const surface=this.e.world.wireCollisions.surface(result.id,camera.position,result.point);
  return surface?{id:result.id,...surface}:null;
 }
 private junction(hit:{point:Vec3;normal:Vec3}):Vec3{
  const point=this.surfacePoint(hit.point,hit.normal);point[1]=Math.max(point[1],wireCollarRadius(this.style)+.005);return point;
 }
 private candidate(to:Endpoint,points=this.bends,surface?:WireSurface):Wire{
  const path=this.e.world.wireCollisions.snapEnds(this.style,[endpointPosition(this.start!,this.e.world.pieces),...points,endpointPosition(to,this.e.world.pieces)],this.startSurface,surface);
  return {id:this.movingWire?.id??this.previewId,...this.style,...(this.movingWire?.frame?{frame:this.movingWire.frame}:{}),from:this.startSurface?{point:path[0]}:this.start!,to:surface?{point:path.at(-1)!}:to,points};
 }
 private click(x:number,y:number,shift=false){
  const port=this.hitPort(x,y),wire=port?null:this.hitWire(x,y);
  if(!this.start){if(port)this.begin(port);else if(wire)this.begin({point:this.junction(wire)},wire);else{const hit=this.e.view.pick(x,y);if(hit){const point=this.surfacePoint(hit.point,hit.normal),issue=wireRouteIssue([point],this.style,this.e.world.plots);if(issue)this.e.toast(issue);else this.begin({point});}}return;}
  if(wire&&shift){this.addBend(this.junction(wire),wire);return;}
  const end=port??(wire?{point:this.junction(wire)}:null);
  if(end){this.commit(end,this.bends,wire??undefined);return;}
  const hit=this.e.view.pick(x,y);if(hit)this.addBend(this.surfacePoint(hit.point,hit.normal));
 }
 private addBend(point:Vec3,surface?:WireSurface){
  if(!this.start)return;
  const candidate=this.candidate({point},this.bends,surface),path=wirePath(candidate,this.e.world.pieces),issue=this.e.world.wirePlacementIssue(candidate);
  if(issue){this.preview({point},surface);this.e.toast(issue);return;}
  if(new Vector3(...point).distanceTo(new Vector3(...path[path.length-2]))<.03){if(this.bends.length)this.finishSurface();return;}
  point=path.at(-1)!;this.bends.push(point);this.preview({point});this.previewKey='';
 }
 private finishSurface(){if(this.start&&this.bends.length)this.commit({point:this.bends.at(-1)!},this.bends.slice(0,-1));}
 private commit(to:Endpoint,points:Vec3[],surface?:WireSurface){
  if(!this.start)return;
  const movedId=this.movingWire?.id,wire={...structuredClone(this.candidate(to,points,surface)),id:movedId??crypto.randomUUID()},path=wirePath(wire,this.e.world.pieces),issue=this.e.world.wirePlacementIssue(wire);
  if(issue){this.preview(to,surface);this.e.toast(issue);return;}if(wireLength(path)<.03){this.e.toast('Choose a different end point.');return;}
  const wires=movedId?this.e.world.wires.map(w=>w.id===movedId?wire:w):[...this.e.world.wires,wire];
  if(this.e.world.execute([],wires)){if(movedId){this.toggle(false);this.e.pickSelections([],[movedId]);}else this.cancel();}
 }
 private preview(to:Endpoint,surface?:WireSurface){
  if(!this.start)return;this.previewEnd=to;
  const wire=this.candidate(to,this.bends,surface),path=wirePath(wire,this.e.world.pieces);
  this.previewPath=path;
  this.previewIssue=this.e.world.wirePlacementIssue(wire);
  if(!this.draftView){this.draftView=new WireView();this.draftView.root.name='Wire placement preview';this.draftView.root.remove(...this.draftView.lights);this.e.view.worldRoot.add(this.draftView.root);}
  this.draftView.root.visible=true;this.draftView.rebuild([wire],this.e.world.pieces,{ends:false});this.draftView.draft(!this.previewIssue);this.status();
 }
 private status(){
  this.colorUI();this.lengthUI();
 }
 private lengthUI(){
  const path=this.start?(this.previewEnd?this.previewPath:[endpointPosition(this.start,this.e.world.pieces),...this.bends]):[],length=wireLength(path),limit=wireLimit(this.style),issue=this.previewIssue??(path.length?wireRouteIssue(path,this.style,this.e.world.plots):null);
  const label=$('wire-length-label');label.hidden=!this.wiring||!this.start||length<.03;
  if(label.hidden)return;
  const text=`${length.toFixed(1)}/${limit}`;if(label.textContent!==text)label.textContent=text;
  label.classList.toggle('wire-invalid',!!issue);label.title=issue??'';label.setAttribute('aria-label',`${length.toFixed(1)} of ${limit} studs${issue?': '+issue:''}`);
  // Center on half the route's length, including its bends and vertical sections.
  let remaining=length*.5;
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i],segment=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
   if(remaining<=segment||i===path.length-1){this.labelPoint.set(...a).lerp(new Vector3(...b),segment?remaining/segment:0);break;}remaining-=segment;
  }
  const camera=this.e.view.camera.camera;camera.updateMatrixWorld();this.labelPoint.project(camera);
  if(this.labelPoint.z< -1||this.labelPoint.z>1||Math.abs(this.labelPoint.x)>1||Math.abs(this.labelPoint.y)>1){label.hidden=true;return;}
  const rect=this.e.view.renderer.domElement.getBoundingClientRect(),viewport=$('viewport').getBoundingClientRect();
  label.style.left=`${rect.left-viewport.left+(this.labelPoint.x+1)*rect.width/2}px`;label.style.top=`${rect.top-viewport.top+(1-this.labelPoint.y)*rect.height/2}px`;
 }
 activate(id=this.e.selected){
  const p=id?this.e.world.pieces.get(id):undefined;if(!p)return;
  if(p.item==='lever')this.e.world.execute([{before:p,after:{...p,logicOn:!p.logicOn}}]);
  else if(p.item==='button')this.e.view.logic.circuit.press(p.id);
  this.inspect();
 }
 inspect(){
  this.selectionUI();
  const pieces=this.e.selectedPieces,p=pieces.length===1?pieces[0]:undefined,ports=p?portsFor(p.item):[];
  $('logic-controls').hidden=!ports.length||this.e.placing;
  if(!p||!ports.length)return;
  const action=$('logic-action');action.hidden=!['lever','button'].includes(p.item);action.textContent=p.item==='lever'?(p.logicOn?'Switch off':'Switch on'):'Press button';
  const timer=p.item==='signal-delay'||p.item==='signal-sustain';$('logic-timer-row').hidden=!timer;($('logic-timing') as HTMLSelectElement).value=String(p.timing??1);
  $('logic-ports').replaceChildren(...ports.map(port=>{const b=document.createElement('button');b.dataset.port=port.id;b.textContent=port.label;b.title='Start a wire at '+port.label;return b;}));
  this.previousStatus='';this.tick();
 }
 tick(){
  this.interaction.tick();
  if(this.generation!==this.e.world.generation){this.generation=this.e.world.generation;this.clearSelection();if(this.wiring)this.toggle(false);}
  if(this.revision!==this.e.world.revision){
   this.revision=this.e.world.revision;
   this.status();
  }
  if(this.movingWire&&!this.e.world.wires.some(w=>w.id===this.movingWire!.id))this.toggle(false);
  if(this.start&&'piece' in this.start&&!this.e.world.pieces.has(this.start.piece))this.cancel(!!this.movingWire);
  if(this.wiring&&this.start&&this.pointer){
   const camera=this.e.view.camera.camera,key=this.pointer.join(',')+camera.position.toArray().join(',')+camera.quaternion.toArray().join(',')+this.e.world.revision+this.e.world.allowOverlaps;
   if(key!==this.previewKey){this.previewKey=key;const [x,y]=this.pointer,port=this.hitPort(x,y),wire=port?null:this.hitWire(x,y),hit=port||wire?null:this.e.view.pick(x,y);
    if(port)this.preview(port);else if(wire)this.preview({point:this.junction(wire)},wire);else if(hit)this.preview({point:this.surfacePoint(hit.point,hit.normal)});else{this.previewEnd=null;this.previewIssue=null;if(this.bends.length)this.preview({point:this.bends.at(-1)!});else{if(this.draftView)this.draftView.root.visible=false;this.status();}}
   }
  }
  this.lengthUI();
  const circuit=this.e.view.logic.circuit;
  const lights=this.e.selectedPieces.filter(p=>ITEMS.get(p.item)!.fixedMaterial==='lighting');
  if(lights.length){const manual=lights.filter(p=>!circuit.connected(p.id)),shown=manual.length?manual:lights,toggle=$('light-toggle') as HTMLInputElement;
   const count=shown.filter(p=>this.e.world.lightEnabled(p)).length;toggle.checked=count===shown.length;toggle.indeterminate=count>0&&count<shown.length;toggle.disabled=!manual.length;
   $('light-label').textContent=!manual.length?'Controlled by wire':manual.length<lights.length?'Unwired lights on':'Light on';
  }
  const p=this.e.selectedPieces[0];if(!p||$('logic-controls').hidden)return;
  const text=circuit.unstable.has(p.id)?'Unsettled feedback · add a delay':p.item==='pressure-plate'?'Walk onto the wooden plate to activate':ITEMS.get(p.item)!.fixedMaterial==='lighting'?(circuit.connected(p.id)?'Controlled by wire · '+(circuit.input(p.id)?'On':'Off'):'Connect a wire to the switch'):'Output · '+(circuit.output(p.id)?'On':'Off');
  if(text!==this.previousStatus){$('logic-status').textContent=text;this.previousStatus=text;}
 }
}
