import {describe,it,expect} from 'vitest';
import {Circuit} from '../src/logic';
import {TimerFaceView} from '../src/timer-face-view';
import type {Piece} from '../src/world';
import type {Wire} from '../src/logic-ports';
import {Matrix4,Vector3} from 'three';
import {quaternionRotation} from '../src/placement';

const source:Piece={id:'source',item:'lever',wood:'oak',position:[-4,.75,0],rotation:[0,0,0]};
const delay:Piece={id:'delay',item:'signal-delay',wood:'oak',position:[0,1,0],rotation:[0,0,0],timing:12};
const sustain:Piece={...delay,id:'sustain',item:'signal-sustain'};
const lead=(to:string):Wire=>({id:'wire-'+to,from:{piece:'source',port:'out'},to:{piece:to,port:'in'},points:[]});

describe('gameplay timer faces',()=>{
 it('moves a short pulse up the Delay meter even when output is still off',()=>{
  const c=new Circuit(),pieces=[{...source,item:'button'},delay],wires=[lead('delay')];c.configure(pieces,wires);
  expect(c.timerDisplay('delay')).toMatchObject({input:false,mask:0,level:0,nextChange:Infinity});
  c.press('source');expect(c.output('delay')).toBe(false);
  expect(c.timerDisplay('delay')).toMatchObject({input:true,mask:1,nextChange:200});
  c.advance(200);expect(c.timerDisplay('delay')).toMatchObject({input:true,mask:3});
  c.advance(200);expect(c.timerDisplay('delay')).toMatchObject({input:false,mask:6});
  c.advance(1800);expect(c.timerDisplay('delay')).toMatchObject({input:false,mask:3072});
  c.advance(200);expect(c.output('delay')).toBe(true);expect(c.timerDisplay('delay')).toMatchObject({mask:2048});
  c.advance(200);expect(c.timerDisplay('delay')).toMatchObject({mask:0,nextChange:Infinity});
  c.advance(150);expect(c.output('delay')).toBe(false);
 });
 it('fills and clears Delay from the bottom, preserving separate pulses and electrical event times',()=>{
  const c=new Circuit(),wires=[lead('delay')];c.configure([{...source,logicOn:true},delay],wires);
  c.advance(2200);expect(c.timerDisplay('delay')?.mask).toBe(4095);expect(c.output('delay')).toBe(false);
  c.configure([source,delay],wires);expect(c.timerDisplay('delay')).toMatchObject({input:false,mask:4094});
  c.advance(200);expect(c.output('delay')).toBe(true);expect(c.timerDisplay('delay')?.mask).toBe(4092);
  c.advance(200);c.configure([{...source,logicOn:true},delay],wires);expect(c.timerDisplay('delay')?.mask).toBe(4089);
  c.advance(2400);expect(c.output('delay')).toBe(true);expect(c.timerDisplay('delay')?.mask).toBe(4095);
 });
 it('holds Sustain at its selected level then drains continuously with its remaining hold time',()=>{
  const c=new Circuit(),wires=[lead('sustain')];c.configure([{...source,logicOn:true},sustain],wires);
  expect(c.timerDisplay('sustain')).toMatchObject({input:true,mask:0,level:1,nextChange:Infinity});
  c.advance(1000);c.configure([source,sustain],wires);expect(c.timerDisplay('sustain')).toMatchObject({input:false,level:1});
  c.advance(600);expect(c.timerDisplay('sustain')?.level).toBeCloseTo(.75);expect(c.output('sustain')).toBe(true);
  c.advance(600);expect(c.timerDisplay('sustain')?.level).toBeCloseTo(.5);
  c.configure([{...source,logicOn:true},sustain],wires);expect(c.timerDisplay('sustain')?.level).toBe(1);
  c.configure([source,sustain],wires);c.advance(2400);expect(c.timerDisplay('sustain')).toMatchObject({input:false,level:0,nextChange:Infinity});expect(c.output('sustain')).toBe(false);
 });
 it('uses the full twelve-step scale for short Sustain settings and keeps setting one as passthrough',()=>{
  for(const [setting,level] of [[1,1/12],[2,1/6],[6,.5]] as const){
   const c=new Circuit(),p={...sustain,timing:setting},wires=[lead('sustain')];c.configure([{...source,logicOn:true},p],wires);
   expect(c.timerDisplay('sustain')?.level).toBeCloseTo(level);c.configure([source,p],wires);
   if(setting===1){expect(c.timerDisplay('sustain')?.level).toBe(0);expect(c.output('sustain')).toBe(false);}
   else {c.advance(setting*100);expect(c.timerDisplay('sustain')?.level).toBeCloseTo(level/2);expect(c.output('sustain')).toBe(true);}
  }
 });
 it('resets visual history with a new timer or changed setting and never writes runtime state into pieces',()=>{
  const c=new Circuit(),pieces=[{...source,logicOn:true},delay],wires=[lead('delay')];c.configure(pieces,wires);c.advance(1000);
  expect(c.timerDisplay('delay')?.mask).toBe(63);
  c.configure([pieces[0],{...delay,timing:2}],wires);expect(c.timerDisplay('delay')?.mask).toBe(1);
  c.configure([],[]);expect(c.timerDisplay('delay')).toBeNull();c.configure([source,delay],wires);expect(c.timerDisplay('delay')?.mask).toBe(0);
  expect(delay).toEqual({id:'delay',item:'signal-delay',wood:'oak',position:[0,1,0],rotation:[0,0,0],timing:12});
 });
 it('uses two shared batches, schedules idle updates and transforms active faces with rotated pieces',()=>{
  const c=new Circuit(),p={...delay,position:[5,8,7] as Piece['position'],rotation:[.5,1,.5] as Piece['rotation']},view=new TimerFaceView();
  c.configure([{...source,logicOn:true},p],[lead('delay')]);view.rebuild([p]);view.update(c);
  expect(view.root.children).toHaveLength(2);expect(view.meters.count).toBe(1);expect(view.indicators.count).toBe(1);
  const matrix=new Matrix4();view.meters.getMatrixAt(0,matrix);const center=new Vector3().setFromMatrixPosition(matrix);
  const expected=new Vector3(.55,-.7304,.922).applyEuler(quaternionRotation(p.rotation)).add(new Vector3(...p.position));
  expect(center.distanceTo(expected)).toBeLessThan(1e-6);
  const matrixVersion=view.meters.instanceMatrix.version;c.advance(100);view.update(c);expect(view.meters.instanceMatrix.version).toBe(matrixVersion);
  c.advance(100);view.update(c);expect(view.meters.count).toBe(2);expect(view.meters.instanceMatrix.version).toBeGreaterThan(matrixVersion);
  const geometry=view.meters.geometry,material=view.meters.material;c.advance(2200);view.update(c);expect(view.meters.geometry).toBe(geometry);expect(view.meters.material).toBe(material);
  c.configure([source,p],[lead('delay')]);view.update(c);expect(view.indicators.count).toBe(0);expect(view.meters.count).toBe(11);
  view.rebuild([]);view.update(c);expect(view.meters.count).toBe(0);expect(view.indicators.count).toBe(0);view.dispose();
 });
 it('anchors the Sustain fill to the meter bottom while its top drains, without stretching beyond the housing',()=>{
  const c=new Circuit(),view=new TimerFaceView(),wires=[lead('sustain')];c.configure([{...source,logicOn:true},sustain],wires);view.rebuild([sustain]);view.update(c);
  const bounds=()=>{const m=new Matrix4();view.meters.getMatrixAt(0,m);view.meters.geometry.computeBoundingBox();return view.meters.geometry.boundingBox!.clone().applyMatrix4(m);};
  const full=bounds();expect(full.min.y).toBeCloseTo(.2164);expect(full.max.y).toBeCloseTo(1.5564);expect(full.max.z).toBeLessThanOrEqual(1.001);
  c.configure([source,sustain],wires);c.advance(1200);view.update(c);const half=bounds();expect(half.min.y).toBeCloseTo(full.min.y);expect(half.max.y-half.min.y).toBeCloseTo((full.max.y-full.min.y)/2);
  view.dispose();
 });
});
