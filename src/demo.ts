import type {Piece} from './world';
import type {Vec3} from './catalog';
import {portPosition,type Wire} from './logic-ports';
export const DEMO_NAME='Timber Workshop';

/** Catalog-built workshop on one plot. Floor top 2, walls 2-10,
 * cornice 10-11, roof eaves 10 and ridge 17. All joints meet at faces. */
export function createDemo():Piece[]{
 const pieces:Piece[]=[];
 const add=(item:string,wood:string,position:Vec3,rotation:Vec3=[0,0,0],id?:string)=>{
  const p:Piece={id:id??`starter-${pieces.length}`,item,wood,position,rotation};pieces.push(p);return p;
 };
 const post=(x:number,z:number)=>{for(const y of [4,8])add('post','walnut',[x,y,z]);};
 // Raised deck: a dark foundation and a warm, flush finished floor.
 for(const [y,wood] of [[.5,'walnut'],[1.5,'oak']] as const){
  for(const x of [-8,0,8])for(const z of [-8,0,8])add('large-floor',wood,[x,y,z]);
  for(let x=-11;x<=11;x+=2)add('small-floor',wood,[x,y,13]);
 }
 for(const x of [-2,2])add('stairs','oak',[x,1,16],[0,0,0],`starter-stairs-${x}`);
 // Corners, a four-stud open entry, and recessed glass windows.
 for(const x of [-11.5,11.5])for(const z of [-11.5,7.5])post(x,z);
 for(const x of [-2.5,2.5])post(x,7.5);
 for(const x of [-9,9])add('corrugated-wall','palm',[x,6,7.5]);
 for(const x of [-5,5]){
  add('corrugated-wall-stub','palm',[x,3,7.5]);
  add('glass-pane','oak',[x,6,7.5]);
  add('corrugated-wall-stub','palm',[x,9,7.5]);
 }
 add('smooth-wall-stub','walnut',[0,9,7.5],[0,0,0],'starter-entry-lintel');
 for(const [x,item] of [[-10,'thin-corrugated-wall'],[-7,'corrugated-wall'],[-3,'corrugated-wall'],[0,'thin-corrugated-wall'],[3,'corrugated-wall'],[7,'corrugated-wall'],[10,'thin-corrugated-wall']] as const)add(item,'palm',[x,6,-11.5]);
 for(const x of [-11.5,11.5]){
  for(const z of [-9,5])add('corrugated-wall','palm',[x,6,z],[0,1,0]);
  add('thin-corrugated-wall','palm',[x,6,-2],[0,1,0]);
  for(const z of [-5,1]){
   add('corrugated-wall-stub','palm',[x,3,z],[0,1,0]);
   add('glass-pane','oak',[x,6,z],[0,1,0]);
   add('corrugated-wall-stub','palm',[x,9,z],[0,1,0]);
  }
 }
 // Cornice returns stop at the inner faces instead of intersecting.
 for(const z of [-11.5,7.5])for(const x of [-10,-6,-2,2,6,10])add('post','walnut',[x,10.5,z],[0,0,1]);
 for(const x of [-11.5,11.5]){
  for(const z of [-9,-5,-1,3])add('post','walnut',[x,10.5,z],[1,0,0]);
  for(const z of [5.5,6.5])add('tiny-floor','walnut',[x,10.5,z]);
 }
 // Exposed ceiling ties. The gables support the higher roof courses.
 for(const z of [-8,0,4]){
  for(const x of [-9,-5,-1,3,7])add('post','walnut',[x,10.5,z],[0,0,1]);
  for(const x of [9.5,10.5])add('tiny-floor','walnut',[x,10.5,z]);
 }
 for(const z of [-11.5,7.5])for(const side of [-1,1]){
  add('smooth-wall-stub','blue-spruce',[side*6,12,z]);
  for(const y of [12,14])add('smooth-wall-stub','blue-spruce',[side*2,y,z]);
 }
 // Continuous half-stud-per-stud pitches meet at x=0. Narrow end courses
 // provide one-stud overhangs with exactly the same slope.
 for(const side of [-1,1])for(const [x,y,h,d] of [[10,12,2,4],[6,14,2,4],[2,16,2,4],[13,10.5,1,2]]){
  const rotation:Vec3=[0,side<0?3:1,0];
  for(const z of [-10,-6,-2,2,6])add(`${h}-${d}-wedge`,'walnut',[side*x,y,z],rotation,`starter-roof-${pieces.length}`);
  for(const z of [-12.5,8.5])add(`${h}-${d}-x-1-wedge`,'walnut',[side*x,y,z],rotation,`starter-roof-${pieces.length}`);
 }
 // Glazed porch canopy, lower than the main ridge.
 for(const x of [-11.5,11.5])for(const z of [9.5,13.5])post(x,z);
 for(const z of [9.5,13.5])for(const x of [-10,-6,-2,2,6,10])add('post','walnut',[x,10.5,z],[0,0,1]);
 for(const x of [-10,-6,-2,2,6,10]){
  add('post','walnut',[x,11.5,9.5],[0,0,1]);
  add('post','walnut',[x,11.5,12],[1,0,0]);
  add('glass-pane','oak',[x,12.1,12],[1,0,0]);
 }
 for(let x=-11.5;x<=11.5;x++)add('tiny-glass-pane','oak',[x,12.1,9.5],[1,0,0]);
 // Waist-height rails leave a broad opening aligned with the stairs.
 for(const side of [-1,1]){
  add('corrugated-wall-stub','walnut',[side*9,3,13.5]);
  add('thin-corrugated-wall-stub','walnut',[side*6,3,13.5]);
  add('thin-corrugated-wall-stub','walnut',[side*11.5,3,11],[0,1,0]);
  for(const y of [2.5,3.5])add('tiny-floor','walnut',[side*11.5,y,12.5]);
 }
 // Workshop, storage and seating rest on their actual supporting surfaces.
 // The center aisle remains clear for walking through the open entrance.
 add('long-table','fir',[-5,4,-7]);
 add('worklight','oak',[-7.5,7.5,-7],[0,0,0],'starter-worklight');
 add('lever','oak',[-2.5,6.75,-7.8],[0,0,0],'starter-switch').logicOn=true;
 for(const [x,wood] of [[-5.5,'oak'],[-4,'birch'],[-2.5,'blue-spruce']] as const)add('tiny-tile',wood,[x,6.1,-5.8]);
 add('kitchen-cabinet','fir',[5,3.2,-9]);
 add('countertop-with-sink','birch',[5,4.9,-9]);
 add('refrigerator','oak',[9,5,-9]);
 add('floor-lamp','oak',[9,5,-3]);
 add('couch','oak',[6,4,3]);
 for(const x of [4.5,7.5])for(const z of [5.5,6.5])add('tiny-floor','walnut',[x,2.5,z]);
 add('thin-countertop','fir',[6,3.2,6]);
 add('armchair','oak',[-7,4,10.9]);
 add('square-table','fir',[7,4,11]);
 add('mundane-chair','fir',[3.5,4.5,11],[0,1,0]);
 add('mundane-chair','fir',[10,4.5,11],[0,3,0]);
 for(const x of [-9,9])add('wall-light','oak',[x,8,9]);
 // Freestanding lumber rack, clear of the building and plot edge.
 for(const z of [-8,-4])add('post','walnut',[-16,.5,z],[0,0,1]);
 for(const y of [1.5,2.5])for(const [i,wood] of ['oak','fir','birch','walnut'].entries())add('post',wood,[-17.5+i,y,-6],[1,0,0]);
 return pieces;
}
export function createDemoWires(pieces=createDemo()):Wire[]{
 const items=new Map(pieces.map(p=>[p.id,p])),from={piece:'starter-switch',port:'out'},to={piece:'starter-worklight',port:'in'};
 const a=portPosition(items.get(from.piece)!,from.port),b=portPosition(items.get(to.piece)!,to.port);
 return [{id:'starter-workbench-wire',kind:'wire',from,to,points:[[a[0]+.6,a[1],a[2]],[a[0]+.6,a[1],-5.25],[b[0],a[1],-5.25],[b[0],b[1],-5.25]]}];
}

export function createBenchmark(count: number, mixed = false): Piece[] {
  const pieces: Piece[] = [];
  const ids = ["smooth-wall", "floor", "4-4-wedge", "short-fence", "post"];
  const woods = ["oak", "walnut", "birch", "elm", "cherry"];
  const width = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++)
    pieces.push({
      id: `bench-${i}`,
      item: mixed ? ids[i % ids.length] : "smooth-wall",
      wood: mixed ? woods[Math.floor(i / 7) % woods.length] : "oak",
      position: [(i % width) * 5, 4, Math.floor(i / width) * 5],
      rotation: [0, i % 4, 0],
    });
  return pieces;
}
