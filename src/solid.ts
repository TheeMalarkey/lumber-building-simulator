import { Box3, BufferGeometry, Vector3 } from "three";
export interface Solid {
  vertices: Vector3[];
  normals: Vector3[];
  edges: Vector3[];
  bounds: Box3;
}
const uniqueDirection = (list: Vector3[], v: Vector3, signed = false) => {
  if (v.lengthSq()<1e-12) return;
  v.normalize();
  if (!list.some(n=>(signed ? n.dot(v) : Math.abs(n.dot(v)))>1-1e-7)) list.push(v);
};
/** Each render recipe component is convex; keep its boundary edges, not triangle diagonals. */
export function solidFromGeometry(g: BufferGeometry): Solid[] {
  const attr=g.getAttribute("position"), vertices: Vector3[]=[], ids:number[]=[], map=new Map<string,number>();
  for (let i=0;i<attr.count;i++) {
    const v=new Vector3().fromBufferAttribute(attr,i), key=v.toArray().map(n=>Math.round(n*1e6)).join(",");
    if (!map.has(key)) {map.set(key,vertices.length);vertices.push(v);}
    ids.push(map.get(key)!);
  }
  const normals:Vector3[]=[], edgeFaces=new Map<string,Vector3[]>();
  const count=g.index?.count ?? attr.count, shells:Solid[]=[];
  for (let i=0;i<count;i+=3) {
    const tri=[0,1,2].map(j=>ids[g.index ? g.index.getX(i+j) : i+j]);
    const [a,b,c]=tri.map(id=>vertices[id]);
    const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (n.lengthSq()<.5) continue;
    if (g.userData.collisionShell) {
      // The sink bowl is an open surface. Tiny triangular prisms retain the opening.
      const vs=[a,b,c,...[a,b,c].map(v=>v.clone().addScaledVector(n,-.02))];
      const es=[b.clone().sub(a).normalize(),c.clone().sub(b).normalize(),a.clone().sub(c).normalize(),n];
      const ns=[n,n.clone().negate(),...es.slice(0,3).map(e=>e.clone().cross(n).normalize())];
      shells.push({vertices:vs,normals:ns,edges:es,bounds:new Box3().setFromPoints(vs)});
      continue;
    }
    uniqueDirection(normals,n.clone(),true);
    for (let j=0;j<3;j++) {
      const key=[tri[j],tri[(j+1)%3]].sort((x,y)=>x-y).join(",");
      if (!edgeFaces.has(key)) edgeFaces.set(key,[]);
      edgeFaces.get(key)!.push(n);
    }
  }
  if (g.userData.collisionShell) return shells;
  const edges:Vector3[]=[];
  for (const [key,faces] of edgeFaces) {
    if (faces.length>1 && faces.every(n=>n.dot(faces[0])>1-1e-7)) continue;
    const [a,b]=key.split(",").map(Number);
    uniqueDirection(edges,vertices[b].clone().sub(vertices[a]));
  }
  return [{vertices,normals,edges,bounds:new Box3().setFromPoints(vertices)}];
}
