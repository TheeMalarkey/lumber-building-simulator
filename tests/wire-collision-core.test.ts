import {it,expect} from 'vitest';
import {World,type Piece} from '../src/world';
import {wireGroups,validateWires,type Wire} from '../src/logic-ports';
import type {Vec3} from '../src/catalog';
import {wireRadius,wireCollarRadius} from '../src/wire-design';
import {Circuit} from '../src/logic';
import {Quaternion,Vector3} from 'three';

const wire=(id:string,a:Vec3,b:Vec3,points:Vec3[]=[]):Wire=>({id,kind:'wire',from:{point:a},to:{point:b},points});
const host=()=>wire('host',[-4,1,0],[4,1,0]);
const put=(world:World,w:Wire)=>world.execute([],[...world.wires,w]);
const elbowRotations=[new Quaternion(),new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),1.13),new Quaternion().setFromAxisAngle(new Vector3(3,-2,1).normalize(),2.4)];
function acuteWire(kind:'wire'|'neon',degrees:number,left=4,right=4,rotation=new Quaternion()):Wire{
 const angle=degrees*Math.PI/180,point=(p:Vec3)=>new Vector3(...p).applyQuaternion(rotation).add(new Vector3(0,6,0)).toArray() as Vec3;
 return {id:'acute',kind,...(kind==='neon'?{color:'cyan' as const}:{}),from:{point:point([-left,0,0])},to:{point:point([-right*Math.cos(angle),0,right*Math.sin(angle)])},points:[point([0,0,0])],frame:rotation.toArray() as [number,number,number,number]};
}

