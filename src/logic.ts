import type {Piece} from './world';
import {wireGroups,isLogic,portsFor,portKey,type Wire,type Port} from './logic-ports';
import {orderedComponents} from './logic-graph';

export const BUTTON_MS=350,TICK_MS=200;
export function gateOutput(item:string,a:boolean,b=false){
 switch(item){case 'and-gate':return a&&b;case 'or-gate':return a||b;case 'xor-gate':return a!==b;
 case 'nand-gate':return !(a&&b);case 'nor-gate':return !(a||b);case 'xnor-gate':return a===b;case 'signal-inverter':return !a;default:return false;}
}
interface Timer {input:boolean;output:boolean;hold:number;events:{at:number;on:boolean}[];setting:number}
interface Net {ports:{piece:string;port:Port}[];wires:string[]}
/** Event-time simulation, matching the fundamental Circuit Workbench rules.
 * Rendering frames never act as electrical clock ticks. */
export class Circuit {
 time=0;version=0;solves=0;topologyBuilds=0;unstable=new Set<string>();
 private pieces=new Map<string,Piece>();private nets:Net[]=[];
 private components:{nodes:Piece[];cyclic:boolean}[]=[];
 private drivenNets=new Map<string,Set<Net>>();
 private wires:Wire[]|null=null;
 private outputs=new Map<string,boolean>();private inputs=new Map<string,boolean>();
 private powered=new Set<string>();private attached=new Set<string>();
 private pulses=new Map<string,number>();private plates=new Set<string>();private timers=new Map<string,Timer>();
 output(id:string){return this.outputs.get(id)??false;}
 input(id:string,port='in'){return this.inputs.get(portKey(id,port))??false;}
 connected(id:string,port='in'){return this.attached.has(portKey(id,port));}
 wireOn(id:string){return this.powered.has(id);}
 configure(pieces:Piece[],wires:Wire[]){
  const nodes=pieces.filter(p=>portsFor(p.item).length);
  const sameTopology=this.wires===wires&&this.pieces.size===nodes.length&&nodes.every(p=>{const old=this.pieces.get(p.id);return old?.item===p.item&&old.position.every((v,i)=>v===p.position[i])&&old.rotation.every((v,i)=>v===p.rotation[i]);});
  this.pieces=new Map(nodes.map(p=>[p.id,p]));
  for(const [id,t] of this.timers)if(!this.pieces.has(id)||(this.pieces.get(id)!.timing??1)!==t.setting)this.timers.delete(id);
  for(const id of this.pulses.keys())if(!this.pieces.has(id))this.pulses.delete(id);
  for(const id of this.plates)if(!this.pieces.has(id))this.plates.delete(id);
  for(const p of this.pieces.values())if(p.item==='signal-delay'||p.item==='signal-sustain'){
   if(!this.timers.has(p.id))this.timers.set(p.id,{input:false,output:false,hold:0,events:[],setting:p.timing??1});
  }
  if(sameTopology){for(const component of this.components)component.nodes=component.nodes.map(p=>this.pieces.get(p.id)!);this.settle();return;}
  this.wires=wires;this.topologyBuilds++;
  this.attached.clear();this.nets=wireGroups(wires,this.pieces).map(indices=>{
   const unique=new Map<string,{piece:string;port:Port}>();
   for(const i of indices)for(const e of [wires[i].from,wires[i].to])if('piece' in e){const key=portKey(e.piece,e.port);this.attached.add(key);unique.set(key,{piece:e.piece,port:portsFor(this.pieces.get(e.piece)!.item).find(p=>p.id===e.port)!});}
   return {ports:[...unique.values()],wires:indices.map(i=>wires[i].id)};
  });
  const edges=new Map([...this.pieces.values()].filter(isLogic).map(p=>[p.id,new Set<string>()]));
  this.drivenNets.clear();
  for(const net of this.nets){
   const consumers=net.ports.filter(p=>!p.port.output&&edges.has(p.piece)&&this.pieces.get(p.piece)!.item!=='signal-delay');
   for(const driver of net.ports.filter(p=>p.port.output)){
    if(!this.drivenNets.has(driver.piece))this.drivenNets.set(driver.piece,new Set());
    this.drivenNets.get(driver.piece)!.add(net);
    for(const target of consumers)edges.get(driver.piece)!.add(target.piece);
   }
  }
  this.components=orderedComponents(edges).map(ids=>({nodes:ids.map(id=>this.pieces.get(id)!),cyclic:ids.length>1||edges.get(ids[0])!.has(ids[0])}));
  this.settle();
 }
 press(id:string){if(this.pieces.get(id)?.item!=='button')return;this.pulses.set(id,this.time+BUTTON_MS);this.settle();}
 setPlates(ids:Set<string>){if(ids.size===this.plates.size&&[...ids].every(id=>this.plates.has(id)))return;this.plates=new Set(ids);this.settle();}
 private signals(outputs:Map<string,boolean>){
  const inputs=new Map<string,boolean>(),powered=new Set<string>();
  for(const net of this.nets){const on=net.ports.some(p=>p.port.output&&outputs.get(p.piece));
   if(on)for(const id of net.wires)powered.add(id);
   for(const p of net.ports)if(!p.port.output)inputs.set(portKey(p.piece,p.port.id),on);
  }return {inputs,powered};
 }
 private settle(){
  this.solves++;this.unstable.clear();const out=new Map<string,boolean>();
  for(const {nodes} of this.components)for(const p of nodes)out.set(p.id,this.outputs.get(p.id)??false);
  const {inputs}=this.signals(out);
  const evaluate=(p:Piece)=>{
   const a=inputs.get(portKey(p.id,'in'))??inputs.get(portKey(p.id,'a'))??false,b=inputs.get(portKey(p.id,'b'))??false,t=this.timers.get(p.id);
   return p.item==='lever'?p.logicOn===true:p.item==='button'?(this.pulses.get(p.id)??0)>this.time:p.item==='pressure-plate'?this.plates.has(p.id):t?(p.item==='signal-delay'?t.output:a||t.hold>this.time||(t.input&&t.setting>1)):gateOutput(p.item,a,b);
  };
  const update=(nodes:Piece[],values:boolean[])=>{
   const dirty=new Set<Net>();let changed=false;
   nodes.forEach((p,i)=>{if(out.get(p.id)===values[i])return;changed=true;out.set(p.id,values[i]);for(const net of this.drivenNets.get(p.id)??[])dirty.add(net);});
   for(const net of dirty){const on=net.ports.some(p=>p.port.output&&out.get(p.piece));for(const p of net.ports)if(!p.port.output)inputs.set(portKey(p.piece,p.port.id),on);}
   return changed;
  };
  for(const {nodes,cyclic} of this.components){
   if(!cyclic){update(nodes,[evaluate(nodes[0])]);continue;}
   const seen=new Map<string,number>(),history:string[]=[];let settled=false,cycleStart=0;
   // Only genuine feedback components need fixed-point iteration. The bound
   // protects the render loop; it does not truncate propagation along a DAG.
   for(let pass=0;pass<Math.min(2048,Math.max(64,nodes.length*4));pass++){
    const values=nodes.map(evaluate),signature=values.map(Number).join('');
    if(!update(nodes,values)){settled=true;break;}
    if(seen.has(signature)){cycleStart=seen.get(signature)!;break;}seen.set(signature,history.length);history.push(signature);
   }
   if(!settled){
    const cycle=history.slice(cycleStart),last=cycle.at(-1)!;
    nodes.forEach((p,i)=>{if(cycle.some(state=>state[i]!==last[i]))this.unstable.add(p.id);});
    update(nodes,nodes.map(p=>this.unstable.has(p.id)?false:out.get(p.id)!));
    // Forced constants in the same feedback component retain their valid
    // outputs. Settle the remaining gates against the suppressed oscillators.
    const stable=nodes.filter(p=>!this.unstable.has(p.id));
    for(let pass=0;pass<stable.length+1;pass++)if(!update(stable,stable.map(evaluate)))break;
   }
  }
  let state=this.signals(out),timingChanged=false;
  for(const [id,t] of this.timers){const input=state.inputs.get(portKey(id,'in'))??false;if(input===t.input||this.unstable.has(id))continue;t.input=input;
   if(this.pieces.get(id)!.item==='signal-delay')t.events.push({at:this.time+t.setting*TICK_MS,on:input});
   else {t.hold=input?0:this.time+(t.setting===1?0:t.setting*TICK_MS);const next=input||t.hold>this.time;if(out.get(id)!==next){out.set(id,next);timingChanged=true;}}
  }
  this.outputs=out;state=this.signals(out);this.inputs=state.inputs;this.powered=state.powered;this.version++;
  // Holding Sustain must settle downstream gates before the release can leak.
  if(timingChanged)this.settle();
 }
 advance(ms:number){
  const target=this.time+Math.max(0,ms);let budget=1000;
  while(this.time<target&&budget-->0){
   let next=Infinity;
   for(const at of this.pulses.values())if(at>this.time)next=Math.min(next,at);
   for(const t of this.timers.values()){if(t.events.length)next=Math.min(next,t.events[0].at);if(t.hold>this.time)next=Math.min(next,t.hold);}
   this.time=Math.min(target,next);if(next>target)break;
   for(const [id,at] of this.pulses)if(at<=this.time)this.pulses.delete(id);
   for(const t of this.timers.values())while(t.events[0]?.at<=this.time)t.output=t.events.shift()!.on;
   this.settle();
  }
 }
}
