import { expect, it } from 'vitest';
import { CATALOG } from '../src/catalog';
import { geometryFor } from '../src/geometry';
import { World, pieceBounds, type Piece } from '../src/world';
import { parseProject } from '../src/project';
import { Vector3 } from 'three';

it('includes the five reference glass items with 0.2-stud panels',()=>{
  const glass=CATALOG.filter(p=>p.category==='Glass');
  expect(glass.map(p=>[p.name,p.size])).toEqual([
    ['Tiny Glass Pane',[1,1,.2]],['Small Glass Pane',[2,2,.2]],
    ['Glass Pane',[4,4,.2]],['Large Glass Pane',[8,8,.2]],['Glass Door',[4,8,.2]],
  ]);
});
it('keeps glass frameless and includes the door knob in movement bounds',()=>{
  const pane=geometryFor('large-glass-pane');
  expect(pane.getAttribute('position').count).toBe(36);
  expect(pane.boundingBox!.getSize(new Vector3()).toArray()).toEqual([8,8,expect.closeTo(.2,5)]);
  const door:Piece={id:'d',item:'glass-door',wood:'oak',position:[0,4,0],rotation:[0,0,0]};
  const geometry=geometryFor(door.item),bounds=pieceBounds(door);
  expect(geometry.groups.map(g=>g.materialIndex)).toEqual([0,1]);
  expect(bounds.max[2]-bounds.min[2]).toBeCloseTo(.7);
  const world=new World();world.load([door],[12]);
  const near:Piece={id:'p',item:'tiny-glass-pane',wood:'oak',position:[-1.5,4,.3],rotation:[0,0,0]};
  expect(world.placementIssue(near)).toBe('overlap');
  expect(world.placementIssue({...near,position:[1,4,.3]})).toBe(null);
});
it('round-trips glass with existing project records',()=>{
  const pieces:Piece[]=['tiny-glass-pane','glass-door','smooth-wall'].map((item,i)=>({id:String(i),item,wood:'oak',position:[i*6,4,0],rotation:[0,0,0]}));
  expect(parseProject(JSON.stringify({version:1,name:'Glass',pieces,plots:[12]})).pieces).toEqual(pieces);
});
