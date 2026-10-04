import {Vector3,Line,BufferGeometry,LineBasicMaterial} from 'three';
import {ITEMS,type Vec3} from './catalog';
import {portsFor,portPosition,wirePath,endpointPosition,type Endpoint} from './logic-ports';
import type {Editor} from './editor';
import {LogicInteraction} from './logic-interaction';
const $=(id:string)=>document.getElementById(id)!;

export class LogicTools {
 wiring=false;private start:Endpoint|null=null;private bends:Vec3[]=[];private selectedWire:string|null=null;
 private down:number[]|null=null;private previousStatus='';private generation=-1;private revision=-1;
 private guide=new Line(new BufferGeometry(),new LineBasicMaterial({color:0xf2bc72,depthTest:false}));
 private interaction:LogicInteraction;
 constructor(private e:Editor){
  this.interaction=new LogicInteraction(e,()=>!this.wiring,id=>this.activate(id));
  e.view.worldRoot.add(this.guide);this.guide.visible=false;
  $('wire-tool').onclick=()=>this.toggle();$('wire-done').onclick=()=>this.toggle(false);
  $('wire-remove').onclick=()=>{if(this.selectedWire)e.world.execute([],e.world.wires.filter(w=>w.id!==this.selectedWire));this.selectedWire=null;this.status();};
  $('logic-action').onclick=()=>this.activate();
  $('logic-timing').onchange=()=>{const p=e.selectedPieces[0];if(!p)return;e.world.execute([{before:p,after:{...p,timing:Number(($('logic-timing') as HTMLSelectElement).value)}}]);this.inspect();};
  $('logic-ports').onclick=event=>{const port=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-port]')?.dataset.port;if(port&&e.selected)this.begin({piece:e.selected,port});};
  const canvas=e.view.renderer.domElement;
  canvas.addEventListener('pointerdown',event=>{if(!this.wiring||event.button!==0)return;event.stopImmediatePropagation();event.preventDefault();this.down=[event.clientX,event.clientY];canvas.focus();},true);
  canvas.addEventListener('pointerup',event=>{
   if(!this.wiring||event.button!==0)return;event.stopImmediatePropagation();event.preventDefault();
   if(!this.down||Math.hypot(event.clientX-this.down[0],event.clientY-this.down[1])>5){this.down=null;return;}this.down=null;
   this.click(event.clientX,event.clientY);
  },true);
  canvas.addEventListener('dblclick',event=>{if(this.wiring){event.stopImmediatePropagation();event.preventDefault();}},true);
  canvas.addEventListener('pointermove',event=>{
   if(!this.wiring||!this.start)return;
   const target=this.hitPort(event.clientX,event.clientY),hit=e.view.pick(event.clientX,event.clientY);
   if(target)this.preview(endpointPosition(target,e.world.pieces));else if(hit)this.preview(this.surfacePoint(hit.point,hit.normal));
  });
  window.addEventListener('keydown',event=>{
   if((event.target as HTMLElement).matches('input,select,textarea')||document.querySelector('dialog[open]'))return;
   if(this.wiring&&['Escape','Backspace','Delete'].includes(event.code)){
    event.preventDefault();event.stopImmediatePropagation();
    if(event.code==='Escape'){if(this.start){this.start=null;this.bends=[];this.guide.visible=false;this.status();}else this.toggle(false);}
    else if(event.code==='Backspace'&&this.bends.length){this.bends.pop();this.status();}
    else if(event.code==='Delete')$('wire-remove').click();return;
   }
  },true);
 }
 private surfacePoint(point:Vec3,normal:Vec3):Vec3{return point.map((v,i)=>v+normal[i]*.06) as Vec3;}
 toggle(value=!this.wiring){
  if(value){this.e.pickSelection(null);this.e.panel('build-panel',false);this.e.panel('project-menu',false);}
  this.wiring=value;this.start=null;this.bends=[];this.selectedWire=null;this.guide.visible=false;
  $('select-tool').classList.toggle('active',!value);
  this.e.view.logic.showSockets=value;this.e.view.logic.refresh();$('wire-tool').classList.toggle('active',value);$('wire-tool').setAttribute('aria-pressed',String(value));$('wiring-panel').hidden=!value;this.status();
 }
 begin(endpoint:Endpoint){if(!this.wiring)this.toggle(true);this.start=endpoint;this.bends=[];this.selectedWire=null;this.status();}
 private hitPort(x:number,y:number):Endpoint|null{
  const rect=this.e.view.renderer.domElement.getBoundingClientRect(),camera=this.e.view.camera.camera;let best=20*20,result:Endpoint|null=null;
  for(const id of this.e.world.logicIds){const p=this.e.world.pieces.get(id)!;
   if(new Vector3(...p.position).distanceToSquared(camera.position)>128*128)continue;
   for(const port of portsFor(p.item)){const v=new Vector3(...portPosition(p,port.id)).project(camera);if(v.z< -1||v.z>1)continue;
    const d=(rect.x+(v.x+1)*rect.width/2-x)**2+(rect.y+(1-v.y)*rect.height/2-y)**2;
    if(d<best){best=d;result={piece:id,port:port.id};}
   }
  }return result;
 }
 private hitWire(x:number,y:number){
  const rect=this.e.view.renderer.domElement.getBoundingClientRect(),camera=this.e.view.camera.camera;let best=9*9,result:{id:string;point:Vec3}|null=null;
  for(const wire of this.e.world.wires){const path=wirePath(wire,this.e.world.pieces);
   for(let i=1;i<path.length;i++){const a=new Vector3(...path[i-1]),b=new Vector3(...path[i]),p=a.clone().project(camera),q=b.clone().project(camera);if(p.z>1||q.z>1||p.z< -1||q.z< -1)continue;
    const ax=rect.x+(p.x+1)*rect.width/2,ay=rect.y+(1-p.y)*rect.height/2,bx=rect.x+(q.x+1)*rect.width/2,by=rect.y+(1-q.y)*rect.height/2;
    const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1))),dist=(ax+t*dx-x)**2+(ay+t*dy-y)**2;
    if(dist<best){best=dist;const da=-a.clone().applyMatrix4(camera.matrixWorldInverse).z,db=-b.clone().applyMatrix4(camera.matrixWorldInverse).z,worldT=t*da/(db*(1-t)+t*da);result={id:wire.id,point:a.lerp(b,worldT).toArray() as Vec3};}
   }
  }return result;
 }
 private click(x:number,y:number){
  const port=this.hitPort(x,y),wire=port?null:this.hitWire(x,y);
  if(!this.start){if(port)this.begin(port);else if(wire){this.selectedWire=wire.id;this.begin({point:wire.point});this.selectedWire=wire.id;this.status();}return;}
  const end=port??(wire?{point:wire.point}:null);
  if(end){
   const points=[endpointPosition(this.start,this.e.world.pieces),...this.bends,endpointPosition(end,this.e.world.pieces)];
   if(points.slice(1).reduce((sum,p,i)=>sum+new Vector3(...p).distanceTo(new Vector3(...points[i])),0)<.03){this.e.toast('Choose a different socket.');return;}
   this.e.world.execute([],[...this.e.world.wires,{id:crypto.randomUUID(),from:structuredClone(this.start),to:end,points:structuredClone(this.bends)}]);
   this.start=null;this.bends=[];this.guide.visible=false;this.selectedWire=null;this.status();return;
  }
  const hit=this.e.view.pick(x,y);if(hit){this.bends.push(this.surfacePoint(hit.point,hit.normal));this.preview(this.bends.at(-1)!);this.status();}
 }
 private preview(point:Vec3){if(!this.start)return;this.guide.geometry.dispose();this.guide.geometry=new BufferGeometry().setFromPoints([endpointPosition(this.start,this.e.world.pieces),...this.bends,point].map(p=>new Vector3(...p)));this.guide.visible=true;}
 private status(){
  $('wire-status').textContent=this.start?`Choose a socket to finish · ${this.bends.length} bends`:'Click a socket or wire to start';
  $('wire-remove').hidden=!this.selectedWire;$('wire-count').textContent=`${this.e.world.wires.length} wires · crossing lines stay separate`;
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
