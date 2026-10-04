import {BoxGeometry,BufferGeometry,Float32BufferAttribute,CylinderGeometry,TorusGeometry,Vector3,Quaternion,MeshStandardMaterial,DataTexture,RepeatWrapping,SRGBColorSpace,LinearFilter,LinearMipmapLinearFilter,DoubleSide} from 'three';
import {solidFromGeometry} from './solid';
import {ITEMS,type CatalogItem,type Vec3} from './catalog';
export interface Emitter {offset:Vec3;direction?:Vec3;intensity:number;range:number;angle?:number}
export function emittersFor(id:string):Emitter[]{
  const h=ITEMS.get(id)!.size[1];
  if(id==='lamp'||id==='floor-lamp') return [{offset:[0,h*.7-h/2,0],intensity:85,range:22}];
  if(id==='wall-light') return [{offset:[0,-1.05,.2],direction:[0,-1,0],intensity:65,range:18,angle:Math.PI/3}];
  if(id==='worklight') return [{offset:[0,.28,.515],direction:[0,.15,1],intensity:180,range:32,angle:Math.PI/3}];
  return [-1,1].map(side=>({offset:[side*(.7+.9*Math.sin(.35)),1.7-.9*Math.cos(.35)-h/2,.25] as Vec3,
    direction:[side*Math.sin(.35),-Math.cos(.35),0] as Vec3,intensity:90,range:24,angle:Math.PI/3.5}));
}
export function lightFixtureParts(item:CatalogItem):BufferGeometry[]{
  const [w,h]=item.size,parts:BufferGeometry[]=[];
  const add=(g:BufferGeometry,x:number,y:number,z:number,s:number)=>{g.translate(x,y-h/2,z);g.userData.surface=s;parts.push(g);};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,s:number)=>add(new BoxGeometry(w,h,d),x,y,z,s);
  const cyl=(r:number,l:number,x:number,y:number,z:number,s:number,rz=0,rx=0)=>{
    const g=new CylinderGeometry(r,r,l,24);g.rotateZ(rz);g.rotateX(rx);add(g,x,y,z,s);
  };
  if(item.id==='lamp'||item.id==='floor-lamp'){
    const floor=item.id==='floor-lamp',shadeH=floor?1.8:1.5,shadeBottom=h-shadeH;
    cyl(w*.34,.15,0,.075,0,0);
    if(floor)cyl(w*.31,.12,0,.21,0,0);
    cyl(.16,shadeBottom+.1,0,(shadeBottom+.1)/2,0,0);
    cyl(.095,.07,0,shadeBottom*.6,.18,6,0,Math.PI/2);
    const shade=new CylinderGeometry(w*.39,w*.5,shadeH,32,1,true);
    shade.userData.collisionShell=true;add(shade,0,h-shadeH/2,0,floor?2:1);
    box(w*.66,.055,.065,0,h-.1,0,0);box(.065,.055,w*.66,0,h-.1,0,0);
    cyl(.18,.28,0,shadeBottom+.35,0,5);
  } else if(item.id==='wall-light'){
    box(.7,.9,.8,0,1.3,-.6,0);
    cyl(.7,1.96,0,1.02,.2,0);
    cyl(.6,.025,0,.028,.2,3);
    cyl(.22,.028,0,.014,.2,5);
    cyl(.09,.06,.69,1.1,.2,6,Math.PI/2);
  } else if(item.id==='floodlight'){
    cyl(.63,.35,0,1.8,-1.05,0,0,Math.PI/2);
    box(1.8,.24,.9,0,1.8,-.5,0);
    for(const side of [-1,1]){
      const angle=side*.35;
      cyl(.48,1.7,side*.7,1.7,.25,0,angle);
      const x=side*(.7+.85*Math.sin(.35)),y=1.7-.85*Math.cos(.35);
      cyl(.41,.025,x,y,.25,3,angle);
      cyl(.24,.03,x+side*.015,y-.02,.25,5,angle);
    }
    cyl(.11,.08,0,1.8,-.82,6,0,Math.PI/2);
  } else {
    // Continuous bent U stand, assembled from convex short tube segments.
    const tube=(a:Vec3,b:Vec3,r:number,surface:number)=>{
      const start=new Vector3(...a),end=new Vector3(...b),delta=end.clone().sub(start);
      const g=new CylinderGeometry(r,r,delta.length(),16);
      g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.clone().normalize()));
      const center=start.add(end).multiplyScalar(.5);add(g,center.x,center.y,center.z,surface);
    };
    tube([-1.35,.15,-1.05],[-1.35,.15,.8],.15,4);
    tube([-1.1,.15,1.05],[1.1,.15,1.05],.15,4);
    tube([1.35,.15,.8],[1.35,.15,-1.05],.15,4);
    for(const side of [-1,1]){
      const start=side<0?Math.PI/2:0,base=parts.length;
      // Smooth visible elbow with small convex collision segments underneath.
      for(let i=0;i<8;i++){
        const point=(a:number):Vec3=>[side*1.1+.25*Math.cos(a),.15,.8+.25*Math.sin(a)];
        tube(point(start+i*Math.PI/16),point(start+(i+1)*Math.PI/16),.15,4);
      }
      const proxies=parts.splice(base),solids=proxies.flatMap(solidFromGeometry);
      for(const proxy of proxies)proxy.dispose();
      const elbow=new TorusGeometry(.25,.15,16,16,Math.PI/2);
      elbow.rotateZ(start);elbow.rotateX(Math.PI/2);elbow.userData.collisionSolids=solids;
      add(elbow,side*1.1,.15,.8,4);
    }
    for(const side of [-1,1]){
      tube([side*1.35,.15,-.25],[side*1.25,1.25,-.25],.13,4);
      cyl(.16,.5,side*1.05,1.25,-.25,3,Math.PI/2);
    }
    const headStart=parts.length;
    box(1.8,1.15,.55,0,1.65,-.32,4);
    for(const x of [-1.17,1.17])box(.16,1.75,.2,x,1.7,.2,3);
    for(const y of [.905,2.495])box(2.18,.16,.2,0,y,.2,3);
    box(1.6,.9,.035,0,1.7,.0675,7);
    const outer=[[-1.09,-.715,.3],[1.09,-.715,.3],[1.09,.715,.3],[-1.09,.715,.3]];
    const inner=[[-.8,-.45,.085],[.8,-.45,.085],[.8,.45,.085],[-.8,.45,.085]];
    for(let i=0;i<4;i++){
      const j=(i+1)%4,g=new BufferGeometry();
      const vertices=[outer[i],outer[j],inner[j],outer[i],inner[j],inner[i]].flat();
      g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setAttribute('uv',new Float32BufferAttribute(new Float32Array(12),2));g.computeVertexNormals();g.userData.collisionShell=true;add(g,0,1.7,0,7);
    }
    cyl(.065,1.45,0,1.7,.17,5,Math.PI/2);
    for(const x of [-.78,.78])box(.12,.18,.18,x,1.7,.14,0);
    for(const x of [-.55,.55])cyl(.12,.5,x,2.65,-.1,4);
    cyl(.13,1.1,0,2.85,-.1,3,Math.PI/2);
    box(.12,.45,.42,-.96,1.5,-.3,3);
    cyl(.17,.09,-1.06,1.5,-.3,6,Math.PI/2);
    for(const g of parts.slice(headStart))g.translate(0,-1.7+h/2,0).rotateX(-.15).translate(0,1.7-h/2,0);
  }
  return parts;
}
export function makeLightMaterials(on=true){
  // Small shared procedural weave, authored here; not an extracted game texture.
  const pixels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const v=150+((x%4<2)!==(y%4<2)?65:0)+((x*17+y*31)%19);
    const i=(y*64+x)*4;pixels.set([v,v,v,255],i);
  }
  const weave=new DataTexture(pixels,64,64);weave.wrapS=weave.wrapT=RepeatWrapping;weave.repeat.set(3,1.5);weave.colorSpace=SRGBColorSpace;weave.generateMipmaps=true;weave.minFilter=LinearMipmapLinearFilter;weave.magFilter=LinearFilter;weave.anisotropy=2;weave.needsUpdate=true;
  return [
    new MeshStandardMaterial({color:0xbfc0c1,roughness:.5}),
    new MeshStandardMaterial({color:0x174665,map:weave,roughness:1,side:DoubleSide}),
    new MeshStandardMaterial({color:0x951e24,map:weave,roughness:1,side:DoubleSide}),
    new MeshStandardMaterial({color:0x17252e,roughness:.6}),
    new MeshStandardMaterial({color:0xffc000,roughness:.45}),
    new MeshStandardMaterial({color:on?0xfff9db:0xb2b4b1,emissive:on?0xffedbe:0,emissiveIntensity:on?1.5:0}),
    new MeshStandardMaterial({color:on?0x9fca78:0xc74b40,roughness:.3}),
    new MeshStandardMaterial({color:0xeeefec,roughness:.36,metalness:.12}),
  ];
}
