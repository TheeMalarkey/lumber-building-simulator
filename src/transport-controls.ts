import type {Editor} from './editor';

export class TransportControls {
 private panel=document.createElement('div');
 private run=document.createElement('button');private reset=document.createElement('button');
 private revision=-1;private generation=-1;
 constructor(private e:Editor){
  this.panel.className='transport-controls';this.panel.hidden=true;this.panel.setAttribute('aria-label','Wood transport test');
  this.run.id='transport-run';this.run.title='Simulate placed Test Planks. Editing resets wood to its saved starting positions.';
  this.reset.id='transport-reset';this.reset.textContent='Reset';this.reset.title='Stop and restore plank starting positions';
  this.panel.append(this.run,this.reset);document.getElementById('viewport')!.append(this.panel);
  this.run.onclick=()=>{
   const t=e.view.transport;
   if(!t.simulation.running){if(![...e.world.pieces.values()].some(p=>p.item==='loose-plank')){e.toast('Place a Test Plank from Build → Transport first.');return;}e.view.camera.setWalking(false);e.pickSelection(null);t.start();}
   else t.paused=!t.paused;
   this.tick();e.view.renderer.domElement.focus({preventScroll:true});
  };
  this.reset.onclick=()=>{e.view.transport.stop();this.tick();e.view.renderer.domElement.focus({preventScroll:true});};
 }
 tick(){
  if(this.revision!==this.e.world.revision||this.generation!==this.e.world.generation){this.revision=this.e.world.revision;this.generation=this.e.world.generation;this.panel.hidden=![...this.e.world.pieces.values()].some(p=>p.item==='straight-conveyor'||p.item==='loose-plank');}
  const t=this.e.view.transport,text=t.simulation.running?t.paused?'Resume wood':'Pause wood':'Test wood';if(this.run.textContent!==text)this.run.textContent=text;this.reset.hidden=!t.simulation.running;
 }
}
