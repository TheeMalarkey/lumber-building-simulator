import {expect,it} from 'vitest';
import {CATALOG} from '../src/catalog';
import {World,type Piece} from '../src/world';
import {parseProject} from '../src/project';
import {FixtureLighting} from '../src/fixture-lighting';
import {Vector3,Mesh,MeshBasicMaterial,Raycaster,DoubleSide} from 'three';
import {geometryFor} from '../src/geometry';
it('keeps the pale Worklight reflector visible in front of the yellow housing',()=>{
 const material=new MeshBasicMaterial({side:DoubleSide});
 const mesh=new Mesh(geometryFor('worklight'),Array.from({length:8},()=>material));mesh.updateMatrixWorld();
 const hit=new Raycaster(new Vector3(.5,.5,3),new Vector3(0,0,-1)).intersectObject(mesh)[0];
 expect(hit).toBeDefined();expect(hit.face!.materialIndex).not.toBe(4);
 material.dispose();
});
it('includes all five fixed-finish lighting fixtures',()=>{
 expect(CATALOG.filter(c=>c.category==='Lighting').map(c=>c.id)).toEqual(['wall-light','floodlight','lamp','floor-lamp','worklight']);
});
it('keeps a bounded light pool, follows rotations and origin shifts, and indexes undo/deletion',()=>{
 const w=new World(),manager=new FixtureLighting();
 const p:Piece={id:'directional',item:'worklight',wood:'oak',position:[64,3,0],rotation:[0,1,0]};
 w.load([p,...Array.from({length:30},(_,i)=>({...p,id:'lamp'+i,item:'lamp',position:[64+i/10,3,2] as [number,number,number]}))],null);
 manager.update(w,new Vector3(64,3,0),new Vector3(64,0,0),0,'balanced');
 expect(manager.points).toHaveLength(2);expect(manager.spots).toHaveLength(4);expect(manager.activeIds).toHaveLength(3);
 const spot=manager.spots[0];expect(spot.target.position.x-spot.position.x).toBeGreaterThan(.9);
 expect(Math.abs(spot.position.x)).toBeLessThan(1);
 w.execute([{before:p,after:{...p,lightOn:false}}]);manager.update(w,new Vector3(64,3,0),new Vector3(64,0,0),1,'balanced');
 expect(spot.intensity).toBe(0);w.undo();manager.update(w,new Vector3(64,3,0),new Vector3(64,0,0),2,'balanced');expect(spot.intensity).toBeGreaterThan(0);
 w.load([],null);expect(w.lightChunks.size).toBe(0);
 manager.update(w,new Vector3(),new Vector3(),3,'balanced');expect(manager.activeIds).toEqual([]);
});
it('saves light state and rejects malformed states without changing older records',()=>{
 const p:Piece={id:'l',item:'lamp',wood:'oak',position:[0,3,0],rotation:[0,0,0],lightOn:false};
 const data={version:1,name:'Lights',pieces:[p],plots:[12]};
 expect(parseProject(JSON.stringify(data)).pieces[0]).toEqual(p);
 expect(()=>parseProject(JSON.stringify({...data,pieces:[{...p,lightOn:'false'}]}))).toThrow();
 const w=new World();w.load([p],[12]);w.execute([{before:p,after:{...p,lightOn:true}}]);w.undo();
 expect(w.pieces.get('l')!.lightOn).toBe(false);
});
