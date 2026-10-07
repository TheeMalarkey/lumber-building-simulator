import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {doorTransform,isDoor,doorProgress} from '../src/door-design';
import {World,pieceBounds,type Piece} from '../src/world';
import {DoorMotion} from '../src/door-motion';
import {Circuit} from '../src/logic';
import {WalkPhysics} from '../src/walk';
import {portPosition} from '../src/logic-ports';
import {parseProject} from '../src/project';
import {ITEMS} from '../src/catalog';

describe('hinged structures',()=>{
 const hatch:Piece={id:'h',item:'hatch',wood:'oak',position:[0,.5,0],rotation:[0,0,0]};
 function step(world:World,motion:DoorMotion,circuit:Circuit){circuit.configure([...world.pieces.values()],world.wires);for(let i=0;i<40;i++)motion.tick(.025,circuit);}
 it('lifts the hatch upwards around a stationary front hinge',()=>{
  expect(ITEMS.get('hatch')?.size).toEqual([4,1,4]);
  const hinge=new Vector3(0,-.4,1.5),tip=new Vector3(0,-.4,-2);
  for(const progress of [.25,.5,1]){
   const matrix=doorTransform('hatch',progress);
   expect(hinge.clone().applyMatrix4(matrix).distanceTo(hinge)).toBeLessThan(1e-9);
   expect(tip.clone().applyMatrix4(matrix).y).toBeGreaterThan(-.4);
  }
  expect(tip.applyMatrix4(doorTransform('hatch',1)).y).toBeCloseTo(3.1);
 });
 it('animates the plate upwards, leaves the socket fixed, and rests without motion work',()=>{
  const world=new World();world.load([{...hatch,doorOpen:true}],[12]);const circuit=new Circuit(),motion=new DoorMotion(world);
  const socket=portPosition(world.pieces.get('h')!,'in');
  step(world,motion,circuit);const p=world.pieces.get('h')!;
  expect(doorProgress(p)).toBe(1);expect(pieceBounds(p).max[1]).toBeCloseTo(3.6);
  expect(portPosition(p,'in')).toEqual(socket);expect(motion.tick(.025,circuit).size).toBe(0);
  world.execute([{before:p,after:{...p,doorOpen:false}}]);step(world,motion,circuit);expect(doorProgress(world.pieces.get('h')!)).toBe(0);
  world.undo();step(world,motion,circuit);expect(doorProgress(world.pieces.get('h')!)).toBe(1);
 });
 it('stops a hatch at an obstruction and resumes after the obstruction is removed',()=>{
  const world=new World();world.load([{...hatch,doorOpen:true},{id:'block',item:'tiny-floor',wood:'oak',position:[0,2,-1],rotation:[0,0,0]}],[12]);
  const circuit=new Circuit(),motion=new DoorMotion(world);step(world,motion,circuit);
  expect(motion.blocked.has('h')).toBe(true);expect(doorProgress(world.pieces.get('h')!)).toBeLessThan(1);
  world.execute([{before:world.pieces.get('block')!,after:null}]);step(world,motion,circuit);expect(doorProgress(world.pieces.get('h')!)).toBe(1);
 });
 it('opens from a wired signal and closes when that signal switches off',()=>{
  const world=new World();world.load([hatch,{id:'lever',item:'lever',position:[-5,.75,4],rotation:[0,0,0],wood:'oak',logicOn:true}],[12],[{id:'w',kind:'wire',from:{piece:'lever',port:'out'},to:{piece:'h',port:'in'},points:[]}]);
  const circuit=new Circuit(),motion=new DoorMotion(world);step(world,motion,circuit);expect(doorProgress(world.pieces.get('h')!)).toBe(1);
  const lever=world.pieces.get('lever')!;world.execute([{before:lever,after:{...lever,logicOn:false}}]);step(world,motion,circuit);expect(doorProgress(world.pieces.get('h')!)).toBe(0);
 });
 it('moves door collision out of the opening for a walking character',()=>{
  const world=new World();world.load([{id:'door',item:'basic-door',wood:'oak',position:[0,4,0],rotation:[0,0,0]}],[12]);
  const walker=new WalkPhysics(world),position=new Vector3(0,0,0);expect(walker.canOccupy(position)).toBe(false);
  const p=world.pieces.get('door')!;world.execute([{before:p,after:{...p,doorOpen:true}}]);step(world,new DoorMotion(world),new Circuit());
  expect(doorProgress(world.pieces.get('door')!)).toBe(1);expect(walker.canOccupy(position)).toBe(true);
 });
 it('resumes after a walking character moves out of its sweep',()=>{
  const world=new World();world.load([{id:'door',item:'basic-door',wood:'oak',position:[0,4,0],rotation:[0,0,0],doorOpen:true}],[12]);
  const walker=new WalkPhysics(world),circuit=new Circuit(),motion=new DoorMotion(world);walker.position.set(0,0,2);circuit.configure([...world.pieces.values()],[]);
  for(let i=0;i<40;i++)motion.tick(.025,circuit,()=>walker.canOccupy(walker.position));
  expect(motion.blocked.has('door')).toBe(true);expect(doorProgress(world.pieces.get('door')!)).toBeLessThan(1);
  walker.position.set(-10,0,0);for(let i=0;i<40;i++)motion.tick(.025,circuit,()=>walker.canOccupy(walker.position));
  expect(doorProgress(world.pieces.get('door')!)).toBe(1);
 });
 it('keeps the closed placement land owned while a door stands open',()=>{
  const world=new World();world.load([{id:'door',item:'basic-door',wood:'oak',position:[-20.8,4,0],rotation:[0,0,0],doorOpen:true}],[11,12]);
  step(world,new DoorMotion(world),new Circuit());expect(doorProgress(world.pieces.get('door')!)).toBe(1);
  expect(world.togglePlot(11)).toBe('occupied');
  expect(()=>parseProject(JSON.stringify({version:1,name:'Door land',plots:world.plots,pieces:[...world.pieces.values()]}))).not.toThrow();
 });
 it('does not pull an attached wire through an unrelated wire while opening',()=>{
  const world=new World();world.load([{id:'door',item:'basic-door',wood:'oak',position:[0,4,0],rotation:[0,0,0]},{id:'lever',item:'lever',wood:'oak',position:[-6,3.57,.51],rotation:[0,0,0],logicOn:true}],[12],[
   {id:'lead',kind:'wire',from:{piece:'lever',port:'out'},to:{piece:'door',port:'in'},points:[]},
   {id:'crossing',kind:'wire',from:{point:[0,3,1]},to:{point:[0,3,3]},points:[]},
  ]);
  expect(world.wirePlacementIssue(world.wires[0])).toBeNull();const motion=new DoorMotion(world);step(world,motion,new Circuit());
  expect(motion.blocked.has('door')).toBe(true);expect(world.wirePlacementIssue(world.wires[0])).toBeNull();
 });
 it('preserves the opening state in editable projects and rejects invalid state',()=>{
  const raw={version:1,name:'Door',plots:[12],pieces:[{id:'d',item:'basic-door',wood:'oak',position:[0,4,0],rotation:[0,0,0],doorOpen:true}]};
  expect(parseProject(JSON.stringify(raw)).pieces[0].doorOpen).toBe(true);
  expect(()=>parseProject(JSON.stringify({...raw,pieces:[{...raw.pieces[0],doorOpen:'yes'}]}))).toThrow();
  expect(isDoor('smooth-wall')).toBe(false);
 });
 it('respects the ground for an inverted mount and finds an open leaf across a spatial cell',()=>{
  const world=new World();world.load([{...hatch,rotation:[2,0,0],doorOpen:true}],null);
  const motion=new DoorMotion(world);step(world,motion,new Circuit());expect(motion.blocked.has('h')).toBe(true);expect(pieceBounds(world.pieces.get('h')!).min[1]).toBeGreaterThanOrEqual(-1e-8);
  world.load([{id:'door',item:'basic-door',wood:'oak',position:[0,4,63],rotation:[0,0,0],doorOpen:true}],null);
  step(world,motion,new Circuit());expect(doorProgress(world.pieces.get('door')!)).toBe(1);
  expect(world.query([2,4,66],.1).map(p=>p.id)).toContain('door');
 });
});
