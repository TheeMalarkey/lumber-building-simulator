import { expect, it } from 'vitest';
import { CATALOG, ITEMS } from '../src/catalog';
import { geometryFor } from '../src/geometry';
import { World, type Piece } from '../src/world';
import { parseProject } from '../src/project';

const ids=['armchair','loveseat','couch','single-bed','twin-bed','toilet','refrigerator','stove','dishwasher'];
it('includes all nine non-light store furnishings with independent fixed finishes',()=>{
  expect(CATALOG.filter(p=>p.category==='Store furniture').map(p=>p.id)).toEqual(ids);
  for(const id of ids) expect(ITEMS.get(id)?.fixedMaterial).toBe('furniture');
});
it('retains space above sofa seats, below beds, and inside the toilet bowl',()=>{
  const world=new World();
  const place=(item:string):Piece=>({id:'f',item,wood:'oak',position:[0,ITEMS.get(item)!.size[1]/2,0],rotation:[0,0,0]});
  const probe:Piece={id:'probe',item:'tiny-glass-pane',wood:'oak',position:[0,3,1],rotation:[0,0,0]};
  world.load([place('couch')],[12]);
  expect(world.placementIssue(probe)).toBe(null);
  expect(world.placementIssue({...probe,position:[0,1.6,1]})).toBe('overlap');
  world.load([place('single-bed')],[12]);
  expect(world.placementIssue({...probe,item:'tiny-tile',position:[0,.2,0]})).toBe(null);
  world.load([place('toilet')],[12]);
  expect(world.placementIssue({...probe,item:'tiny-tile',position:[0,1.65,.55]})).toBe(null);
  expect(world.placementIssue({...probe,item:'tiny-tile',position:[0,1.1,.55]})).toBe('overlap');
});
it('keeps furnishings within finite bounds and saves alongside existing blueprints',()=>{
  const pieces:Piece[]=ids.map((item,i)=>({id:String(i),item,wood:'oak',position:[(i%3-1)*10,5,(Math.floor(i/3)-1)*10],rotation:[0,1,0]}));
  expect(parseProject(JSON.stringify({version:1,name:'Furniture',pieces,plots:[12]})).pieces).toEqual(pieces);
  for(const id of ids){
    const g=geometryFor(id),item=ITEMS.get(id)!;
    expect(g.getAttribute('position').count/3).toBeLessThan(1800);
    for(let axis=0;axis<3;axis++){
      const limit=(item.boundsSize??item.size)[axis]/2;
      expect(g.boundingBox!.min.getComponent(axis)).toBeGreaterThanOrEqual(-limit-.001);
      expect(g.boundingBox!.max.getComponent(axis)).toBeLessThanOrEqual(limit+.001);
    }
  }
});
