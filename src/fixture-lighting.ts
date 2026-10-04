import {Group,PointLight,SpotLight,Vector3} from 'three';
import {emittersFor,type Emitter} from './light-fixtures';
import {quaternionRotation} from './placement';
import {CHUNK,type World,type Piece} from './world';

/** Constant GPU light counts avoid shader recompilation as fixtures are edited.
 * Spatial candidate queries visit light-only chunks, not the whole build. */
export class FixtureLighting {
  root=new Group();
  points=Array.from({length:2},()=>new PointLight(0xfff0d5,0,22,2));
  spots=Array.from({length:4},()=>new SpotLight(0xfff4df,0,28,Math.PI/3,.5,2));
  private revision=-1;
  private lastTime=-Infinity;
  private lastOrigin=new Vector3(Infinity,Infinity,Infinity);
  activeIds:string[]=[];
  invalidate(){this.revision=-1;}
  constructor(){
    this.root.name='Bounded fixture illumination';this.root.visible=false;
    for(const light of [...this.points,...this.spots]){
      light.castShadow=true;light.shadow.mapSize.set(256,256);light.shadow.bias=-.001;light.shadow.normalBias=.04;
      light.shadow.autoUpdate=false;light.shadow.camera.near=.1;
      this.root.add(light);
      if(light instanceof SpotLight)this.root.add(light.target);
    }
  }
  update(world:World,camera:Vector3,origin:Vector3,now:number,quality:string){
    const originChanged=!origin.equals(this.lastOrigin);
    if(now-this.lastTime<250 && this.revision===world.revision && !originChanged)return;
    const changed=this.revision!==world.revision||originChanged;
    this.revision=world.revision;this.lastTime=now;this.lastOrigin.copy(origin);
    const candidates:{p:Piece;e:Emitter;position:Vector3;direction?:Vector3;distance:number;key:string}[]=[];
    const cx=Math.floor(camera.x/CHUNK),cy=Math.floor(camera.y/CHUNK),cz=Math.floor(camera.z/CHUNK);
    for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(let z=cz-1;z<=cz+1;z++)
      for(const id of world.lightChunks.get(`${x},${y},${z}`)??[]){
        const p=world.pieces.get(id)!;if(p.lightOn===false)continue;
        const rotation=quaternionRotation(p.rotation);
        emittersFor(p.item).forEach((e,i)=>{
          const position=new Vector3(...e.offset).applyEuler(rotation).add(new Vector3(...p.position));
          const distance=position.distanceToSquared(camera);if(distance>64*64)return;
          candidates.push({p,e,position,distance,key:id+':'+i,direction:e.direction?new Vector3(...e.direction).applyEuler(rotation).normalize():undefined});
        });
      }
    candidates.sort((a,b)=>a.distance-b.distance||a.key.localeCompare(b.key));
    const picked=[...candidates.filter(c=>!c.direction).slice(0,2),...candidates.filter(c=>!!c.direction).slice(0,4)];
    let point=0,spot=0;this.activeIds=[];
    for(const c of picked){
      const light=c.direction?this.spots[spot++]:this.points[point++];
      const previous=light.userData.key;light.userData.key=c.key;
      light.position.copy(c.position).sub(origin);light.intensity=c.e.intensity*Math.min(1,(64-Math.sqrt(c.distance))/16);light.distance=c.e.range;
      if(light instanceof SpotLight){light.angle=c.e.angle!;light.target.position.copy(light.position).add(c.direction!);}
      // Cached shadows refresh for edits, pool reassignment and floating-origin shifts.
      const shadows=quality!=='performance';
      const shadowChange=light.castShadow!==shadows;light.castShadow=shadows;
      light.shadow.needsUpdate=changed||previous!==c.key||shadowChange;
      this.activeIds.push(c.key);
    }
    for(const light of [...this.points.slice(point),...this.spots.slice(spot)]){
      light.intensity=0;light.userData.key=undefined;
    }
    this.root.visible=this.activeIds.length>0;
  }
}
