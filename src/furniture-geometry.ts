import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Shape, Float32BufferAttribute } from 'three';
import type { CatalogItem } from './catalog';

/** Original modeled reconstructions from unboxed LT2 references. Each part is
 * convex, so rendering and collision share the same detail without solid AABBs.
 * Surface indices match makeFurnitureMaterials. Coordinates start at the feet. */
export function furnitureParts(item: CatalogItem): BufferGeometry[] {
  const [w,h,d]=item.size, parts:BufferGeometry[]=[];
  const add=(g:BufferGeometry,x:number,y:number,z:number,surface:number)=>{
    g.translate(x,y-h/2,z);g.userData.surface=surface;parts.push(g);
  };
  const box=(sx:number,sy:number,sz:number,x:number,y:number,z:number,s=0)=>add(new BoxGeometry(sx,sy,sz),x,y,z,s);
  const cyl=(rx:number,rz:number,len:number,x:number,y:number,z:number,s:number,axis:'y'|'z'='y')=>{
    const g=new CylinderGeometry(rx,rx,len,24,1);
    if(axis==='z') g.rotateX(Math.PI/2); else g.scale(1,1,rz/rx);
    add(g,x,y,z,s);
  };
  // Eight-vertex convex component: lower ring then upper ring, both CCW in X/Z.
  const prism=(v:number[][],s:number)=>{
    const faces=[[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
    const pos:number[]=[];
    for(const [a,b,c,e] of faces) for(const i of [a,b,c,a,c,e]) pos.push(...v[i]);
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.computeVertexNormals();
    // All furniture surfaces are plain; UVs still needed when merging primitives.
    g.setAttribute('uv',new Float32BufferAttribute(new Float32Array(pos.length/3*2),2));add(g,0,0,0,s);
  };
  const legs=(width:number,depth:number,height:number)=>{
    for(const x of [-width/2+.4,width/2-.4]) for(const z of [-depth/2+.4,depth/2-.4]) box(.5,height,.5,x,height/2,z,1);
  };
  const extrude=(shape:Shape,depth:number,x:number,y:number,z:number)=>{
    const g=new ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:8,steps:1});
    add(g,x,y,z-depth/2,0);
  };
  if(['armchair','loveseat','couch'].includes(item.id)) {
    legs(w,d,.5);
    box(w,1,d,0,1,0); // Continuous seat, no invented cushion seams.
    const backZ=-d/2+.5;
    // One convex stadium profile avoids coplanar overlapping cylinders/boxes.
    const back=new Shape();
    back.moveTo(-w/2+1,-1);back.lineTo(w/2-1,-1);
    back.absarc(w/2-1,0,1,-Math.PI/2,Math.PI/2,false);
    back.lineTo(-w/2+1,1);back.absarc(-w/2+1,0,1,Math.PI/2,Math.PI*1.5,false);back.closePath();
    extrude(back,1,0,3,backZ);
    for(const side of [-1,1]) {
      // Thin side below a full rolled arm. Recess its front to avoid coplanar caps.
      box(.45,1.3,d-1.04,side*(w/2-.35),2.15,.48);
      cyl(.35,.35,d-1,side*(w/2-.35),2.8,.5,0,'z');
    }
    box(w, .5, 1, 0,1.75,backZ);
  } else if(item.id.endsWith('-bed')) {
    legs(w,d,.4);
    box(w,.45,d,0,.625,0,3);
    box(w,2.6,.2,0,1.7,-d/2+.1,3);
    box(w,1.1,.2,0,.95,d/2-.1,3);
    box(w-.2,.55,d-.4,0,1.125,0,2);
    const count=item.id==='twin-bed'?2:1;
    const pillowW=count===2 ? 2.5 : 2.6;
    for(let i=0;i<count;i++) {
      const x=count===1?0:(i-.5)*2.8;
      // Rounded pillow ends, matching the simple flattened reference profile.
      box(pillowW-.24,.24,1.15,x,1.52,-2.95,2);
      for(const side of [-1,1]) cyl(.12,.12,1.15,x+side*(pillowW/2-.12),1.52,-2.95,2,'z');
    }
  } else if(item.id==='toilet') {
    cyl(.83,1.02,.2,0,.1,.3,2);
    cyl(.62,.74,.85,0,.625,.3,2);
    box(2.4,1.45,.85,0,2.6,-1.45,2);
    box(2.5,.175,.95,0,3.4125,-1.45,2);
    box(2.4,.3,1,0,1.725,-1.45,2);
    box(.32,.16,.2,-.91,3.05,-.925,4);
    // Closed convex wall sectors preserve the actual open bowl for collision.
    const ring=(y0:number,y1:number,outer0:number,outer1:number,inner0:number,inner1:number)=>{
      const p=(angle:number,r:number,y:number)=>[Math.cos(angle)*r,y,.45+Math.sin(angle)*r*1.32];
      for(let i=0;i<32;i++){
        const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
        prism([p(a,outer0,y0),p(b,outer0,y0),p(b,inner0,y0),p(a,inner0,y0),
          p(a,outer1,y1),p(b,outer1,y1),p(b,inner1,y1),p(a,inner1,y1)],2);
      }
    };
    ring(1,1.85,.64,1.12,.48,.98);
    ring(1.85,2,1.12,1.12,.98,.98);
    cyl(.65,.84,.035,0,1.3,.45,6);
    cyl(.36,.45,.02,0,1.33,.45,1);
  } else {
    const fridge=item.id==='refrigerator',stove=item.id==='stove';
    const bodyH=fridge?h:2.4;
    const s=fridge?2:stove?5:7;
    // Hollow carcasses, with separate closed doors and visible perimeter gaps.
    box(w,.16,d,0,.08,0,s);
    box(w,.16,d,0,bodyH-.08,0,s);
    for(const x of [-w/2+.1,w/2-.1]) box(.2,bodyH-.32,d,x,bodyH/2,0,s);
    box(w-.4,bodyH-.32,.16,0,bodyH/2,-d/2+.08,s);
    if(fridge) {
      for(const side of [-1,1]) {
        box(1.77,bodyH-.42,.16,side*.91,bodyH/2,1.8,2);
        box(.16,1.4,.22,side*.28,2.85,1.89,4);
      }
      for(const y of [1.6,3.2,4.8]) box(w-.4,.1,d-.4,0,y,0,2);
    } else {
      box(w-.4,bodyH-.4,.14,0,bodyH/2,1.82,stove?5:2);
      // Horizontal black bar, recessed slightly inside the nominal footprint.
      box(1.8,.2,.24,0,bodyH-.6,1.88,1);
      if(stove){
        box(2.5,.9,.03,0,1.05,1.905,1);
        box(2.18,.66,.035,0,1.05,1.925,8);
        box(w-.3,.02,d-.8,0,2.41,.15,1);
        // The rear control strip is a slanted plain gray face, without dials.
        prism([[-2,2.4,-2],[2,2.4,-2],[2,2.4,-1.55],[-2,2.4,-1.55],
          [-2,2.8,-2],[2,2.8,-2],[2,2.8,-1.82],[-2,2.8,-1.82]],5);
      }
    }
  }
  return parts;
}
