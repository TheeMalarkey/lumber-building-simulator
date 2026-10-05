import {it,expect} from 'vitest';
import {World,type Piece} from '../src/world';
import {Circuit} from '../src/logic';
import {wirePath,type Wire} from '../src/logic-ports';
import {parseProject} from '../src/project';

const source:Piece={id:'source',item:'signal-inverter',wood:'oak',position:[4,3,-2],rotation:[0,1,0]};
const lamp:Piece={id:'lamp',item:'lamp',wood:'oak',position:[10,3,-2],rotation:[0,0,0]};
const lead:Wire={id:'lead',kind:'neon',color:'blue',frame:[0,Math.SQRT1_2,0,Math.SQRT1_2],from:{piece:'source',port:'out'},to:{piece:'lamp',port:'in'},points:[[4,2.75,-5],[10,2.75,-5]]};

it('deleting a rotated source leaves its routed wire in place and removes only its power',()=>{
 const world=new World(),circuit=new Circuit();world.load([source,lamp],[12],[lead]);
 const originalPath=wirePath(world.wires[0],world.pieces);
 circuit.configure([...world.pieces.values()],world.wires);expect(circuit.input('lamp')).toBe(true);
 expect(world.execute([{before:source,after:null}])).toBe(true);
 expect(world.pieces.has('source')).toBe(false);expect(world.pieces.has('lamp')).toBe(true);
 expect(world.wires).toHaveLength(1);
 expect(world.wires[0]).toEqual({...lead,from:{point:[4,2.75,-3]}});
 expect(wirePath(world.wires[0],world.pieces)).toEqual(originalPath);
 circuit.configure([...world.pieces.values()],world.wires);expect(circuit.input('lamp')).toBe(false);expect(circuit.wireOn('lead')).toBe(false);
 const project=parseProject(JSON.stringify({version:1,name:'Detached wires',plots:[12],pieces:[...world.pieces.values()],wires:world.wires}));
 expect(project.wires).toEqual(world.wires);
 world.undo();expect(world.pieces.get('source')).toEqual(source);expect(world.wires).toEqual([lead]);
 circuit.configure([...world.pieces.values()],world.wires);expect(circuit.input('lamp')).toBe(true);
 world.redo();expect(world.wires[0].from).toEqual({point:[4,2.75,-3]});expect(world.pieces.has('source')).toBe(false);
});

it('deleting a receiver keeps the connected wire powered by its surviving source',()=>{
 const world=new World(),circuit=new Circuit();world.load([source,lamp],null,[lead]);
 expect(world.execute([{before:lamp,after:null}])).toBe(true);
 expect(world.wires).toHaveLength(1);expect(world.wires[0].from).toEqual(lead.from);expect(world.wires[0].to).toEqual({point:[10,2.6,-1.78]});
 circuit.configure([...world.pieces.values()],world.wires);expect(circuit.wireOn('lead')).toBe(true);
});

it('deleting multiple components detaches both ends in one history entry while explicit wire deletion stays independent',()=>{
 const loose:Wire={id:'loose',kind:'wire',from:{point:[-4,1,0]},to:{point:[-2,1,0]},points:[]};
 const world=new World();world.load([source,lamp],null,[lead,loose]);
 // The explicit wire list removes only the selected loose wire.
 expect(world.execute([{before:source,after:null},{before:lamp,after:null}],[lead])).toBe(true);
 expect(world.pieces.size).toBe(0);
 expect(world.wires).toEqual([{...lead,from:{point:[4,2.75,-3]},to:{point:[10,2.6,-1.78]}}]);
 world.undo();expect(world.pieces.size).toBe(2);expect(world.wires).toEqual([lead,loose]);expect(world.canUndo).toBe(false);
 world.redo();expect(world.pieces.size).toBe(0);expect(world.wires).toHaveLength(1);
 const detached=structuredClone(world.wires);
 expect(world.execute([],[])).toBe(true);expect(world.wires).toEqual([]);expect(world.pieces.size).toBe(0);
 world.undo();expect(world.wires).toEqual(detached);expect(world.pieces.size).toBe(0);
});
