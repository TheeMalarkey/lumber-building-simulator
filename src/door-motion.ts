import {doorProgress,setDoorProgress} from './door-design';
import type {World} from './world';
import type {Circuit} from './logic';
import {pieceBounds} from './world';
import {coveredByPlots} from './plots';
import {wirePath} from './logic-ports';
import {wireRouteIssue} from './wire-design';
import {WireCollisionIndex} from './wire-collision';

/** Only changing doors advance. Resting assemblies have no per-frame motion work. */
export class DoorMotion {
 private revision=-1;private generation=-1;private signal=-1;private active=new Set<string>();
 private targets=new Map<string,number>();
 private playerBlocked=new Set<string>();private retryTime=0;
 blocked=new Set<string>();
 version=0;
 constructor(private world:World){}
 progress(id:string){const p=this.world.pieces.get(id);return p?doorProgress(p):0;}
 tick(seconds:number,circuit:Circuit,canOccupy?:()=>boolean){
  const changed=new Set<string>();
  if(this.generation!==this.world.generation){this.generation=this.world.generation;this.targets.clear();this.active.clear();this.blocked.clear();this.playerBlocked.clear();this.revision=-1;}
  this.retryTime+=seconds;
  if(this.retryTime>=.15){this.retryTime=0;for(const id of this.playerBlocked)this.active.add(id);}
  if(this.revision!==this.world.revision||this.signal!==circuit.version){
   this.revision=this.world.revision;this.signal=circuit.version;
   for(const id of this.targets.keys())if(!this.world.doorIds.has(id)){this.targets.delete(id);this.active.delete(id);this.blocked.delete(id);this.playerBlocked.delete(id);}
   for(const id of this.world.doorIds){const p=this.world.pieces.get(id)!,target=Number(circuit.connected(id)?circuit.input(id):p.doorOpen===true);
    this.targets.set(id,target);if(Math.abs(doorProgress(p)-target)>1e-8)this.active.add(id);
   }
  }
  for(const id of this.active){const p=this.world.pieces.get(id);if(!p){this.active.delete(id);continue;}
   const target=this.targets.get(id)!,before=doorProgress(p),distance=Math.min(Math.abs(target-before),Math.max(0,Math.min(.05,seconds))/.65),sign=Math.sign(target-before);
   const steps=Math.max(1,Math.ceil(distance*90/2));let value=before;this.blocked.delete(id);this.playerBlocked.delete(id);
   const playerWasClear=!canOccupy||canOccupy();
   const leads=p.item==='hatch'||!circuit.connected(id)?[]:this.world.wires.filter(w=>[w.from,w.to].some(e=>'piece' in e&&e.piece===id));
   const leadIds=new Set(leads.map(w=>w.id)),wireIndex=leads.length?this.world.wireCollisions:null;
   for(let i=1;i<=steps;i++){
    const proposed=before+sign*distance*i/steps,next=Math.abs(proposed-target)<1e-8?target:proposed;setDoorProgress(p,next);
    const bounds=pieceBounds(p);
    const playerIssue=!!(playerWasClear&&canOccupy&&!canOccupy());
    if(playerIssue)this.playerBlocked.add(id);
    const batch=leads.length>1&&!this.world.allowOverlaps?new WireCollisionIndex(leads,this.world.pieces):null;
    const wireIssue=leads.some(w=>w.kind&&(wireRouteIssue(wirePath(w,this.world.pieces),w,this.world.plots)||(!this.world.allowOverlaps&&(wireIndex!.issue(w,this.world.pieces,leadIds)||batch?.issue(w,this.world.pieces,undefined,false)))));
    const issue=bounds.min[1]<-1e-8||!!this.world.plots&&!coveredByPlots(bounds,this.world.plots)||this.world.placementIssue(p,id)!==null||playerIssue||wireIssue;
    if(issue){setDoorProgress(p,value);this.blocked.add(id);break;}value=next;
   }
   if(value!==before){changed.add(id);if(leads.length)this.world.invalidateWireGeometry();}
   if(Math.abs(value-target)<1e-8||this.blocked.has(id))this.active.delete(id);
  }
  if(changed.size){this.version++;for(const id of this.blocked)this.active.add(id);}
  return changed;
 }
}
