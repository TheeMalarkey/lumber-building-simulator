import {describe,it,expect} from 'vitest';
import {conveyorParts} from '../src/conveyor';
import {ITEMS} from '../src/catalog';
import {portsFor} from '../src/logic-ports';
import {pieceBounds,World,type Piece} from '../src/world';
describe('straight conveyor reference proportions',()=>{
 it('uses a wall-sized footprint, with eight long rollers spanning the eight-stud axis',()=>{
  expect(ITEMS.get('straight-conveyor')!.size[0]).toBe(4);
  expect(ITEMS.get('straight-conveyor')!.size[2]).toBe(8);
  const parts=conveyorParts(),rollers=parts.filter(g=>g.userData.surface===1);
  expect(rollers).toHaveLength(8);
  for(const g of rollers){g.computeBoundingBox();const b=g.boundingBox!;expect(b.max.z-b.min.z).toBeGreaterThan(7);expect(b.max.x-b.min.x).toBeLessThan(.5);}
  for(const g of parts)g.dispose();
 });
 it('centers the small control on the short side rail and places its socket there',()=>{
  const parts=conveyorParts(),control=parts.filter(g=>g.userData.surface===2);
  for(const g of control){g.computeBoundingBox();expect(Math.abs(g.boundingBox!.min.x)).toBeLessThan(.4);expect(Math.abs(g.boundingBox!.max.x)).toBeLessThan(.4);}
  expect(portsFor('straight-conveyor')[0].position[0]).toBe(0);
  expect(portsFor('straight-conveyor')[0].position[2]).toBeGreaterThan(3.8);
  for(const g of parts)g.dispose();
 });
 it('keeps saved bottom placement while including the taller rails in placement bounds',()=>{
  const p:Piece={id:'conveyor',item:'straight-conveyor',wood:'oak',position:[0,.5,0],rotation:[0,0,0]},w=new World();
  const b=pieceBounds(p);
  expect(b.min[1]).toBeCloseTo(0,5);
  expect(b.max[1]).toBeCloseTo(1.4,5);
  expect(b.min[2]).toBeCloseTo(-4,5);expect(b.max[2]).toBeCloseTo(4,5);
  expect(w.placementIssue(p)).toBeNull();
  expect(w.placementIssue({...p,position:[0,.49,0]})).toBe('below-ground');
 });
});
