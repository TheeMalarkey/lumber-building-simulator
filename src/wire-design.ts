import type {Vec3} from './catalog';
import {ALL_PLOTS,plotCenter} from './plots';

// Published BrickColor RGB. Diameters and collars are reconstructed from
// placed-wire photographs, not the misleading coil on the box.
export const NEON_COLORS={
 white:{label:'White',hex:0xf8f8f8},red:{label:'Red',hex:0xff0000},
 orange:{label:'Orange',hex:0xd5733d},yellow:{label:'Yellow',hex:0xffff00},
 green:{label:'Green',hex:0x00ff00},cyan:{label:'Cyan',hex:0x00ffff},
 blue:{label:'Blue',hex:0x0000ff},violet:{label:'Violet',hex:0x7b007b},pink:{label:'Pink',hex:0xff00bf},
} as const;
export type NeonColor=keyof typeof NEON_COLORS;
export interface WireStyle {kind?:'wire'|'neon';color?:NeonColor}
export const wireLimit=(w:WireStyle)=>w.kind==='neon'?16:20;
export const wireRadius=(w:WireStyle)=>w.kind==='neon'?.12:.06;
export const wireCollarRadius=(w:WireStyle)=>w.kind==='neon'?.15:.095;
export const wireColor=(w:WireStyle,on:boolean)=>w.kind==='neon'?(on?NEON_COLORS[w.color??'white'].hex:0x111111):(on?0x46bef4:0x293b44);
export const wireGlows=(w:WireStyle)=>w.kind==='neon'&&w.color!=='violet';
export const wireLength=(path:readonly Vec3[])=>path.slice(1).reduce((n,p,i)=>n+Math.hypot(...p.map((v,k)=>v-path[i][k])),0);

function crossesRect(a:Vec3,b:Vec3,x:number,z:number,r:number){
 let lo=0,hi=1;
 for(const [axis,c] of [[0,x],[2,z]]){
  const min=c-20-r+1e-7,max=c+20+r-1e-7,d=b[axis]-a[axis];
  if(Math.abs(d)<1e-10){if(a[axis]<=min||a[axis]>=max)return false;}
  else {const t0=(min-a[axis])/d,t1=(max-a[axis])/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>=hi)return false;}
 }return hi>lo;
}
/** Segment clipping accepts connected plot seams without cutting across an
 * inactive corner of an L-shaped plot. The whole tube stays on owned land. */
export function wireRouteIssue(path:readonly Vec3[],style:WireStyle,plots:readonly number[]|null):string|null{
 const limit=wireLimit(style),length=wireLength(path);
 if(length>limit+1e-6)return `${style.kind==='neon'?'Neon wire':'Wire'} is limited to ${limit} studs (${length.toFixed(2)} used).`;
 return wireSpaceIssue(path,style,plots);
}
export function wireTouchesPlot(path:readonly Vec3[],style:WireStyle,id:number){
 const [x,z]=plotCenter(id);return path.some((p,i)=>crossesRect(p,path[i+1]??p,x,z,wireCollarRadius(style)));
}
export function wireSpaceIssue(path:readonly Vec3[],style:WireStyle,plots:readonly number[]|null):string|null{
 const r=wireCollarRadius(style);
 if(path.some(p=>p[1]<r-1e-6))return 'Keep the complete wire above the ground.';
 if(plots!==null){
  if(path.some(p=>Math.abs(p[0])+r>100+1e-7||Math.abs(p[2])+r>100+1e-7))return 'Keep the wire inside active plots.';
  for(const id of ALL_PLOTS)if(!plots.includes(id)){
   if(wireTouchesPlot(path,style,id))return 'Keep the wire inside active plots.';
  }
 }return null;
}
