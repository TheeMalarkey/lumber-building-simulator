import {afterEach,expect,it} from 'vitest';
import {Color,InstancedMesh,MeshStandardMaterial} from 'three';
import {WireView} from '../src/wire-view';
import type {Wire} from '../src/logic-ports';
import type {Piece} from '../src/world';

const pieces=new Map<string,Piece>();
const views:WireView[]=[];
afterEach(()=>{for(const view of views.splice(0))view.dispose();});
const createView=()=>{const view=new WireView();views.push(view);return view;};
const route=(kind:'wire'|'neon'='wire'):Wire=>({id:'draft',kind,...(kind==='neon'?{color:'cyan' as const}:{}),from:{point:[0,.2,0]},to:{point:[4,.2,0]},points:[]});
const batch=(view:WireView,name='Wire tubes and ends')=>view.root.getObjectByName(name) as InstancedMesh;
const colorAt=(mesh:InstancedMesh,index=0)=>{const color=new Color();mesh.getColorAt(index,color);return color;};
const bodyMaterial=(view:WireView)=>batch(view).material as MeshStandardMaterial;
const showDraft=(view:WireView,valid:boolean)=>{expect(view.draft).toBeTypeOf('function');view.draft(valid);};

it('omits both end collars only when the unfinished route requests ends:false',()=>{
 const view=createView();
 view.rebuild([route()],pieces,{ends:false});
 expect(batch(view).count).toBe(1);
 view.rebuild([route()],pieces);
 expect(batch(view).count).toBe(3);
 view.rebuild([route()],pieces,{ends:true});
 expect(batch(view).count).toBe(3);
});

it('preserves every tube and bend while removing draft collars',()=>{
 const view=createView(),wire:Wire={...route(),points:[[4,.2,0]],to:{point:[4,.2,4]}};
 view.rebuild([wire],pieces,{ends:false});
 expect(batch(view).count).toBe(2);
 expect(batch(view,'Wire bends').count).toBe(1);
 view.rebuild([wire],pieces);
 expect(batch(view).count).toBe(4);
 expect(batch(view,'Wire bends').count).toBe(1);
});

it('draws a valid regular draft as an opaque unpowered wire body',()=>{
 const view=createView();view.rebuild([route()],pieces,{ends:false});showDraft(view,true);
 const material=bodyMaterial(view);
 expect(material.transparent).toBe(false);expect(material.opacity).toBe(1);expect(material.depthWrite).toBe(true);
 expect(colorAt(batch(view)).getHex()).toBe(0x293b44);
 expect(batch(view).geometry.getAttribute('wirePower').getX(0)).toBe(0);
 expect(batch(view,'Neon glow').count).toBe(0);
});

it.each([
 {color:'cyan' as const,hex:0x00ffff,glow:1},
 {color:'orange' as const,hex:0xd5733d,glow:1},
 {color:'violet' as const,hex:0x7b007b,glow:0},
])('shows the chosen $color neon draft color through emission without preview point lights',({color,hex,glow})=>{
 const view=createView();view.root.remove(...view.lights);
 view.rebuild([{...route('neon'),color}],pieces,{ends:false});showDraft(view,true);
 expect(colorAt(batch(view)).getHex()).toBe(hex);
 expect(batch(view).geometry.getAttribute('wirePower').getX(0)).toBe(1);
 expect(batch(view,'Neon glow').count).toBe(glow);
 if(glow)expect(colorAt(batch(view,'Neon glow')).getHex()).toBe(hex);
 expect(bodyMaterial(view).opacity).toBe(1);expect(bodyMaterial(view).depthWrite).toBe(true);
 expect(view.root.children.some(child=>child.type==='PointLight')).toBe(false);
});

it.each(['wire','neon'] as const)('restores the %s draft color after repeated invalid and valid transitions',kind=>{
 const view=createView();view.rebuild([route(kind)],pieces,{ends:false});showDraft(view,true);
 const normal=colorAt(batch(view)).getHex();
 for(let i=0;i<3;i++){
  showDraft(view,false);const invalid=colorAt(batch(view));
  expect(invalid.r).toBeGreaterThan(invalid.g);expect(invalid.r).toBeGreaterThan(invalid.b);
  if(kind==='neon'){
   const glow=colorAt(batch(view,'Neon glow'));
   expect(glow.r).toBeGreaterThan(glow.g);expect(glow.r).toBeGreaterThan(glow.b);
  }
  showDraft(view,true);expect(colorAt(batch(view)).getHex()).toBe(normal);
  if(kind==='neon')expect(colorAt(batch(view,'Neon glow')).getHex()).toBe(0x00ffff);
 }
});

it('reuses the same instance batches across changing pointer-frame routes',()=>{
 const view=createView();view.rebuild([route('neon')],pieces,{ends:false});showDraft(view,true);
 const tubes=batch(view),bends=batch(view,'Wire bends'),glow=batch(view,'Neon glow');
 for(let frame=0;frame<20;frame++){
  const wire:Wire={...route('neon'),points:[[2,.2,0]],to:{point:[2,.2,1+frame/10]}};
  view.rebuild([wire],pieces,{ends:false});showDraft(view,frame%2===0);
  expect(batch(view)).toBe(tubes);expect(batch(view,'Wire bends')).toBe(bends);expect(batch(view,'Neon glow')).toBe(glow);
  expect(tubes.count).toBe(2);expect(bends.count).toBe(1);expect(glow.count).toBe(2);
 }
});

it('retains the transparent group-move preview and finished end collars',()=>{
 const view=createView();view.rebuild([route()],pieces);view.preview(true);
 expect(batch(view).count).toBe(3);
 expect(bodyMaterial(view).transparent).toBe(true);expect(bodyMaterial(view).opacity).toBe(.55);expect(bodyMaterial(view).depthWrite).toBe(false);
 const valid=colorAt(batch(view)).getHex();
 view.preview(false);expect(colorAt(batch(view)).getHex()).not.toBe(valid);
 view.preview(true);expect(colorAt(batch(view)).getHex()).toBe(valid);
});
