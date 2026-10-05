import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {createDemo,createDemoWires} from '../src/demo';
import {World} from '../src/world';
import {ITEMS,WOOD_MAP} from '../src/catalog';
import {expandedPlanes,placementSolids,verticalRange} from '../src/collision';
import {WalkPhysics} from '../src/walk';
import {Circuit} from '../src/logic';
import {wirePath} from '../src/logic-ports';
import {wireRouteIssue} from '../src/wire-design';
describe('starter workshop',()=>{
 it('uses valid editable catalog pieces with no intersections and fits the center plot',()=>{
  const pieces=createDemo(),world=new World();world.plots=[12];
  expect(new Set(pieces.map(p=>p.id)).size).toBe(pieces.length);
  for(const p of pieces){expect(ITEMS.has(p.item)).toBe(true);expect(WOOD_MAP.has(p.wood)).toBe(true);expect(p.position.every(Number.isFinite)).toBe(true);}
  expect(world.placementBatchIssue(pieces)).toBeNull();
 });
 it('has continuous, symmetric gable slopes with matching eaves and no roof gaps',()=>{
  const roof=createDemo().filter(p=>p.id.startsWith('starter-roof'));
  expect(roof.length).toBeGreaterThan(30);
  for(const x of [-13.9,-11.9,-8.1,-7.9,-4.1,-3.9,-.1,.1,3.9,4.1,7.9,8.1,11.9,13.9]){
   const heights=roof.flatMap(p=>placementSolids(p)).map(s=>verticalRange(expandedPlanes(s,[0,0,0]),x,.5)?.max).filter((v):v is number=>v!==undefined);
   expect(Math.max(...heights)).toBeCloseTo(17-Math.abs(x)/2,5);
  }
 });
 it('walks from the approach up the stairs, across the porch and through the entrance',()=>{
  const world=new World();world.load(createDemo(),[12]);const walker=new WalkPhysics(world);
  expect(walker.spawn(new Vector3(0,0,19))).toBe(true);
  for(let i=0;i<180;i++)walker.update(1/120,new Vector3(0,0,-1));
  expect(walker.position.z).toBeLessThan(-3);expect(walker.position.y).toBeCloseTo(2);expect(walker.canOccupy(walker.position)).toBe(true);
 });
 it('contains a valid, working workbench circuit that switches the worklight',()=>{
  const world=new World(),pieces=createDemo(),wires=createDemoWires(pieces);world.load(pieces,[12],wires);
  expect(wires).toHaveLength(1);for(const wire of wires){expect(wireRouteIssue(wirePath(wire,world.pieces),wire,[12])).toBeNull();expect(world.wireCollisions.issue(wire,world.pieces)).toBeNull();}
  const circuit=new Circuit();circuit.configure(pieces,wires);expect(circuit.input('starter-worklight')).toBe(true);
  const lever=pieces.find(p=>p.id==='starter-switch')!;lever.logicOn=false;circuit.configure(pieces,wires);expect(circuit.input('starter-worklight')).toBe(false);
 });
});
