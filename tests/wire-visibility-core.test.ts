import {afterEach,expect,it} from 'vitest';
import {Color,InstancedMesh,Raycaster,Vector3} from 'three';
import {LogicView} from '../src/logic-view';
import {World,type Piece} from '../src/world';
import type {Wire} from '../src/logic-ports';

const views:LogicView[]=[];
afterEach(()=>{for(const view of views.splice(0))view.dispose();});
const lever:Piece={id:'source',item:'lever',position:[-5,1.57,0],rotation:[0,0,0],wood:'oak',logicOn:true};
const wires:Wire[]=[
 {id:'moving',kind:'neon',color:'cyan',from:{piece:'source',port:'out'},to:{point:[4,1,0]},points:[]},
 {id:'visible',kind:'wire',from:{point:[-4,1,3]},to:{point:[4,1,3]},points:[]},
];
const setup=()=>{const world=new World();world.load([lever],null,wires);const view=new LogicView(world);views.push(view);view.tick(1000);return {world,view};};
const batch=(view:LogicView,name='Wire tubes and ends')=>view.wires.root.getObjectByName(name) as InstancedMesh;
const pick=(view:LogicView,z:number)=>view.wires.pick(new Raycaster(new Vector3(0,4,z),new Vector3(0,-1,0)));
const hide=(view:LogicView,ids:Iterable<string>)=>{expect(view.hideWires).toBeTypeOf('function');view.hideWires(ids);};

it('hides and restores the edited wire mesh and pick target without changing world or circuit state',()=>{
 const {world,view}=setup(),records=world.wires,snapshot=structuredClone(records),revision=world.revision;
 const circuit=view.circuit,version=circuit.version,time=circuit.time,topology=circuit.topologyBuilds,tubes=batch(view);
 expect(tubes.count).toBe(6);expect(pick(view,0)?.id).toBe('moving');expect(pick(view,3)?.id).toBe('visible');
 expect(circuit.wireOn('moving')).toBe(true);
 hide(view,['moving']);
 expect(batch(view).count).toBe(3);expect(batch(view)).toBe(tubes);expect(pick(view,0)).toBeNull();expect(pick(view,3)?.id).toBe('visible');
 expect(view.wireIds).toEqual(['visible']);expect(batch(view,'Neon glow').count).toBe(0);
 expect(world.wires).toBe(records);expect(world.wires).toEqual(snapshot);expect(world.revision).toBe(revision);expect(world.canUndo).toBe(false);
 expect(view.circuit).toBe(circuit);expect(circuit.version).toBe(version);expect(circuit.time).toBe(time);expect(circuit.topologyBuilds).toBe(topology);expect(circuit.wireOn('moving')).toBe(true);
 hide(view,[]);
 expect(batch(view)).toBe(tubes);expect(tubes.count).toBe(6);expect(pick(view,0)?.id).toBe('moving');expect(pick(view,3)?.id).toBe('visible');
 expect(view.wireIds).toEqual(['moving','visible']);expect(batch(view,'Neon glow').count).toBe(1);
 const restored=new Color();tubes.getColorAt(0,restored);expect(restored.getHex()).toBe(0x00ffff);
 expect(world.wires).toBe(records);expect(world.wires).toEqual(snapshot);expect(view.circuit).toBe(circuit);
});

it('keeps hidden routes connected and restores their current signal appearance after a switch change',()=>{
 const {world,view}=setup(),records=world.wires;
 hide(view,['moving']);
 const source=world.pieces.get('source')!;expect(world.execute([{before:source,after:{...source,logicOn:false}}])).toBe(true);
 view.tick(1016);
 expect(view.circuit.wireOn('moving')).toBe(false);expect(pick(view,0)).toBeNull();expect(batch(view).count).toBe(3);
 hide(view,[]);
 const restored=new Color();batch(view).getColorAt(0,restored);expect(restored.getHex()).toBe(0x111111);
 expect(batch(view,'Neon glow').count).toBe(0);expect(pick(view,0)?.id).toBe('moving');expect(world.wires).toBe(records);
});

it('removes hidden powered neon routes from the next light update without waiting for the light throttle',()=>{
 const {view}=setup(),camera=new Vector3(0,2,0);
 view.wires.updateLights(camera,1000,'balanced');expect(view.wires.lights.some(light=>light.intensity>0)).toBe(true);
 hide(view,['moving']);view.wires.updateLights(camera,1001,'balanced');
 expect(view.wires.lights.every(light=>light.intensity===0)).toBe(true);expect(view.circuit.wireOn('moving')).toBe(true);
 hide(view,[]);view.wires.updateLights(camera,1002,'balanced');expect(view.wires.lights.some(light=>light.intensity>0)).toBe(true);
});

it('replaces the hidden set without retaining caller mutations or hiding other routes',()=>{
 const {view}=setup(),hidden=new Set(['moving']);hide(view,hidden);
 hidden.clear();view.refresh();expect(pick(view,0)).toBeNull();expect(pick(view,3)?.id).toBe('visible');
 hide(view,['visible']);expect(pick(view,0)?.id).toBe('moving');expect(pick(view,3)).toBeNull();expect(view.wireIds).toEqual(['moving']);
 hide(view,[]);expect(batch(view).count).toBe(6);
});
