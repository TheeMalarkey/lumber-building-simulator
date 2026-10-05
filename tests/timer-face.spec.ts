import {test,expect} from '@playwright/test';

test('timer faces visibly animate independent of output, without rebuilding housings or saving runtime state',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID/.test(m.text()))errors.push(m.text());});
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 // Manually stepped snapshots do not represent live rendering throughput.
 await page.addStyleTag({content:'#fps{visibility:hidden}'});
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([
  {id:'source',item:'button',wood:'oak',position:[-7,.25,-4],rotation:[0,0,0]},
  {id:'delay',item:'signal-delay',wood:'oak',position:[-2,1,0],rotation:[0,0,0],timing:12},
  {id:'sustain',item:'signal-sustain',wood:'oak',position:[2,1,0],rotation:[0,0,0],timing:12}
 ],[12],['delay','sustain'].map(id=>({id:'wire-'+id,from:{piece:'source',port:'out'},to:{piece:id,port:'in'},points:[]})));e.pickSelection(null);e.view.sync(true);const c=e.view.camera;c.camera.position.set(0,4.6,8);c.controls.target.set(0,1,0);c.controls.update();e.view.grid.visible=false;});
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.logic.timerFaces?.root.children.length)).toBe(2);
 const state=()=>page.evaluate(()=>{const e=(window as any).timber.editor,c=e.view.logic.circuit;return {delay:c.timerDisplay('delay'),sustain:c.timerDisplay('sustain'),output:c.output('delay'),meters:e.view.logic.timerFaces.meters.count};});
 await page.evaluate(()=>{const logic=(window as any).timber.editor.view.logic;logic.tick=()=>{};logic.circuit.press('source');logic.refresh();});
 await expect.poll(async()=>(await state()).meters).toBe(2);
 expect((await state()).output).toBe(false);expect((await state()).sustain.level).toBe(1);
 const pixels=async()=>page.evaluate(async()=>{
  const {Vector3}=await import('/node_modules/three/build/three.module.js');const v=(window as any).timber.editor.view;
  v.renderer.setAnimationLoop(null);v.logic.refresh();v.tick();const gl=v.renderer.getContext();
  const samples=[[-1.45,.2696,1.0002],[-1.45,.3816,1.0002],[-1.45,.9416,1.0002],[-1.45,1.1656,1.0002],[2.55,.7176,1.0002],[2.55,1.1656,1.0002],[-2.4,.28,.958],[1.6,.28,.958],...Array.from({length:51},(_,i)=>[-1.45,.2696+i*.112/50,1.0002])];
  return samples.map(p=>{const q=new Vector3(...p).project(v.camera.camera),pixel=new Uint8Array(4);gl.readPixels(Math.floor((q.x+1)*gl.drawingBufferWidth/2),Math.floor((q.y+1)*gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel];});
 });
 const cyan=([r,g,b]:number[])=>g>r+80&&b>r+100;
 let colors=await pixels();expect(colors.map(cyan).slice(0,8)).toEqual([true,false,false,false,true,true,true,true]);
 await page.screenshot({path:'artifacts/timer-faces-powered.png'});
 await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.advance(200));colors=await pixels();
 expect(colors.slice(0,2).map(cyan)).toEqual([true,true]);
 // Dark cyan seams must remain distinguishable between adjacent lit rows.
 expect(Math.min(...colors.slice(8).map(pixel=>pixel[1]))).toBeLessThan(colors[0][1]*.6);
 await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.advance(200));await pixels();
 await expect.poll(async()=>(await state()).meters).toBe(3);
 const housing=await page.evaluate(()=>{const v=(window as any).timber.editor.view;return [...v.loaded.values()].flatMap((g:any)=>g.children).filter((m:any)=>m.name.startsWith('signal-')).map((m:any)=>[m.uuid,m.geometry.uuid]);});
 await page.waitForTimeout(300);await page.screenshot({path:'artifacts/timer-faces-pulse.png'});
 await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.advance(1000));colors=await pixels();
 await expect.poll(async()=>(await state()).delay.mask).toBe(192);
 expect((await state()).sustain.level).toBeCloseTo(1350/2400);expect((await state()).output).toBe(false);
 expect(colors.map(cyan).slice(0,8)).toEqual([false,false,true,false,true,false,false,false]);
 expect(await page.evaluate(()=>{const v=(window as any).timber.editor.view;return [...v.loaded.values()].flatMap((g:any)=>g.children).filter((m:any)=>m.name.startsWith('signal-')).map((m:any)=>[m.uuid,m.geometry.uuid]);})).toEqual(housing);
 await page.waitForTimeout(300);await page.screenshot({path:'artifacts/timer-faces-countdown.png'});
 const revision=await page.evaluate(()=>(window as any).timber.editor.world.revision);
 await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.advance(1400));colors=await pixels();expect(colors.some(cyan)).toBe(false);
 await expect.poll(async()=>(await state()).meters).toBe(0);
 expect(await page.evaluate(()=>(window as any).timber.editor.world.revision)).toBe(revision);
 const exported=await page.evaluate(()=>(window as any).timber.editor.project);
 for(const p of exported.pieces)expect(Object.keys(p).sort()).toEqual(p.item==='button'?['id','item','position','rotation','wood']:['id','item','position','rotation','timing','wood']);
 await page.evaluate(p=>{const e=(window as any).timber.editor;e.world.load(p.pieces,p.plots,p.wires);delete e.view.logic.tick;e.view.tick();},exported);
 await expect.poll(async()=>(await state()).meters).toBe(0);expect(errors).toEqual([]);
});

