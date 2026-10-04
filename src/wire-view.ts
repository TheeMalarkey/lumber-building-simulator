import * as T from 'three';
import {wirePath,type Wire} from './logic-ports';
import type {Piece} from './world';
import {wireColor,wireGlows} from './wire-design';
import {wireParts,wirePartMatrix,wireTubeGeometry,wireBendGeometry} from './wire-shape';

type Part={wire:Wire;matrix:T.Matrix4};
type Segment={wire:Wire;a:T.Vector3;b:T.Vector3};
const up=new T.Vector3(0,1,0);

/** Three shared instance batches, independent of wire count. The two fixed,
 * shadowless lights cannot reproduce a per-segment SurfaceLight exactly, but
 * avoid adding unbounded lights or changing shadow sampler counts at runtime. */
export class WireView {
 root=new T.Group();
 lights=[new T.PointLight(0xffffff,0,8,2),new T.PointLight(0xffffff,0,8,2)];
 private tubes?:T.InstancedMesh;private joints?:T.InstancedMesh;private glow?:T.InstancedMesh;
 private tubeGeometry=wireTubeGeometry();
 private jointGeometry=wireBendGeometry();
 private glowGeometry=new T.PlaneGeometry(1,1);
 private material=new T.MeshStandardMaterial({roughness:.65,metalness:0,toneMapped:false});
 private glowMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false,fog:true,
  uniforms:T.UniformsUtils.merge([T.UniformsLib.fog]),
  vertexShader:`varying vec2 vUv; varying vec3 vWireColor;
   #include <fog_pars_vertex>
   void main(){
    vUv=uv;vWireColor=instanceColor;
    vec3 a=(modelViewMatrix*instanceMatrix*vec4(0.,-.5,0.,1.)).xyz;
    vec3 b=(modelViewMatrix*instanceMatrix*vec4(0.,.5,0.,1.)).xyz;
    vec3 axis=b-a;vec3 side=cross(axis,vec3(0.,0.,1.));
    side=length(side)>.0001?normalize(side):vec3(1.,0.,0.);
    float width=length((modelViewMatrix*instanceMatrix*vec4(1.,0.,0.,0.)).xyz);
    vec4 mvPosition=vec4(mix(a,b,uv.y)+side*position.x*width,1.);
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`,
  fragmentShader:`varying vec2 vUv; varying vec3 vWireColor;
   #include <fog_pars_fragment>
   void main(){
    float across=abs(vUv.x-.5)*2.;
    float alpha=pow(1.-across,3.)*.24*smoothstep(0.,.04,vUv.y)*smoothstep(0.,.04,1.-vUv.y);
    gl_FragColor=vec4(vWireColor,alpha);
    #include <colorspace_fragment>
    #include <fog_fragment>
   }`,
 });
 private tubeParts:Part[]=[];private jointParts:Part[]=[];private glowParts:Part[]=[];
 private buckets=new Map<string,Segment[]>();private powered=new Set<string>();
 private lastLightTime=-Infinity;
 constructor(){
  this.root.name='Placed wires';this.root.add(...this.lights);
  this.material.onBeforeCompile=shader=>{
   shader.vertexShader='attribute float wirePower; varying float vWirePower;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWirePower=wirePower;');
   shader.fragmentShader='varying float vWirePower;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec3 neonColor=diffuseColor.rgb; diffuseColor.rgb*=1.-vWirePower;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=neonColor*vWirePower;');
  };
  this.material.customProgramCacheKey=()=> 'wire-neon-emission-v1';
 }
 private batch(old:T.InstancedMesh|undefined,geometry:T.BufferGeometry,count:number,name:string,glow=false){
  if(old&&old.instanceMatrix.count>=count){old.count=count;return old;}
  if(old){this.root.remove(old);old.geometry.dispose();old.dispose();}
  const capacity=Math.max(8,2**Math.ceil(Math.log2(count||1))),g=geometry.clone();
  if(!glow)g.setAttribute('wirePower',new T.InstancedBufferAttribute(new Float32Array(capacity),1));
  const mesh=new T.InstancedMesh(g,glow?this.glowMaterial:this.material,capacity);mesh.count=count;mesh.name=name;
  // Three compiles even empty instance batches. Keep the color attribute
  // present before the first powered segment, so the shader layout is stable.
  mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3);
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.root.add(mesh);return mesh;
 }
 rebuild(wires:Wire[],pieces:Map<string,Piece>){
  this.tubeParts=[];this.jointParts=[];this.glowParts=[];this.buckets.clear();
  const cylinder=(wire:Wire,a:T.Vector3,b:T.Vector3,r:number,parts=this.tubeParts)=>{
   const d=b.clone().sub(a),len=d.length();if(len<1e-6)return;
   parts.push({wire,matrix:new T.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(up,d.divideScalar(len)),new T.Vector3(r,len,r))});
  };
  for(const wire of wires){
   const path=wirePath(wire,pieces).map(p=>new T.Vector3(...p)).filter((p,i,all)=>!i||p.distanceToSquared(all[i-1])>1e-10);
   if(path.length<2)continue;
   for(const part of wireParts(wire,path.map(p=>p.toArray())))
    (part.kind==='bend'?this.jointParts:this.tubeParts).push({wire,matrix:wirePartMatrix(part)});
   for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    if(wireGlows(wire)){
     cylinder(wire,a,b,.95,this.glowParts);
     const segment={wire,a,b};
     const lo=a.clone().min(b).divideScalar(16).floor(),hi=a.clone().max(b).divideScalar(16).floor(),size=hi.clone().sub(lo).addScalar(1);
     if(size.x*size.y*size.z<=4096)for(let x=lo.x;x<=hi.x;x++)for(let y=lo.y;y<=hi.y;y++)for(let z=lo.z;z<=hi.z;z++){
      const key=`${x},${y},${z}`;if(!this.buckets.has(key))this.buckets.set(key,[]);this.buckets.get(key)!.push(segment);
     }
    }
   }
  }
  this.tubes=this.batch(this.tubes,this.tubeGeometry,this.tubeParts.length,'Wire tubes and ends');
  this.joints=this.batch(this.joints,this.jointGeometry,this.jointParts.length,'Wire bends');
  this.glow=this.batch(this.glow,this.glowGeometry,this.glowParts.length,'Neon glow',true);
  for(const [mesh,parts] of [[this.tubes,this.tubeParts],[this.joints,this.jointParts]] as const){parts.forEach((p,i)=>mesh.setMatrixAt(i,p.matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
 }
 paint(isOn:(id:string)=>boolean){
  this.powered.clear();const color=new T.Color();
  for(const [mesh,parts] of [[this.tubes,this.tubeParts],[this.joints,this.jointParts]] as const){
   if(!mesh)continue;const power=mesh.geometry.getAttribute('wirePower');
   parts.forEach((p,i)=>{const on=isOn(p.wire.id);if(on)this.powered.add(p.wire.id);mesh.setColorAt(i,color.setHex(wireColor(p.wire,on)));power.setX(i,on&&p.wire.kind==='neon'?1:0);});
   power.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  }
  if(this.glow){
   let count=0;for(const p of this.glowParts)if(this.powered.has(p.wire.id)){this.glow.setMatrixAt(count,p.matrix);this.glow.setColorAt(count++,color.setHex(wireColor(p.wire,true)));}
   this.glow.count=count;this.glow.instanceMatrix.needsUpdate=true;if(this.glow.instanceColor)this.glow.instanceColor.needsUpdate=true;this.glow.computeBoundingSphere();
  }
  this.lastLightTime=-Infinity;
 }
 updateLights(camera:T.Vector3,now:number,quality:string){
  if(now-this.lastLightTime<250)return;this.lastLightTime=now;
  const candidates=new Map<string,{wire:Wire;point:T.Vector3;distance:number}>(),center=camera.clone().divideScalar(16).floor(),visited=new Set<Segment>();
  if(quality!=='performance')for(let x=center.x-1;x<=center.x+1;x++)for(let y=center.y-1;y<=center.y+1;y++)for(let z=center.z-1;z<=center.z+1;z++)for(const s of this.buckets.get(`${x},${y},${z}`)??[]){
   if(visited.has(s)||!this.powered.has(s.wire.id))continue;visited.add(s);
   const delta=s.b.clone().sub(s.a),t=T.MathUtils.clamp(camera.clone().sub(s.a).dot(delta)/delta.lengthSq(),0,1),point=s.a.clone().addScaledVector(delta,t),distance=point.distanceToSquared(camera);
   if(distance<24*24&&distance<(candidates.get(s.wire.id)?.distance??Infinity))candidates.set(s.wire.id,{wire:s.wire,point,distance});
  }
  const nearest=[...candidates.values()].sort((a,b)=>a.distance-b.distance||a.wire.id.localeCompare(b.wire.id)).slice(0,2);
  this.lights.forEach((light,i)=>{const c=nearest[i];light.intensity=c?2.5*Math.min(1,(24-Math.sqrt(c.distance))/8):0;if(c){light.position.copy(c.point);light.color.setHex(wireColor(c.wire,true));}});
 }
 dispose(){for(const m of [this.tubes,this.joints,this.glow]){m?.geometry.dispose();m?.dispose();}this.tubeGeometry.dispose();this.jointGeometry.dispose();this.glowGeometry.dispose();this.material.dispose();this.glowMaterial.dispose();}
}