it('thickens regular tubes and ends without changing the accepted neon dimensions',()=>{
 expect(wireRadius({kind:'wire'})).toBe(.10);expect(wireCollarRadius({kind:'wire'})).toBe(.14);
 expect(wireRadius({kind:'neon'})).toBe(.12);expect(wireCollarRadius({kind:'neon'})).toBe(.15);
});
it('rejects penetrating crossings when overlap is disabled, without recording history',()=>{
 const world=new World();world.load([],null,[host()]);
 let issue='';world.onReject=m=>issue=m;
 expect(put(world,wire('cross',[0,1,-4],[0,1,4]))).toBe(false);
 expect(issue).toContain('wire');expect(world.wires).toHaveLength(1);expect(world.canUndo).toBe(false);
});
it('allows regular and neon crossings only with overlaps enabled, with reversible history',()=>{
 for(const kind of ['wire','neon'] as const){
  const world=new World();world.load([], [12], [host()]);
  const cross:Wire={...wire('cross',[0,1,-4],[0,1,4]),kind};
  expect(world.wirePlacementIssue(cross)).toMatch(/wire/);
  world.allowOverlaps=true;expect(world.wirePlacementIssue(cross)).toBeNull();
  expect(put(world,cross)).toBe(true);expect(world.wires).toEqual([host(),cross]);
  world.undo();expect(world.wires).toEqual([host()]);world.redo();expect(world.wires).toEqual([host(),cross]);
 }
});
it('overlap permission keeps full-wire ground, land and length restrictions for previews and commits',()=>{
 const world=new World();world.load([], [12], [host()]);world.allowOverlaps=true;
 for(const [candidate,message] of [
  [wire('buried',[0,.05,-4],[0,.05,4]),'above the ground'],
  [wire('outside',[19,1,0],[21,1,0]),'active plots'],
  [wire('long',[-11,1,0],[11,1,0]),'20'],
  [{...wire('neon-long',[-9,1,0],[9,1,0]),kind:'neon'},'16'],
 ] as [Wire,string][]){
  expect(world.wirePlacementIssue(candidate)).toContain(message);
  expect(put(world,candidate)).toBe(false);expect(world.wires).toEqual([host()]);expect(world.canUndo).toBe(false);
 }
});
it('allows tubes touching on top and separated overpasses, including diagonals',()=>{
 const world=new World();world.load([],null,[host()]);
 expect(put(world,wire('over',[0,1.2,-4],[0,1.2,4]))).toBe(true);
 world.undo();expect(world.wires).toHaveLength(1);world.redo();expect(world.wires).toHaveLength(2);
 world.load([],null,[wire('diagonal',[-4,1,-4],[4,1,4])]);
 expect(put(world,wire('parallel',[-3,1,-1],[1,1,3]))).toBe(true);
});
it('includes wider collars and bends in collision, not just the tube centerlines',()=>{
 const world=new World();world.load([],null,[{...wire('n',[0,1,0],[8,1,0]),kind:'neon',color:'cyan'}]);
 expect(put(world,wire('collar',[.07,1.23,-2],[.07,1.23,2]))).toBe(false);
 world.load([],null,[wire('bend',[-3,1,0],[0,1,3],[[0,1,0]])]);
 expect(put(world,wire('corner',[.045,.5,-.045],[.045,1.5,-.045]))).toBe(false);
});
it('allows a wire on another tube without sharing power, and prevents buried ends',()=>{
 const lever:Piece={id:'l',item:'lever',wood:'oak',position:[-5,1.57,0],rotation:[0,0,0],logicOn:true};
 const trunk={...host(),from:{piece:'l',port:'out'}},world=new World();world.load([lever],null,[trunk]);
 expect(put(world,wire('inside',[0,1,0],[0,1,4]))).toBe(false);
 expect(put(world,wire('touch',[0,1.245,0],[0,1.245,4]))).toBe(true);
 const circuit=new Circuit();circuit.configure([lever],world.wires);expect(circuit.wireOn('touch')).toBe(false);
});
it('shares power only through touching end caps, including stacked ends, with no signal across gaps',()=>{
 const lever:Piece={id:'l',item:'lever',wood:'oak',position:[-5,1.57,0],rotation:[0,0,0],logicOn:true};
 const trunk={...host(),from:{piece:'l',port:'out'}},world=new World();world.load([lever],null,[trunk]);
 const cap=wire('cap',[3.93,1.285,0],[3.93,1.285,4]);expect(put(world,cap)).toBe(true);
 const c=new Circuit();c.configure([lever],world.wires);expect(c.wireOn('cap')).toBe(true);
 c.configure([{...lever,logicOn:false}],world.wires);expect(c.wireOn('cap')).toBe(false);
 c.configure([lever],[trunk,wire('gap',[4.02,1,0],[8,1,0])]);expect(c.wireOn('gap')).toBe(false);
 c.configure([lever],[trunk,wire('above',[3.93,1.30,0],[3.93,1.30,4])]);expect(c.wireOn('above')).toBe(false);
 world.load([lever],null,[trunk]);const stacked=wire('stacked',[-4,1.285,0],[4,1.285,0]);expect(put(world,stacked)).toBe(true);
 c.configure([lever],[trunk,stacked]);expect(c.wireOn('stacked')).toBe(true);
});
it('allows a clean bend but rejects backtracking and a route crossing itself',()=>{
 const world=new World();world.load([],null,[]);
 expect(put(world,wire('bend',[-3,1,0],[0,1,3],[[0,1,0]]))).toBe(true);
 world.load([],null,[]);
 expect(put(world,wire('fold',[-3,1,0],[-2,1,0],[[0,1,0]]))).toBe(false);
 expect(put(world,wire('loop',[-3,1,0],[0,1,-2],[[3,1,0],[3,1,2],[0,1,2]]))).toBe(false);
});
it('allows closely spaced forward bends whose rounded joints merge locally',()=>{
 const world=new World();world.load([],null,[]);
 expect(put(world,wire('forward',[-1,1,0],[1,1,0],[[0,1,0],[.03,1,0],[.06,1,0]]))).toBe(true);
 world.load([],null,[]);
 expect(put(world,wire('short-turn',[-1,1,0],[1,1,.1],[[0,1,0],[0,1,.1]]))).toBe(true);
});
for(const kind of ['wire','neon'] as const){
 it(`allows sharp local ${kind} elbows in previews and commits through arbitrary rigid rotations`,()=>{
  for(const degrees of [15,30,45])for(const rotation of elbowRotations){
   const world=new World();world.load([],[12]);const candidate=acuteWire(kind,degrees,4,4,rotation),label=`${kind} ${degrees} degrees ${rotation.toArray()}`;
   expect(world.allowOverlaps).toBe(false);expect(world.wirePlacementIssue(candidate),label).toBeNull();expect(put(world,candidate),label).toBe(true);
   expect(world.wires).toEqual([candidate]);world.undo();expect(world.wires).toEqual([]);world.redo();expect(world.wires).toEqual([candidate]);
  }
 });
 it(`allows ${kind} endpoint collars merging inside a sharp elbow with a short neighboring leg`,()=>{
  const legs=[[.05,4],[4,.05],[.15,4],[4,.15],[.35,4],[4,.35],[.75,4],[4,.75],[.05,.05],[.15,.35],[.35,.15]];
  for(const degrees of [15,30,45])for(const [left,right] of legs)for(const rotation of elbowRotations){
   const world=new World();world.load([],[12]);const candidate=acuteWire(kind,degrees,left,right,rotation),label=`${kind} ${degrees} degrees legs ${left}/${right}`;
   expect(world.wirePlacementIssue(candidate),label).toBeNull();expect(put(world,candidate),label).toBe(true);expect(world.wires).toEqual([candidate]);
  }
 });
 it(`keeps nonlocal ${kind} self crossings and exact backtracking blocked beyond the local elbow allowance`,()=>{
  const crossing:Wire={...wire('crossing',[-4,6,0],[-2,6,-1],[[0,6,0],[-3*Math.cos(Math.PI/6),6,1.5],[0,6,3]]),kind};
  for(const rotation of elbowRotations)for(const raw of [crossing,acuteWire(kind,0,4,2),acuteWire(kind,0,4,.05)]){
   const point=(p:Vec3)=>new Vector3(...p).sub(new Vector3(0,6,0)).applyQuaternion(rotation).add(new Vector3(0,6,0)).toArray() as Vec3;
   const candidate:Wire={...raw,from:{point:point((raw.from as {point:Vec3}).point)},to:{point:point((raw.to as {point:Vec3}).point)},points:raw.points.map(point),frame:rotation.toArray() as [number,number,number,number]},world=new World();world.load([],[12]);
   expect(world.wirePlacementIssue(candidate)).toContain('itself');expect(put(world,candidate)).toBe(false);expect(world.wires).toEqual([]);expect(world.canUndo).toBe(false);
   world.allowOverlaps=true;expect(world.wirePlacementIssue(candidate)).toBeNull();expect(put(world,candidate)).toBe(true);world.undo();expect(world.wires).toEqual([]);
  }
 });
 it(`does not exempt a separate wire intersecting a sharp ${kind} elbow route`,()=>{
  for(const x of [-1,-.1]){
   const world=new World();world.load([],[12],[wire('host',[x,6,-4],[x,6,4])]);const candidate=acuteWire(kind,30);
   expect(world.wirePlacementIssue(candidate)).toContain('other wires');expect(put(world,candidate)).toBe(false);expect(world.wires).toHaveLength(1);expect(world.canUndo).toBe(false);
  }
 });
}
it('snaps diagonal end caps using the new collar shape and preserves electrical contact',()=>{
 for(const degrees of [0,15,30,45,60,75,90]){
  const a=degrees*Math.PI/180,d=new Vector3(Math.cos(a),0,Math.sin(a)),start=d.clone().multiplyScalar(-4).setY(1).toArray() as Vec3,end=d.clone().multiplyScalar(4).setY(1).toArray() as Vec3;
  const source=wire('source',start,end),world=new World();world.load([],null,[source]);
  const center=d.clone().multiplyScalar(3.93).setY(1).toArray() as Vec3,hit=world.wireCollisions.surface('source',new Vector3(0,20,20),center)!;
  const rough=new Vector3(...hit.point).addScaledVector(new Vector3(...hit.normal),.145),path=world.wireCollisions.snapEnds(source,[rough.toArray() as Vec3,rough.clone().addScaledVector(d,3).toArray() as Vec3],hit);
  const addition=wire('added',path[0],path[1]);expect(world.wirePlacementIssue(addition),String(degrees)).toBeNull();
  // Test the contact topology without needing a source socket on this fixture.
  expect(wireGroups([source,addition],world.pieces),String(degrees)).toEqual([[0,1]]);
 }
});
it('preserves contacting cap faces through rigid tilts, copies, reload and undo',()=>{
 const lever:Piece={id:'l',item:'lever',wood:'oak',position:[-1,5.57,0],rotation:[0,0,0],logicOn:true};
 const a:Wire={...wire('a',[0,5,0],[3.8637033051562732,6.035276180410083,0]),from:{piece:'l',port:'out'}};
 const b=wire('b',[3.72232506946182,6.29244770774529,0],[6.620102548329025,7.068904843052852,0]),world=new World(),c=new Circuit();world.load([lever],null,[a,b]);
 c.configure([lever],world.wires);expect(c.wireOn('b')).toBe(true);
 const turned={...lever,rotation:[1,0,0] as Vec3};expect(world.execute([{before:lever,after:turned}])).toBe(true);
 c.configure([...world.pieces.values()],world.wires);expect(c.wireOn('b')).toBe(true);
 const copy={...turned,id:'copy',position:[-1,15.57,0] as Vec3,rotation:[0,1,1] as Vec3},wires=world.copyWires([turned],[copy]);
 expect(wires).toHaveLength(2);expect(validateWires(wires,[copy])).toEqual(wires);
 c.configure([copy],wires);expect(wires.every(w=>c.wireOn(w.id))).toBe(true);
 const original=structuredClone(world.wires);world.undo();expect(world.wires).toEqual([a,b]);world.redo();expect(world.wires).toEqual(original);
 expect(()=>validateWires([{...b,frame:[0,0,0,0]}],[])).toThrow('orientation');
});
it('keeps sloped connections in physical contact with curved end caps',()=>{
 for(const height of [.145,.4,1])for(const endY of [.145,2]){
  const source=wire('source',[-4,height,0],[4,height,0]),world=new World();world.load([],null,[source]);
  const hit=world.wireCollisions.surface('source',new Vector3(0,20,20),[3.93,height,0])!,rough=new Vector3(...hit.point).addScaledVector(new Vector3(...hit.normal),.145).toArray() as Vec3;
  const path=world.wireCollisions.snapEnds(source,[rough,[3.93,endY,4]],hit),addition=wire('added',path[0],path[1]);
  expect(world.wirePlacementIssue(addition)).toBeNull();expect(wireGroups([source,addition],world.pieces)).toEqual([[0,1]]);
 }
});
it('allows separate leads at one socket but rejects coincident runs beyond the connector',()=>{
 const lever:Piece={id:'l',item:'lever',wood:'oak',position:[-1,1.57,0],rotation:[0,0,0]};
 const a={...wire('a',[0,1,0],[4,1,0]),from:{piece:'l',port:'out'}},world=new World();world.load([lever],null,[a]);
 expect(put(world,{...wire('b',[0,1,0],[0,1,4]),from:a.from})).toBe(true);
 expect(put(world,{...a,id:'duplicate'})).toBe(false);
});
it('rejects moving or copying a wired assembly through another wire atomically',()=>{
 const lever:Piece={id:'l',item:'lever',wood:'oak',position:[-5,1.57,2],rotation:[0,0,0]};
 const attached={...wire('attached',[-4,1,2],[4,1,2]),from:{piece:'l',port:'out'}},world=new World();world.load([lever],null,[host(),attached]);
 const moved={...lever,position:[-5,1.57,0] as Vec3};
 expect(world.execute([{before:lever,after:moved}])).toBe(false);
 const copy={...moved,id:'copy'};expect(world.execute([{before:null,after:copy}],[...world.wires,...world.copyWires([lever],[copy])])).toBe(false);
 expect(world.pieces.size).toBe(1);expect(world.pieces.get('l')).toEqual(lever);expect(world.wires).toEqual([host(),attached]);expect(world.canUndo).toBe(false);
});
it('validates replacement routes with existing IDs, and preserves older crossings on load and power changes',()=>{
 const lever:Piece={id:'l',item:'lever',wood:'oak',position:[-5,1.57,0],rotation:[0,0,0]};
 const cross=wire('cross',[0,1,-4],[0,1,4]),world=new World();world.load([lever],null,[host(),cross]);
 expect(world.execute([{before:lever,after:{...lever,logicOn:true}}])).toBe(true);
 world.load([],null,[host(),wire('other',[0,2,-4],[0,2,4])]);
 expect(world.execute([],[host(),{...cross,id:'other'}])).toBe(false);
 expect(world.wires[1].from).toEqual({point:[0,2,-4]});
});
