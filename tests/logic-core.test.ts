import {describe,it,expect} from 'vitest';
import {Circuit} from '../src/logic';
import {type Wire,portPosition} from '../src/logic-ports';
import {type Piece,World} from '../src/world';
import {parseProject} from '../src/project';
import {LogicView} from '../src/logic-view';
import {Vector3,Mesh,MeshBasicMaterial,Raycaster} from 'three';
import {rotateSelection} from '../src/selection';
import {geometryFor,logicGeometryFor} from '../src/geometry';
const node=(id:string,item:string,logicOn=false,timing=1):Piece=>({id,item,wood:'oak',position:[({a:-8,b:0,g:8,d:8,s:8} as Record<string,number>)[id]??0,2,0],rotation:[0,0,0],logicOn,timing});
const wire=(id:string,a:string,ap:string,b:string,bp:string):Wire=>({id,from:{piece:a,port:ap},to:{piece:b,port:bp},points:[]});
for(const [item,table] of Object.entries({'and-gate':[false,false,false,true],'or-gate':[false,true,true,true],'xor-gate':[false,true,true,false],'nand-gate':[true,true,true,false],'nor-gate':[true,false,false,false],'xnor-gate':[true,false,false,true]}))it(item+' truth table',()=>{
 for(let v=0;v<4;v++){
 const c=new Circuit();c.configure([node('a','lever',!!(v&2)),node('b','lever',!!(v&1)),node('g',item)], [wire('a','a','out','g','a'),wire('b','b','out','g','b')]);
 expect(c.output('g')).toBe(table[v]);
 }
});
it('shares bidirectional wires: either driver powers every input',()=>{
 const c=new Circuit();const nodes=[node('a','lever',true),node('b','lever'),node('g','signal-inverter')];
 c.configure(nodes,[wire('1','a','out','g','in'),wire('2','b','out','g','in')]);expect(c.output('g')).toBe(false);expect(c.wireOn('2')).toBe(true);
 c.configure(nodes.map(p=>({...p,logicOn:p.id==='b'})),[wire('1','a','out','g','in'),wire('2','b','out','g','in')]);expect(c.wireOn('1')).toBe(true);
});
it('preserves a button pulse through a delay independent of frame spacing',()=>{
 const c=new Circuit();c.configure([node('b','button'),node('d','signal-delay',false,2)],[wire('1','b','out','d','in')]);c.press('b');
 c.advance(399);expect(c.output('d')).toBe(false);c.advance(1);expect(c.output('d')).toBe(true);c.advance(349);expect(c.output('d')).toBe(true);c.advance(1);expect(c.output('d')).toBe(false);
});
it('sustain holds after release, retriggers and setting 1 passes through',()=>{
 const c=new Circuit();const nodes=[node('b','button'),node('s','signal-sustain',false,3)];const wires=[wire('1','b','out','s','in')];c.configure(nodes,wires);c.press('b');c.advance(700);expect(c.output('s')).toBe(true);c.press('b');c.advance(949);expect(c.output('s')).toBe(true);c.advance(1);expect(c.output('s')).toBe(false);
 c.configure(nodes.map(p=>({...p,timing:1})),wires);c.press('b');c.advance(350);expect(c.output('s')).toBe(false);
});
it('discloses combinational feedback and does no work on idle frames',()=>{
 const c=new Circuit();c.configure([node('g','signal-inverter')],[wire('f','g','out','g','in')]);expect(c.unstable.has('g')).toBe(true);
 const runs=c.solves;c.advance(100);expect(c.solves).toBe(runs);
 c.configure([node('g','signal-inverter')],[]);expect(c.output('g')).toBe(true);expect(c.unstable.size).toBe(0);
});
it('preserves wires in projects and deletes/restores connections atomically',()=>{
 const pieces=[node('a','lever'),node('b','lamp')],wires=[wire('1','a','out','b','in')];
 const parsed=parseProject(JSON.stringify({version:1,name:'Logic',plots:[12],pieces,wires}));expect(parsed.wires).toEqual(wires);
 const w=new World();w.load(pieces,[12],wires);w.execute([{before:pieces[0],after:null}]);expect(w.wires).toHaveLength(0);w.undo();expect(w.wires).toEqual(wires);w.redo();expect(w.wires).toHaveLength(0);
 expect(()=>parseProject(JSON.stringify({...parsed,wires:[wire('1','a','bad-port','b','in')]}))).toThrow();
});
it('settles long acyclic chains without reporting false feedback',()=>{
 const c=new Circuit(),pieces=[node('a','lever',true)],wires:Wire[]=[];
 for(let i=0;i<600;i++){pieces.push({...node('g'+i,'or-gate'),position:[i*4,2,10]});wires.push(wire('w'+i,i?'g'+(i-1):'a','out','g'+i,'a'));}
 c.configure(pieces,wires);expect(c.output('g599')).toBe(true);expect(c.unstable.size).toBe(0);
});
it('copies shared branch junctions without connecting back to originals',()=>{
 const w=new World(),a=node('a','lever'),b=node('b','lamp');const wires:Wire[]=[{id:'1',from:{piece:'a',port:'out'},to:{point:[-4,2,0]},points:[]},{id:'2',from:{point:[-4,2,0]},to:{piece:'b',port:'in'},points:[]}];
 w.load([a,b],[12],wires);const copy=[a,b].map(p=>({...p,id:p.id+'copy',position:[p.position[0],p.position[1]+4,p.position[2]] as [number,number,number]}));
 const result=w.copyWires([a,b],copy);expect(result).toHaveLength(2);expect(result[0].to).toEqual({point:[-4,6,0]});expect(result[1].to).toEqual({piece:'bcopy',port:'in'});
});
it('sustain release never leaks a false pulse into a downstream delay',()=>{
 const c=new Circuit(),pieces=[node('b','button'),node('s','signal-sustain',false,3),{...node('d','signal-delay'),position:[14,2,0] as [number,number,number]}];
 c.configure(pieces,[wire('1','b','out','s','in'),wire('2','s','out','d','in')]);c.press('b');c.advance(549);expect(c.output('d')).toBe(true);c.advance(1);expect(c.output('d')).toBe(true);c.advance(599);expect(c.output('d')).toBe(true);c.advance(1);expect(c.output('d')).toBe(false);
});
it('clears button pulses and queued timer edges on project load, including reused IDs',()=>{
 const w=new World(),view=new LogicView(w),pieces=[node('b','button'),node('d','signal-delay',false,2)],wires=[wire('1','b','out','d','in')];
 w.load(pieces,null,wires);view.tick(1000);view.circuit.press('b');view.tick(1100);expect(view.circuit.output('b')).toBe(true);
 w.load(pieces,null,wires);view.tick(1200);expect(view.circuit.output('b')).toBe(false);
 view.tick(1400);view.tick(1600);expect(view.circuit.output('d')).toBe(false);view.dispose();
});
it('keeps selected internal links when their net also feeds an unselected component',()=>{
 const w=new World(),pieces=[node('a','lever'),node('g','and-gate'),node('b','lamp')];w.load(pieces,null,[wire('1','a','out','g','a'),wire('2','a','out','b','in')]);
 const copies=pieces.slice(0,2).map(p=>({...p,id:p.id+'copy'})),result=w.copyWires(pieces.slice(0,2),copies);
 expect(result).toHaveLength(1);expect(result[0].from).toEqual({piece:'acopy',port:'out'});expect(result[0].to).toEqual({piece:'gcopy',port:'a'});
});
it('moves and turns internal wire bends with a rigid group, undoing routes with pieces',()=>{
 const w=new World(),pieces=[node('a','lever'),node('g','and-gate')],wires=[{...wire('1','a','out','g','a'),points:[[0,2,5] as [number,number,number]]}];w.load(pieces,null,wires);
 const turned=rotateSelection(pieces,1);const after=turned.map(p=>({...p,position:[p.position[0],p.position[1],p.position[2]+20] as [number,number,number]}));
 const expected=new Vector3(0,2,5).sub(new Vector3(...pieces[0].position)).applyAxisAngle(new Vector3(0,1,0),Math.PI/2).add(new Vector3(...after[0].position));
 const copied=w.copyWires(pieces,after.map(p=>({...p,id:p.id+'copy'})));expect(new Vector3(...copied[0].points[0]).distanceTo(expected)).toBeLessThan(1e-6);
 w.execute(pieces.map((p,i)=>({before:p,after:after[i]})));expect(w.wires[0].points).toEqual(copied[0].points);w.undo();expect(w.wires).toEqual(wires);w.redo();expect(w.wires[0].points).toEqual(copied[0].points);
});
it('walk contact powers a plate and releases it after leaving',()=>{
 const w=new World(),view=new LogicView(w);w.load([{...node('p','pressure-plate'),position:[0,.15,0]}]);
 view.tick(1000,new Vector3(0,.3,0));expect(view.circuit.output('p')).toBe(true);
 view.tick(1016,new Vector3(8,.3,0));expect(view.circuit.output('p')).toBe(false);view.dispose();
});
it('timer symbols and blue meters remain in front of their opaque housings',()=>{
 for(const id of ['signal-delay','signal-sustain']){
  const mesh=new Mesh(geometryFor(id),Array.from({length:10},()=>new MeshBasicMaterial()));mesh.updateMatrixWorld();
  expect(new Raycaster(new Vector3(-.4,.1,5),new Vector3(0,0,-1)).intersectObject(mesh)[0].face!.materialIndex).toBe(9);
  expect(new Raycaster(new Vector3(.49,-.212,5),new Vector3(0,0,-1)).intersectObject(mesh)[0].face!.materialIndex).toBe(1);
 }
});
it('reuses compiled wire topology when only switch state changes',()=>{
 const c=new Circuit(),pieces=[node('a','lever'),node('g','signal-inverter')],wires=[wire('1','a','out','g','in')];c.configure(pieces,wires);expect(c.output('g')).toBe(true);
 c.configure(pieces.map(p=>({...p,logicOn:true})),wires);expect(c.output('g')).toBe(false);expect(c.topologyBuilds).toBe(1);
});
it('leaves both body crossings and end-to-body contact electrically separate',()=>{
 const c=new Circuit(),pieces=[node('a','lever',true),node('g','signal-inverter')];
 const horizontal={...wire('1','a','out','g','in'),points:[[-7,2,0],[7,2,0]] as [number,number,number][]};
 const crossing:Wire={id:'cross',from:{point:[0,2,-8]},to:{point:[0,2,8]},points:[]};
 c.configure(pieces,[horizontal,crossing]);expect(c.wireOn('1')).toBe(true);expect(c.wireOn('cross')).toBe(false);
 c.configure(pieces,[horizontal,{...crossing,to:{point:[0,2,0]}}]);expect(c.wireOn('cross')).toBe(false);
});
it('allows stable forced feedback and a timed inverter oscillator',()=>{
 const c=new Circuit(),pieces=[node('a','lever',true),node('g','or-gate')];c.configure(pieces,[wire('1','a','out','g','a'),wire('2','g','out','g','b')]);expect(c.output('g')).toBe(true);expect(c.unstable.size).toBe(0);
 const clock=new Circuit(),timed=[{...node('d','signal-delay'),position:[-8,2,0] as [number,number,number]},node('g','signal-inverter')];
 clock.configure(timed,[{...wire('1','g','out','d','in'),points:[[10,2,4],[-10,2,4]]},{...wire('2','d','out','g','in'),points:[[-6,2,-4],[6,2,-4]]}]);
 expect(clock.output('g')).toBe(true);clock.advance(200);expect(clock.output('g')).toBe(false);clock.advance(200);expect(clock.output('g')).toBe(true);expect(clock.unstable.size).toBe(0);
});
it('does not suppress a constant-high gate inside an oscillating feedback component',()=>{
 const c=new Circuit(),pieces=[{...node('a','nand-gate'),position:[-8,2,0] as [number,number,number]},{...node('b','or-gate'),position:[8,2,0] as [number,number,number]},{...node('high','lever',true),position:[8,2,8] as [number,number,number]}];
 const wires=[{...wire('aa','a','out','a','a'),points:[[-5,2,-3],[-11,2,-3]]},{...wire('ab','a','out','b','a'),points:[[-4,2,-5],[5,2,-5]]},{...wire('ba','b','out','a','b'),points:[[11,2,4],[-11,2,4]]},wire('hb','high','out','b','b')];
 c.configure(pieces,wires);expect(c.output('b')).toBe(true);expect(c.unstable.has('a')).toBe(true);expect(c.unstable.has('b')).toBe(false);
});
it('preserves a free end-cap junction when just one connected socket moves',()=>{
 const w=new World(),pieces=[{...node('a','lever',true),position:[-8,2,0] as [number,number,number]},{...node('b','lamp'),position:[8,2,0] as [number,number,number]},{...node('c','lamp'),position:[0,2,8] as [number,number,number]}];
 // Separate wire ends meet at the free junction; no interior tube conducts.
 const joint=new Vector3(...portPosition(pieces[0],'out')).lerp(new Vector3(...portPosition(pieces[1],'in')),.5).toArray() as [number,number,number];
 const wires:Wire[]=[{id:'main',from:{piece:'a',port:'out'},to:{point:joint},points:[]},{id:'other',from:{point:joint},to:{piece:'b',port:'in'},points:[]},{id:'branch',from:{point:joint},to:{piece:'c',port:'in'},points:[]}];
 w.load(pieces,null,wires);const c=new Circuit();c.configure(pieces,w.wires);expect(c.input('c')).toBe(true);
 w.execute([{before:pieces[0],after:{...pieces[0],position:[-8,6,0]}}]);c.configure([...w.pieces.values()],w.wires);expect(c.input('b')).toBe(true);expect(c.input('c')).toBe(true);w.undo();expect(w.wires).toEqual(wires);
});
it('copies end-connected branches without including an unselected component lead',()=>{
 const w=new World(),pieces=[{...node('a','lever',true),position:[-8,2,0] as [number,number,number]},{...node('b','lamp'),position:[8,2,0] as [number,number,number]},{...node('c','lamp'),position:[0,2,8] as [number,number,number]}];
 const joint=new Vector3(...portPosition(pieces[0],'out')).lerp(new Vector3(...portPosition(pieces[1],'in')),.5).toArray() as [number,number,number];
 w.load(pieces,null,[{id:'main',from:{piece:'a',port:'out'},to:{point:joint},points:[]},{id:'other',from:{point:joint},to:{piece:'b',port:'in'},points:[]},{id:'branch',from:{point:joint},to:{piece:'c',port:'in'},points:[]}]);
 const source=[pieces[0],pieces[2]],copies=source.map(p=>({...p,id:p.id+'copy',position:[p.position[0],p.position[1]+5,p.position[2]] as [number,number,number]}));
 const wires=w.copyWires(source,copies),c=new Circuit();c.configure(copies,wires);expect(c.input('ccopy')).toBe(true);
 expect(wires.flatMap(w=>[w.from,w.to]).filter(e=>'piece' in e).map(e=>'piece' in e?e.piece:'')).not.toContain('b');
});
it('shares unchanged gate geometry across signal states and keeps active controls in bounds',()=>{
 expect(logicGeometryFor('or-gate',true,1)).toBe(logicGeometryFor('or-gate',false,1));
 const bounds=logicGeometryFor('lever',true,1).boundingBox!;expect(bounds.min.x).toBeGreaterThanOrEqual(-1.001);expect(bounds.max.x).toBeLessThanOrEqual(1.001);
});
