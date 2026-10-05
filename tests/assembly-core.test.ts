import {describe,it,expect,vi} from 'vitest';
import {PerspectiveCamera,Quaternion,Vector3} from 'three';
import {World,type Piece} from '../src/world';
import {type Wire,wirePath,wireGroups} from '../src/logic-ports';
import {Circuit} from '../src/logic';
import {assemblyBounds,assemblyIssue,copyAssembly,placeAssemblyOnSurface,rotateAssembly,selectedAssembly,selectWiresInRectangle,transformAssembly,type Assembly} from '../src/assembly';

const piece=(id:string,item:string,position:Piece['position']):Piece=>({id,item,position,rotation:[0,0,0],wood:'oak'});
const route=(id:string,from:Wire['from'],to:Wire['to'],points:Wire['points']=[]):Wire=>({id,kind:'wire',from,to,points});
function fixture(){
 const world=new World();world.load([ {...piece('lever','lever',[-5,3.75,0]),logicOn:true},piece('lamp','lamp',[5,4,0]),piece('outside','lamp',[12,4,0]) ],[12],[
  {...route('lead',{piece:'lever',port:'out'},{piece:'lamp',port:'in'},[[0,3.18,0]]),kind:'neon',color:'pink'},
  route('tail',{piece:'lamp',port:'in'},{piece:'outside',port:'in'},[[8,4,3]]),
  route('loose',{point:[-3,3,5]},{point:[3,3,5]}),
 ]);return world;
}
describe('mixed blueprint and wire assemblies',()=>{
 it('includes internal wiring once and detaches explicitly selected external leads',()=>{
  const w=fixture(),a=selectedAssembly(w,[w.pieces.get('lever')!,w.pieces.get('lamp')!],new Set(['lead','tail','loose']));
  expect(a.wires.map(w=>w.id)).toEqual(['lead','tail','loose']);
  expect(a.wires[1].from).toEqual({piece:'lamp',port:'in'});expect(a.wires[1].to).toEqual({point:[12,3.6,.22]});
  a.wires[0].points[0][0]=100;expect(w.wires[0].points[0][0]).toBe(0);
 });
 it('keeps unselected external leads out of a copied circuit group',()=>{
  const w=fixture(),a=selectedAssembly(w,[w.pieces.get('lever')!,w.pieces.get('lamp')!],new Set());
  expect(a.wires.map(w=>w.id)).toEqual(['lead']);
 });
 it('copies socket references onto the copies and powers the copied circuit',()=>{
  const w=fixture(),a=selectedAssembly(w,[w.pieces.get('lever')!,w.pieces.get('lamp')!],new Set(['tail','loose']));
  const copy=copyAssembly(transformAssembly(a,[0,6,0])),items=new Map(copy.pieces.map(p=>[p.id,p]));
  expect(copy.pieces.every(p=>!w.pieces.has(p.id))).toBe(true);expect(new Set(copy.wires.map(w=>w.id)).size).toBe(3);
  for(const wire of copy.wires)for(const end of [wire.from,wire.to])if('piece' in end)expect(items.has(end.piece)).toBe(true);
  expect(copy.wires[0].color).toBe('pink');expect(copy.wires[1].to).toEqual({point:[12,9.6,.22]});
  const circuit=new Circuit();circuit.configure(copy.pieces,copy.wires);expect(circuit.input(copy.pieces.find(p=>p.item==='lamp')!.id)).toBe(true);
 });
 it('rotates and tilts wire-only paths and collars as one rigid assembly',()=>{
  const a:Assembly={pieces:[],wires:[route('a',{point:[-2,6,0]},{point:[2,6,0]}),route('b',{point:[2,6,0]},{point:[2,6,3]})]},original=structuredClone(a),w=new World();
  const beforeGroups=wireGroups(a.wires,w.pieces),center=assemblyBounds(a,w.pieces).center;
  const turn=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2),rotated=rotateAssembly(a,1,w.pieces);
  const expected=new Vector3(...a.wires[0].from['point']).sub(new Vector3(...center)).applyQuaternion(turn).add(new Vector3(...center));
  expect(wirePath(rotated.wires[0],w.pieces)[0]).toEqual(expected.toArray().map(v=>Math.round(v*1e6)/1e6));
  expect(wireGroups(rotated.wires,w.pieces)).toEqual(beforeGroups);expect(rotated.wires[0].frame).toBeDefined();
  let tilted=rotated;for(let i=0;i<4;i++)tilted=rotateAssembly(tilted,0,w.pieces);
  tilted.wires.forEach((wire,i)=>wirePath(wire,w.pieces).forEach((point,j)=>point.forEach((v,k)=>expect(v).toBeCloseTo(wirePath(rotated.wires[i],w.pieces)[j][k],10))));
  expect(a).toEqual(original);
 });
 it('uses wire bounds to position the whole route on a ground or wall surface',()=>{
  const a:Assembly={pieces:[],wires:[route('a',{point:[-2,3,0]},{point:[2,3,0]})]},w=new World();w.plots=[12];
  const ground=placeAssemblyOnSurface(a,[4,0,2],[0,1,0],w.pieces);expect(assemblyBounds(ground,w.pieces).min[1]).toBeCloseTo(0);expect(assemblyIssue(w,ground,true)).toBeNull();
  const wall=placeAssemblyOnSurface(a,[0,5,0],[1,0,0],w.pieces);expect(assemblyBounds(wall,w.pieces).min[0]).toBeCloseTo(0);
 });
 it('positions upright wire ends with valid ground clearance',()=>{
  const a:Assembly={pieces:[],wires:[route('a',{point:[0,1,0]},{point:[0,5,0]})]},w=new World();w.plots=[12];
  const placed=placeAssemblyOnSurface(a,[4,0,2],[0,1,0],w.pieces);
  expect(assemblyIssue(w,placed,true)).toBeNull();expect(wirePath(placed.wires[0],w.pieces)[0][1]).toBeCloseTo(.14);
 });
 it('blocks batch penetration, below-ground movement and inactive land without modifying history',()=>{
  const w=new World();w.load([], [12],[route('a',{point:[-2,.145,0]},{point:[2,.145,0]})]);
  const a=selectedAssembly(w,[],new Set(['a']));expect(assemblyIssue(w,a,true)).toMatch(/through/);
  expect(assemblyIssue(w,transformAssembly(a,[0,-1,0]),false)).toMatch(/above the ground/);
  expect(assemblyIssue(w,transformAssembly(a,[40,1,0]),true)).toMatch(/active plots/);
  expect(assemblyIssue(w,transformAssembly(a,[0,1,0]),true)).toBeNull();expect(w.canUndo).toBe(false);
 });
 it('undoes and redoes a copied mixed assembly in a single history step',()=>{
  const w=fixture(),before=structuredClone(w.wires),pieces=[...w.pieces.values()],a=selectedAssembly(w,pieces.slice(0,2),new Set(['loose'])),copy=copyAssembly(transformAssembly(a,[0,6,0]));
  expect(w.execute(copy.pieces.map(after=>({before:null,after})),[...w.wires,...copy.wires])).toBe(true);
  expect(w.pieces.size).toBe(5);expect(w.wires).toHaveLength(5);w.undo();expect([...w.pieces.values()]).toEqual(pieces);expect(w.wires).toEqual(before);expect(w.canUndo).toBe(false);
  w.redo();expect(w.wires.slice(3)).toEqual(copy.wires);expect([...w.pieces.values()].slice(3)).toEqual(copy.pieces);
 });
 it('permits an oversized imported wire to move rigidly but never grow',()=>{
  const w=new World();w.load([], [12],[route('old',{point:[-12,2,0]},{point:[12,2,0]})]);const a=selectedAssembly(w,[],new Set(['old']));
  expect(assemblyIssue(w,transformAssembly(a,[0,1,0]),false)).toBeNull();expect(assemblyIssue(w,transformAssembly(a,[0,1,0]),true)).toMatch(/20-stud/);
  const stretched=structuredClone(a);stretched.wires[0].to={point:[13,2,0]};expect(assemblyIssue(w,stretched,false)).toMatch(/20-stud/);
 });
 it('keeps older imported ground routes editable without copying their invalid clearance',()=>{
  const w=new World();w.load([], [12],[route('old',{point:[-2,.05,0]},{point:[2,.05,0]})]);const a=selectedAssembly(w,[],new Set(['old']));
  expect(assemblyIssue(w,transformAssembly(a,[1,0,0]),false)).toBeNull();
  expect(assemblyIssue(w,transformAssembly(a,[0,0,2]),true)).toMatch(/above the ground/);
 });
 it('preserves exact-limit diagonal wire lengths under rigid moves and rotations',()=>{
  for(const limit of [20,16]){
   const w=new World(),wire:Wire={...route('max',{point:[-limit/2,4,0]},{point:[Math.sqrt(limit*limit-1)-limit/2,4,1]}),...(limit===16?{kind:'neon' as const,color:'pink' as const}:{})};
   w.load([], [12],[wire]);const a=selectedAssembly(w,[],new Set(['max'])),moved=transformAssembly(a,[0,1,0]);
   expect(assemblyIssue(w,moved,false)).toBeNull();expect(assemblyIssue(w,moved,true)).toBeNull();
   expect(assemblyIssue(w,rotateAssembly(moved,1,w.pieces),false)).toBeNull();
   expect(w.execute([],moved.wires)).toBe(true);w.undo();expect(w.wires).toEqual([wire]);
  }
 });
 it('does not enumerate unrelated world pieces for wire bounds, placement or validation',()=>{
  const w=fixture(),a=selectedAssembly(w,[],new Set(['loose']));
  const iteration=vi.spyOn(w.pieces,Symbol.iterator).mockImplementation(()=>{throw new Error('Full scene enumeration');});
  try{
   expect(()=>assemblyBounds(a,w.pieces)).not.toThrow();
   expect(()=>placeAssemblyOnSurface(a,[0,0,0],[0,1,0],w.pieces)).not.toThrow();
   expect(assemblyIssue(w,transformAssembly(a,[0,1,0]),true)).toBeNull();
  }finally{iteration.mockRestore();}
 });
});
describe('wire drag-box selection',()=>{
 const viewport={left:0,top:0,width:600,height:600};
 const camera=()=>{const c=new PerspectiveCamera(50,1,.1,200);c.position.set(0,30,0);c.up.set(0,0,-1);c.lookAt(0,0,0);c.updateMatrixWorld();return c;};
 const screen=(c:PerspectiveCamera,p:number[])=>{const v=new Vector3(...p).project(c);return [(v.x+1)*300,(1-v.y)*300];};
 it('selects crossing segments whose ends are outside the rectangle',()=>{
  const w=new World();w.load([],null,[route('cross',{point:[-8,1,0]},{point:[8,1,0]})]);const c=camera();
  expect(selectWiresInRectangle(w,c,viewport,screen(c,[-1,1,-1]),screen(c,[1,1,1]),100)).toEqual(['cross']);
 });
 it('does not select empty space inside a bent wire bounding box',()=>{
  const w=new World();w.load([],null,[route('L',{point:[-6,1,-6]},{point:[6,1,6]},[[-6,1,6]])]);const c=camera();
  expect(selectWiresInRectangle(w,c,viewport,screen(c,[-1,1,-1]),screen(c,[1,1,1]),100)).toEqual([]);
 });
 it('excludes behind-camera and far wires and handles reverse drags',()=>{
  const w=new World();w.load([],null,[route('near',{point:[-2,1,0]},{point:[2,1,0]}),route('far',{point:[-2,-40,0]},{point:[2,-40,0]}),route('behind',{point:[-2,35,0]},{point:[2,35,0]})]);const c=camera();
  expect(selectWiresInRectangle(w,c,viewport,[400,400],[200,200],40)).toEqual(['near']);
 });
});
