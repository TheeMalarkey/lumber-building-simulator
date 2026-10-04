import {it,expect} from 'vitest';
import {Box3,Vector3} from 'three';
import {ITEMS} from '../src/catalog';
import {logicParts} from '../src/logic-geometry';
import {parseProject} from '../src/project';
import {portPosition} from '../src/logic-ports';
import {quaternionRotation} from '../src/placement';
import type {Piece} from '../src/world';
import {pieceBounds,World} from '../src/world';
import {placementSolids,expandedPlanes,insidePlanes,snapBlueprintOnSurface} from '../src/collision';

it.each([
 ['signal-delay',[2,2,2]],['signal-sustain',[2,2,2]],['signal-inverter',[2,1,1]],
] as [string,[number,number,number]][])('%s uses the confirmed stud dimensions in its catalog, mesh and placement bounds',(id,size)=>{
 const item=ITEMS.get(id)!;expect(item.size).toEqual(size);expect(item.dimensionsEstimated).toBe(false);
 for(const timing of [1,12]){
  const bounds=new Box3();
  for(const g of logicParts(item,{active:false,timing})){g.computeBoundingBox();bounds.union(g.boundingBox!);g.dispose();}
  const actual=bounds.getSize(new Vector3()).toArray();
  actual.forEach((v,i)=>expect(v).toBeCloseTo(size[i],2));
 }
 const p:Piece={id:'sized',item:id,position:snapBlueprintOnSurface([0,0,0],[0,1,0],id,[0,0,0]),rotation:[0,0,0],wood:'oak'};
 expect(p.position[1]).toBeCloseTo(size[1]/2,4);
 const bounds=pieceBounds(p);expect(bounds.min[1]).toBeCloseTo(0,4);
 size.forEach((n,i)=>expect(bounds.max[i]-bounds.min[i]).toBeCloseTo(n,2));
});

it('shorter timers preserve old mounting planes, sockets and timing across repeated imports',()=>{
 for(const item of ['signal-delay','signal-sustain'])for(const logicModelVersion of [undefined,2])
 for(const rotation of [[0,0,0],[0,0,1],[1,0,0],[.25,.5,.75]] as [number,number,number][]){
  const old:Piece={id:'timer',item,wood:'oak',position:[0,8,0],rotation,timing:12};
  const bottom=new Vector3(0,-1.25,0).applyEuler(quaternionRotation(rotation)).add(new Vector3(...old.position));
  const sockets=[-1,1].map(x=>new Vector3(x,-1,0).applyEuler(quaternionRotation(rotation)).add(new Vector3(...old.position)));
  const project=parseProject(JSON.stringify({version:1,logicModelVersion,name:'Old timer',plots:[12],pieces:[old]})),p=project.pieces[0];
  expect(project.logicModelVersion).toBe(3);expect(p.timing).toBe(12);
  expect(new Vector3(0,-1,0).applyEuler(quaternionRotation(rotation)).add(new Vector3(...p.position)).distanceTo(bottom)).toBeLessThan(1e-7);
  ['in','out'].forEach((port,i)=>expect(new Vector3(...portPosition(p,port)).distanceTo(sockets[i])).toBeLessThan(1e-7));
  expect(parseProject(JSON.stringify(project))).toEqual(project);
 }
});

it('inverters fit side by side at one-stud depth without invisible collision padding',()=>{
 const p:Piece={id:'one',item:'signal-inverter',position:[0,.5,0],rotation:[0,0,0],wood:'oak'};
 const w=new World();w.load([p],[12]);
 expect(w.placementIssue({...p,id:'two',position:[0,.5,1]})).toBeNull();
 expect(w.placementIssue({...p,id:'two',position:[0,.5,.9]})).toBe('overlap');
});

it('the lever grip spans the narrow base and travels to opposite ends like the top-down reference',()=>{
 const item=ITEMS.get('lever')!;
 const grips=[false,true].map(active=>{
  const parts=logicParts(item,{active,timing:1});
  const bounds=new Box3();
  for(const p of parts){p.computeBoundingBox();if(p.userData.surface===2)bounds.union(p.boundingBox!);p.dispose();}
  return bounds;
 });
 const [off,on]=grips.map(b=>b.getCenter(new Vector3()));
 expect(off.x).toBeGreaterThan(.5);expect(on.x).toBeLessThan(-.5);
 expect(off.y).toBeCloseTo(on.y);expect(off.z).toBeCloseTo(0);expect(on.z).toBeCloseTo(0);
 for(const g of grips){const size=g.getSize(new Vector3());expect(size.z).toBeGreaterThan(size.x*1.5);}
 expect(item.size[0]/item.size[2]).toBeCloseTo(2);
});

