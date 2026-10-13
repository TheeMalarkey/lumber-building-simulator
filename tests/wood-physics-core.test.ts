import {describe,it,expect} from 'vitest';
import {MeshStandardMaterial} from 'three';
import {Transport} from '../src/transport';
import {TransportView} from '../src/transport-view';
import {World,type Piece} from '../src/world';
import {Circuit} from '../src/logic';
import {parseProject} from '../src/project';
const plank=(id='wood',position:Piece['position']=[0,.5,0]):Piece=>({id,item:'loose-plank',wood:'oak',position,rotation:[0,0,0]});
const run=(t:Transport,time:number)=>{const c=new Circuit();for(let i=0;i<time*120;i++)t.step(1/120,c);};
const view=(w:World)=>new TransportView(w,new Map([['oak',new MeshStandardMaterial()]]));

describe('loose wood physics',()=>{
 it('pulls the grabbed point to fractional coordinates, then falls on release',()=>{
  const w=new World();w.load([plank()],[12]);const t=new Transport(w);t.start();
  expect(t.grab('wood',[0,.5,0])).toBe(true);t.moveGrab([2.37,4.23,1.61]);run(t,2);
  const b=t.bodies.get('wood')!;expect(b.position.x).toBeCloseTo(2.37,1);expect(b.position.y).toBeCloseTo(4.23,1);expect(b.position.z).toBeCloseTo(1.61,1);
  t.releaseGrab();expect(t.physics.constraints).toHaveLength(0);run(t,3);expect(b.position.y).toBeCloseTo(.5,1);t.stop();
 });
 it('keeps solid collision while a drag target moves through a wall',()=>{
  const w=new World();w.load([plank(),{id:'wall',item:'smooth-wall',wood:'oak',position:[3,4,0],rotation:[0,1,0]}],[12]);const t=new Transport(w);t.start();
  t.grab('wood',[0,.5,0]);t.moveGrab([12,.5,0]);run(t,2);
  expect(t.bodies.get('wood')!.position.x).toBeLessThan(2);expect(t.bodies.get('wood')!.position.y).toBeGreaterThan(.35);t.stop();
 });
 it('releases a removed grabbed body and can add new wood without resetting existing motion',()=>{
  const w=new World();w.load([plank()],[12]);const t=new Transport(w);t.start();t.grab('wood',[0,.5,0]);t.moveGrab([2.3,4,0]);run(t,1);
  const p=t.bodies.get('wood')!.position.clone();w.execute([{before:null,after:plank('other',[10,3,0])}]);run(t,.01);
  expect(t.bodies.get('other')).toBeDefined();expect(t.bodies.get('wood')!.position.distanceTo(p)).toBeLessThan(.1);
  w.execute([{before:w.pieces.get('wood')!,after:null}]);run(t,.01);expect(t.grabbedId).toBeNull();expect(t.physics.constraints).toHaveLength(0);t.stop();
 });
 it('starts automatically and keeps current wood when building or land changes',()=>{
  const w=new World();w.load([plank('wood',[0,5,0])],[12]);const v=view(w),c=new Circuit();for(let i=0;i<240;i++)v.update(1/120,c);
  const b=v.simulation.bodies.get('wood')!;expect(b.position.y).toBeCloseTo(.5,1);
  w.execute([{before:null,after:{id:'wall',item:'smooth-wall',wood:'oak',position:[10,4,0],rotation:[0,0,0]}}]);w.togglePlot(13);v.update(1/120,c);
  expect(v.simulation.running).toBe(true);expect(v.simulation.bodies.get('wood')).toBe(b);expect(b.position.y).toBeCloseTo(.5,1);v.stop();
 });
 it('records one undoable free drag and preserves fractional poses in project files',()=>{
  const w=new World();w.load([plank()],[12]);const v=view(w),c=new Circuit();v.update(0,c);v.beginGrab('wood',[0,.5,0]);v.simulation.moveGrab([2.37,4.23,1.61]);for(let i=0;i<240;i++)v.update(1/120,c);v.endGrab();
  const pos=[...w.pieces.get('wood')!.position];expect(pos[0]).toBeCloseTo(2.37,1);expect(w.canUndo).toBe(true);
  w.undo();v.paused=true;v.update(0,c);expect(v.simulation.bodies.get('wood')!.position.x).toBe(0);expect(w.canUndo).toBe(false);
  w.redo();v.update(0,c);expect(v.simulation.bodies.get('wood')!.position.x).toBeCloseTo(pos[0],5);
  const saved=parseProject(JSON.stringify({version:1,name:'wood',plots:[12],pieces:[{...plank(),position:[35.37,.4,1.61],rotation:[.125,.25,.375]}]}));
  expect(saved.pieces[0].position).toEqual([35.37,.4,1.61]);expect(saved.pieces[0].rotation).toEqual([.125,.25,.375]);v.stop();
 });
});