test('live frame timing drives the faces and distant timer overlays follow resident chunks',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([
  {id:'source',item:'button',wood:'oak',position:[-7,.25,-4],rotation:[0,0,0]},
  {id:'delay',item:'signal-delay',wood:'oak',position:[-2,1,0],rotation:[0,0,0],timing:12},
  {id:'sustain',item:'signal-sustain',wood:'oak',position:[2,1,0],rotation:[0,0,0],timing:12},
  {id:'far-switch',item:'lever',wood:'oak',position:[2043,.75,0],rotation:[0,0,0],logicOn:true},
  {id:'far-sustain',item:'signal-sustain',wood:'oak',position:[2048,1,0],rotation:[0,0,0],timing:12}
 ],null,[...['delay','sustain'].map(id=>({id:'wire-'+id,from:{piece:'source',port:'out'},to:{piece:id,port:'in'},points:[]})),{id:'far-wire',from:{piece:'far-switch',port:'out'},to:{piece:'far-sustain',port:'in'},points:[]}]);
 const c=e.view.camera;c.camera.position.set(0,4.6,8);c.controls.target.set(0,1,0);c.controls.update();e.view.renderDistance=192;e.view.sync(true);});
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.input('far-sustain'))).toBe(true);
 expect(await page.evaluate(()=>(window as any).timber.editor.view.logic.timerFaces.meters.count)).toBe(0);
 await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.press('source'));
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.timerDisplay('delay').mask)).toBeGreaterThan(1);
 expect(await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.output('delay'))).toBe(false);
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.timerDisplay('sustain').input)).toBe(false);
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.timerDisplay('sustain').level)).toBeLessThan(.8);
 expect(await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.output('sustain'))).toBe(true);
 const locations=await page.evaluate(async()=>{const {Matrix4}=await import('/node_modules/three/build/three.module.js'),mesh=(window as any).timber.editor.view.logic.timerFaces.meters,m=new Matrix4(),x=[];for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);x.push(m.elements[12]);}return x;});
 expect(locations.length).toBeGreaterThan(1);expect(locations.every(x=>Math.abs(x)<10)).toBe(true);
 await page.evaluate(()=>{const v=(window as any).timber.editor.view,c=v.camera;c.camera.position.set(2048,6,8);c.controls.target.set(2048,1,0);c.controls.update();v.sync(true);});
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.logic.timerFaces.meters.count)).toBe(1);
 expect(await page.evaluate(async()=>{const {Matrix4}=await import('/node_modules/three/build/three.module.js'),v=(window as any).timber.editor.view,m=new Matrix4();v.logic.timerFaces.meters.getMatrixAt(0,m);return m.elements[12];})).toBeCloseTo(2048.55,2);
});
