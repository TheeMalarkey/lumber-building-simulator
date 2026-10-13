import {describe,it,expect} from 'vitest';
import {Transport} from '../src/transport';
import {World,type Piece} from '../src/world';
import {Circuit} from '../src/logic';
import {setDoorProgress} from '../src/door-design';
const piece=(id:string,item:string,position:Piece['position']):Piece=>({id,item,position,rotation:[0,0,0],wood:'oak'});
const run=(t:Transport,seconds:number)=>{for(let i=0;i<seconds*120;i++)t.step(1/120,new Circuit());};
describe('plank transport',()=>{
 it('refreshes collision when a hatch opens without replacing its piece record',()=>{
  const w=new World();w.load([piece('hatch','hatch',[0,2,0]),piece('wood','loose-plank',[0,3,0])],[12]);const t=new Transport(w);t.start();run(t,2);expect(t.bodies.get('wood')!.position.y).toBeGreaterThan(2);setDoorProgress(w.pieces.get('hatch')!,1);run(t,3);expect(t.bodies.get('wood')!.position.y).toBeLessThan(1);t.stop();
 });
 it('reverses manually and follows a rotated conveyor direction',()=>{
  const w=new World(),belt={...piece('a','straight-conveyor',[0,.5,0]),rotation:[0,1,0] as Piece['rotation'],logicOn:true};w.load([belt,{...piece('wood','loose-plank',[0,1.5,0]),rotation:[0,1,0]}],[12]);const t=new Transport(w);t.start();run(t,.7);expect(t.bodies.get('wood')!.position.z).toBeGreaterThan(1);t.stop();
 });
 it('uses the wire input to reverse rather than the manual setting',()=>{
  const w=new World(),belt=piece('a','straight-conveyor',[0,.5,0]),lever={...piece('lever','lever',[8,1,0]),logicOn:true};w.load([belt,lever,piece('wood','loose-plank',[0,1.5,0])],[12]);const circuit=new Circuit();circuit.configure([...w.pieces.values()],[{id:'wire',from:{piece:'lever',port:'out'},to:{piece:'a',port:'in'},points:[]}]);const t=new Transport(w);t.start();for(let i=0;i<84;i++)t.step(1/120,circuit);expect(t.bodies.get('wood')!.position.x).toBeLessThan(-1);t.stop();
 });
 it('falls and rests on the plot without changing the authored pieces',()=>{
  const w=new World(),p=piece('wood','loose-plank',[0,5,0]);w.load([p],[12]);const t=new Transport(w);t.start();run(t,3);
  expect(t.bodies.get('wood')!.position.y).toBeCloseTo(.5,1);expect(w.pieces.get('wood')!.position).toEqual([0,5,0]);t.stop();expect(t.bodies.size).toBe(0);
 });
 it('carries a plank across a flush module seam',()=>{
  const w=new World();w.load([piece('a','straight-conveyor',[0,.5,0]),piece('b','straight-conveyor',[4,.5,0]),piece('wood','loose-plank',[0,1.5,0])],[12]);const t=new Transport(w);t.start();run(t,1.3);
  expect(t.bodies.get('wood')!.position.x).toBeGreaterThan(3);expect(t.bodies.get('wood')!.position.y).toBeGreaterThan(1);t.stop();
 });
 it('does not pull airborne planks along the conveyor',()=>{
  const w=new World();w.load([piece('a','straight-conveyor',[0,.5,0]),piece('wood','loose-plank',[0,10,0])],[12]);const t=new Transport(w);t.start();run(t,.1);expect(t.bodies.get('wood')!.position.x).toBeCloseTo(0,5);t.stop();
 });
 it('stacks planks',()=>{
  const w=new World();w.load([piece('a','loose-plank',[0,.5,0]),piece('b','loose-plank',[0,3,0])],[12]);const t=new Transport(w);t.start();run(t,3);expect(t.bodies.get('b')!.position.y).toBeCloseTo(1.5,1);t.stop();
 });
 it('lets wood fall off the end instead of attaching it to the conveyor',()=>{
  const w=new World();w.load([piece('belt','straight-conveyor',[0,3,0]),piece('wood','loose-plank',[0,4,0])],[12]);const t=new Transport(w);t.start();run(t,4);expect(t.bodies.get('wood')!.position.x).toBeGreaterThan(5);expect(t.bodies.get('wood')!.position.y).toBeLessThan(2);t.stop();
 });
 it('does not drive a plank resting on the rail instead of the rollers',()=>{
  const w=new World();w.load([piece('belt','straight-conveyor',[0,.5,0]),piece('wood','loose-plank',[0,1.9,3.65])],[12]);const t=new Transport(w);t.start();run(t,1);expect(Math.abs(t.bodies.get('wood')!.position.x)).toBeLessThan(.05);t.stop();
 });
});
