import {it,expect} from 'vitest';
import {World,type Piece} from '../src/world';
import {validateWires,wirePath,type Wire} from '../src/logic-ports';
import {wireLength,wireLimit,wireRouteIssue,NEON_COLORS} from '../src/wire-design';
import {Circuit} from '../src/logic';
import {WireView} from '../src/wire-view';
import {Vector3,InstancedMesh,PointLight} from 'three';

const route=(kind:'wire'|'neon'='wire'):Wire=>({id:'w',kind,...(kind==='neon'?{color:'cyan' as const}:{}),from:{point:[0,.2,0]},to:{point:[15,.2,0]},points:[]});
const lever:Piece={id:'l',item:'lever',position:[0,.75,0],rotation:[0,0,0],wood:'oak',logicOn:true};
it('counts the whole route, including bends, with distinct game limits',()=>{
 const path:[[number,number,number],[number,number,number],[number,number,number]]=[[0,.2,0],[0,.2,12],[9,.2,12]];
 expect(wireLength(path)).toBe(21);expect(wireLimit(route())).toBe(20);expect(wireLimit(route('neon'))).toBe(16);
 expect(wireRouteIssue(path,route(),null)).toContain('20');
 expect(wireRouteIssue([[0,.2,0],[16,.2,0]],route('neon'),[12])).toBeNull();
 expect(wireRouteIssue([[0,.2,0],[16.001,.2,0]],route('neon'),[12])).toContain('16');
});
it('keeps the complete tube above land and inside active land, including crossed cells',()=>{
 expect(wireRouteIssue([[0,.03,0],[2,.03,0]],route(),[12])).toContain('ground');
 expect(wireRouteIssue([[19,.2,0],[20,.2,0]],route(),[12])).toContain('active');
 expect(wireRouteIssue([[19,.2,0],[21,.2,0]],route(),[12,13])).toBeNull();
 expect(wireRouteIssue([[19,.2,24],[24,.2,19]],route(),[12,13,17])).toContain('active');
 expect(wireRouteIssue([[15,.2,21],[21,.2,15]],route(),[12,13,17])).toBeNull();
});
it('round trips every neon color and rejects unknown types or colors',()=>{
 for(const color of Object.keys(NEON_COLORS)) {const w={...route('neon'),color};expect(validateWires([w],[])).toEqual([w]);}
 expect(()=>validateWires([{...route(),kind:'rope'}],[])).toThrow();
 expect(()=>validateWires([{...route('neon'),color:'invisible'}],[])).toThrow();
 expect(()=>validateWires([{...route(),color:'red'}],[])).toThrow();
});
it('preserves untyped legacy wires without imposing the new length limit on load',()=>{
 const legacy={id:'old',from:{point:[0,.06,0]},to:{point:[100,.06,0]},points:[]};
 const world=new World();world.load([],null,[legacy as Wire]);expect(world.wires).toEqual([legacy]);
});
it('copies neon appearance along with routes and keeps undo atomic',()=>{
 const world=new World(),w:Wire={...route('neon'),from:{piece:'l',port:'out'}};world.load([lever],null,[w]);
 const copy={...lever,id:'copy',position:[0,4.75,0] as [number,number,number]};const wires=world.copyWires([lever],[copy]);
 expect(wires[0].kind).toBe('neon');expect(wires[0].color).toBe('cyan');expect(wires[0].to).toEqual({point:[15,4.2,0]});
 world.execute([{before:null,after:copy}],[...world.wires,...wires]);world.undo();expect(world.wires).toEqual([w]);world.redo();expect(world.wires[1].color).toBe('cyan');
});
it('rejects stretching a new wire past its length without moving pieces or history',()=>{
 const world=new World(),other={...lever,id:'r',position:[15,.75,0] as [number,number,number]};
 const w:Wire={...route('neon'),from:{piece:'l',port:'out'},to:{piece:'r',port:'out'}};world.load([lever,other],null,[w]);
 let issue='';world.onReject=m=>issue=m;
 expect(world.execute([{before:other,after:{...other,position:[18,.75,0]}}])).toBe(false);
 expect(issue).toContain('16');expect(world.pieces.get('r')!.position[0]).toBe(15);expect(world.canUndo).toBe(false);
 expect(world.execute([lever,other].map(p=>({before:p,after:{...p,position:[p.position[0]+30,p.position[1],0]}})))).toBe(true);
 expect(wireLength(wirePath(world.wires[0],world.pieces))).toBeCloseTo(15);
});
it('carries the same bidirectional signal through regular and neon junctions',()=>{
 const c=new Circuit(),a:Wire={...route(),from:{piece:'l',port:'out'},to:{point:[5,.2,0]}};
 const b:Wire={...route('neon'),id:'n',from:{point:[5,.2,0]}};
 c.configure([lever],[a,b]);expect(c.wireOn('n')).toBe(true);c.configure([{...lever,logicOn:false}],[a,b]);expect(c.wireOn('n')).toBe(false);
});
it('renders larger neon tubes and real end collars using fixed batches',()=>{
 const view=new WireView(),map=new Map([[lever.id,lever]]),wires=[route(),{...route('neon'),id:'n'}];
 view.rebuild(wires,map);view.paint(()=>false);const mesh=view.root.getObjectByName('Wire tubes and ends') as InstancedMesh;
 expect(mesh.count).toBe(6);const m=mesh.instanceMatrix.array;
 expect(Math.hypot(m[0],m[1],m[2])).toBeCloseTo(.10);expect(Math.hypot(m[48],m[49],m[50])).toBeCloseTo(.12);
 const neon=view.root.getObjectByName('Neon glow') as InstancedMesh;expect(neon.count).toBe(0);
 view.paint(()=>true);expect(neon.count).toBe(1);
 const identity=mesh;view.paint(()=>false);expect(view.root.getObjectByName('Wire tubes and ends')).toBe(identity);view.dispose();
});
it('keeps violet unbloomed and the illumination pool constant with many neon wires',()=>{
 const view=new WireView(),map=new Map([[lever.id,lever]]),wires=Array.from({length:80},(_,i)=>({...route('neon'),id:'n'+i,color:i===0?'violet' as const:'red' as const}));
 view.rebuild(wires,map);view.paint(()=>true);view.updateLights(new Vector3(0,2,0),1000,'balanced');
 expect((view.root.getObjectByName('Neon glow') as InstancedMesh).count).toBe(79);
 expect(view.root.children.filter(p=>p instanceof PointLight)).toHaveLength(2);
 expect(view.root.children.filter(p=>p instanceof InstancedMesh)).toHaveLength(3);
 view.paint(()=>false);view.updateLights(new Vector3(),1300,'balanced');expect(view.lights.every(l=>l.intensity===0)).toBe(true);view.dispose();
});
it('initializes a stable color attribute even when no wires are present',()=>{
 const view=new WireView();view.rebuild([],new Map());view.paint(()=>false);
 expect((view.root.getObjectByName('Neon glow') as InstancedMesh).instanceColor).not.toBeNull();view.dispose();
});
it('connects a neon end cap placed onto a ground-mounted regular end cap',()=>{
 const c=new Circuit(),basic:Wire={...route(),from:{piece:'l',port:'out'},to:{point:[10,.145,0]},points:[[3,.145,0]]};
 const neon:Wire={...route('neon'),id:'n',from:{point:[9.93,.44,0]},to:{point:[9.93,.44,4]}};
 c.configure([lever],[basic,neon]);expect(c.wireOn('n')).toBe(true);
});
it('prevents removing a plot occupied only by a new wire',()=>{
 const world=new World();world.load([],[12,13],[{...route(),from:{point:[18,.2,0]},to:{point:[25,.2,0]}}]);
 expect(world.togglePlot(13)).toBe('occupied');expect(world.plots).toEqual([12,13]);
});
it('rejects a group turn that lowers a typed wire below land',()=>{
 const world=new World(),w:Wire={...route(),from:{piece:'l',port:'out'},to:{point:[5,3,0]}};world.load([lever],null,[w]);
 expect(world.execute([{before:lever,after:{...lever,rotation:[2,0,0]}}])).toBe(false);
 expect(world.wires).toEqual([w]);
});
it('rejects copying a connected route outside the active plots atomically',()=>{
 const world=new World(),w:Wire={...route(),from:{piece:'l',port:'out'}};world.load([lever],[12],[w]);
 const copy={...lever,id:'copy',position:[6,.75,0] as [number,number,number]};
 expect(world.execute([{before:null,after:copy}],[...world.wires,...world.copyWires([lever],[copy])])).toBe(false);
 expect(world.pieces.size).toBe(1);expect(world.wires).toEqual([w]);expect(world.canUndo).toBe(false);
});