it('upgrading a legacy lever preserves its mounting face and wire socket at every orientation',()=>{
 for(const rotation of [[0,0,0],[0,1,0],[1,0,0],[0,0,1],[.25,.5,.75]] as [number,number,number][]){
  const old:Piece={id:'l',item:'lever',wood:'oak',position:[0,8,0],rotation};
  const bottom=new Vector3(0,-1,0).applyEuler(quaternionRotation(rotation)).add(new Vector3(...old.position));
  const socket=new Vector3(1,-.82,0).applyEuler(quaternionRotation(rotation)).add(new Vector3(...old.position));
  const parsed=parseProject(JSON.stringify({version:1,name:'Legacy',pieces:[old],plots:[12]}));
  const p=parsed.pieces[0];
  const newBottom=new Vector3(0,-ITEMS.get('lever')!.size[1]/2,0).applyEuler(quaternionRotation(rotation)).add(new Vector3(...p.position));
  expect(newBottom.distanceTo(bottom)).toBeLessThan(1e-7);
  expect(new Vector3(...portPosition(p,'out')).distanceTo(socket)).toBeLessThan(1e-7);
  expect(parseProject(JSON.stringify(parsed))).toEqual(parsed);
 }
});

it('lever collision follows the visible grip when its switch state changes',()=>{
 const lever:Piece={id:'l',item:'lever',wood:'oak',position:[0,.75,0],rotation:[0,0,0]};
 const contains=(x:number)=>placementSolids(lever).some(s=>insidePlanes(expandedPlanes(s,[.005,.005,.005]),new Vector3(x,1.1,0)));
 expect(contains(.69)).toBe(true);expect(contains(-.69)).toBe(false);
 lever.logicOn=true;
 expect(contains(.69)).toBe(false);expect(contains(-.69)).toBe(true);
 lever.logicOn=false;
 expect(contains(.69)).toBe(true);expect(contains(-.69)).toBe(false);
});

it('retains valid legacy tilted plot-edge mounts, but still rejects unrelated out-of-plot pieces',()=>{
 const project={version:1,name:'Edge',plots:[12],pieces:[{id:'edge',item:'lever',wood:'oak',position:[19.298876742075816,8,0],rotation:[1,.25,0]}]};
 const result=parseProject(JSON.stringify(project));
 expect(result.pieces[0].legacyLeverBounds).toBe(true);
 expect(parseProject(JSON.stringify(result))).toEqual(result);
 expect(parseProject(JSON.stringify({...result,pieces:result.pieces.map(p=>({...p,logicOn:true}))})).pieces[0].legacyLeverBounds).toBe(true);
 expect(()=>parseProject(JSON.stringify({...project,pieces:project.pieces.map(p=>({...p,position:[30,8,0]}))}))).toThrow(/active plots/);
});

it('current lever land bounds remain identical when a tilted handle switches',()=>{
 const lever:Piece={id:'l',item:'lever',wood:'oak',position:[18,8,0],rotation:[.5,2,.5]};
 expect(pieceBounds(lever)).toEqual(pieceBounds({...lever,logicOn:true}));
 const project={version:1,logicModelVersion:2,name:'Current',plots:[12],pieces:[lever]};
 expect(()=>parseProject(JSON.stringify(project))).not.toThrow();
 expect(()=>parseProject(JSON.stringify({...project,pieces:[{...lever,logicOn:true}]}))).not.toThrow();
 expect(()=>parseProject(JSON.stringify({...project,pieces:[{...lever,position:[19.581806996571125,8,0]}]}))).toThrow(/active plots/);
});

it('tilted lever snapping reserves both poses and contacts the floor without sinking or floating',()=>{
 const world=new World();world.load([],[12]);
 for(const rotation of [[0,0,0],[0,0,1],[0,0,2],[0,0,1.5],[.3,.2,.8]] as [number,number,number][]){
  const p:Piece={id:'l',item:'lever',wood:'oak',rotation,position:snapBlueprintOnSurface([0,0,0],[0,1,0],'lever',rotation)};
  for(const logicOn of [false,true]){
   const switched={...p,logicOn};
   expect(world.placementIssue(switched)).toBeNull();
   const min=pieceBounds(switched).min[1];expect(min).toBeGreaterThanOrEqual(-1e-8);expect(min).toBeLessThan(.00011);
  }
 }
});
