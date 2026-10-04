import {Vector3,Line,BufferGeometry,LineBasicMaterial,Float32BufferAttribute} from 'three';
import {ITEMS,type Vec3} from './catalog';
import {portsFor,portPosition,wirePath,endpointPosition,type Endpoint,type Wire} from './logic-ports';
import {NEON_COLORS,wireCollarRadius,wireColor,wireLength,wireLimit,wireRouteIssue,type NeonColor,type WireStyle} from './wire-design';
import type {Editor} from './editor';
import {LogicInteraction} from './logic-interaction';
import type {WireSurface} from './wire-shape';
const $=(id:string)=>document.getElementById(id)!;

export class LogicTools {
 wiring=false;private start:Endpoint|null=null;private bends:Vec3[]=[];private selectedWire:string|null=null;
 private down:number[]|null=null;private previousStatus='';private generation=-1;private revision=-1;
 private guide=new Line(new BufferGeometry(),new LineBasicMaterial({color:0xf2bc72,depthTest:true}));
 private style:WireStyle={kind:'wire'};private pointer:[number,number]|null=null;private previewKey='';private previewEnd:Endpoint|null=null;
 private previewId=crypto.randomUUID();private previewIssue:string|null=null;
 private startSurface?:WireSurface;
 private previewPath:Vec3[]=[];
 private interaction:LogicInteraction;
 constructor(private e:Editor){
  this.interaction=new LogicInteraction(e,()=>!this.wiring,id=>this.activate(id));
  e.view.worldRoot.add(this.guide);this.guide.visible=false;
  $('wire-tool').onclick=()=>this.toggle();$('wire-done').onclick=()=>this.toggle(false);
  $('wire-finish').onclick=()=>this.finishSurface();
  document.querySelectorAll<HTMLButtonElement>('[data-wire-kind]').forEach(b=>b.onclick=()=>{if(this.start)return;this.style=b.dataset.wireKind==='neon'?{kind:'neon',color:this.style.color??'white'}:{kind:'wire'};this.status();});
  $('wire-colors').replaceChildren(...Object.entries(NEON_COLORS).map(([id,c])=>{const b=document.createElement('button');b.dataset.wireColor=id;b.title=c.label+(id==='pink'?' · Bright Gift':'')+' neon';b.setAttribute('aria-label',b.title);b.style.setProperty('--wire-color','#'+c.hex.toString(16).padStart(6,'0'));b.onclick=()=>{if(this.start)return;this.style={kind:'neon',color:id as NeonColor};this.status();};return b;}));
  $('wire-remove').onclick=()=>{if(this.selectedWire)e.world.execute([],e.world.wires.filter(w=>w.id!==this.selectedWire));this.selectedWire=null;this.status();};
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
   if(this.wiring&&['Escape','Backspace','Delete','Enter'].includes(event.code)){
    event.preventDefault();event.stopImmediatePropagation();
    if(event.code==='Escape'){if(this.start)this.cancel();else this.toggle(false);}
    else if(event.code==='Backspace'&&this.start){if(this.bends.length){this.bends.pop();this.previewKey='';this.status();}else this.cancel();}
    else if(event.code==='Enter')this.finishSurface();
    else if(event.code==='Delete')$('wire-remove').click();return;
   }
  },true);
 }
 private surfacePoint(point:Vec3,normal:Vec3):Vec3{return point.map((v,i)=>v+normal[i]*(wireCollarRadius(this.style)+.005)) as Vec3;}
 private cancel(){this.start=null;this.bends=[];this.startSurface=undefined;this.previewEnd=null;this.previewPath=[];this.previewIssue=null;this.previewKey='';this.guide.visible=false;this.status();}
 toggle(value=!this.wiring){
  if(value){this.e.pickSelection(null);this.e.panel('build-panel',false);this.e.panel('project-menu',false);}
  this.wiring=value;this.selectedWire=null;this.cancel();
  $('select-tool').classList.toggle('active',!value);
  this.e.view.logic.showSockets=value;this.e.view.logic.refresh();$('wire-tool').classList.toggle('active',value);$('wire-tool').setAttribute('aria-pressed',String(value));$('wiring-panel').hidden=!value;this.status();
 }
 begin(endpoint:Endpoint,surface?:WireSurface){if(!this.wiring)this.toggle(true);this.start=endpoint;this.startSurface=surface;this.bends=[];this.selectedWire=null;this.previewEnd=null;this.previewPath=[];this.previewIssue=null;this.previewKey='';this.status();}
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
  for(const wire of this.e.world.wires){const path=wirePath(wire,this.e.world.pieces);
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
  return {id:this.previewId,...this.style,from:this.startSurface?{point:path[0]}:this.start!,to:surface?{point:path.at(-1)!}:to,points};
 }
 private click(x:number,y:number,shift=false){
  const port=this.hitPort(x,y),wire=port?null:this.hitWire(x,y);
  if(!this.start){if(port)this.begin(port);else if(wire){this.begin({point:this.junction(wire)},wire);this.selectedWire=wire.id;this.status();}else{const hit=this.e.view.pick(x,y);if(hit){const point=this.surfacePoint(hit.point,hit.normal),issue=wireRouteIssue([point],this.style,this.e.world.plots);if(issue)this.e.toast(issue);else this.begin({point});}}return;}
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
  const wire={...structuredClone(this.candidate(to,points,surface)),id:crypto.randomUUID()},path=wirePath(wire,this.e.world.pieces),issue=this.e.world.wirePlacementIssue(wire);
  if(issue){this.preview(to,surface);this.e.toast(issue);return;}if(wireLength(path)<.03){this.e.toast('Choose a different end point.');return;}
  if(this.e.world.execute([],[...this.e.world.wires,wire])){this.selectedWire=null;this.cancel();}
 }
 private preview(to:Endpoint,surface?:WireSurface){
  if(!this.start)return;this.previewEnd=to;
  const wire=this.candidate(to,this.bends,surface),path=wirePath(wire,this.e.world.pieces),count=path.length;
  this.previewPath=path;
  let positions=this.guide.geometry.getAttribute('position');
  if(!positions||positions.count<count){this.guide.geometry.dispose();this.guide.geometry=new BufferGeometry();positions=new Float32BufferAttribute(new Float32Array(Math.max(16,count*2)*3),3);this.guide.geometry.setAttribute('position',positions);}
  path.forEach((p,i)=>positions.setXYZ(i,...p));positions.needsUpdate=true;this.guide.geometry.setDrawRange(0,count);this.guide.frustumCulled=false;this.guide.visible=true;
  this.previewIssue=this.e.world.wirePlacementIssue(wire);
  this.guide.material.color.setHex(this.previewIssue?0xff705b:this.style.kind==='neon'?wireColor(this.style,true):0x99dcff);this.status();
 }
 private status(){
  $('wire-status').textContent=this.start?`${this.style.kind==='neon'?NEON_COLORS[this.style.color??'white'].label+' neon':'Wire'} · ${this.bends.length} surface points`:'Click a surface, socket or wire';
  const path=this.start?(this.previewEnd?this.previewPath:[endpointPosition(this.start,this.e.world.pieces),...this.bends]):[],length=wireLength(path),limit=wireLimit(this.style),issue=this.previewIssue??(path.length?wireRouteIssue(path,this.style,this.e.world.plots):null);
  $('wire-length').textContent=`${length.toFixed(2)} / ${limit} studs`;$('wire-length').classList.toggle('wire-invalid',!!issue);
  const meter=$('wire-budget') as HTMLProgressElement;meter.max=limit;meter.value=Math.min(length,limit);
  $('wire-feedback').textContent=issue??'';$('wire-feedback').classList.toggle('wire-invalid',!!issue);
  ($('wire-finish') as HTMLButtonElement).disabled=!this.start||!this.bends.length;
  $('wire-colors').hidden=this.style.kind!=='neon';
  document.querySelectorAll<HTMLButtonElement>('[data-wire-kind]').forEach(b=>{b.disabled=!!this.start;b.setAttribute('aria-pressed',String(b.dataset.wireKind===this.style.kind));});
  document.querySelectorAll<HTMLButtonElement>('[data-wire-color]').forEach(b=>{b.disabled=!!this.start;b.setAttribute('aria-pressed',String(b.dataset.wireColor===this.style.color));});
  $('wire-remove').hidden=!this.selectedWire;$('wire-count').textContent=`${this.e.world.wires.length} wires · route on or over other wires`;
 }
 activate(id=this.e.selected){
  const p=id?this.e.world.pieces.get(id):undefined;if(!p)return;
  if(p.item==='lever')this.e.world.execute([{before:p,after:{...p,logicOn:!p.logicOn}}]);
  else if(p.item==='button')this.e.view.logic.circuit.press(p.id);
  this.inspect();
 }
 inspect(){
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
  if(this.generation!==this.e.world.generation){this.generation=this.e.world.generation;if(this.wiring)this.toggle(false);}
  if(this.revision!==this.e.world.revision){this.revision=this.e.world.revision;this.status();}
  if(this.start&&'piece' in this.start&&!this.e.world.pieces.has(this.start.piece)){this.start=null;this.bends=[];this.guide.visible=false;this.status();}
  if(this.wiring&&this.start&&this.pointer){
   const camera=this.e.view.camera.camera,key=this.pointer.join(',')+camera.position.toArray().join(',')+camera.quaternion.toArray().join(',')+this.e.world.revision;
   if(key!==this.previewKey){this.previewKey=key;const [x,y]=this.pointer,port=this.hitPort(x,y),wire=port?null:this.hitWire(x,y),hit=port||wire?null:this.e.view.pick(x,y);
    if(port)this.preview(port);else if(wire)this.preview({point:this.junction(wire)},wire);else if(hit)this.preview({point:this.surfacePoint(hit.point,hit.normal)});else{this.previewEnd=null;this.previewIssue=null;this.guide.visible=false;this.status();}
   }
  }
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
