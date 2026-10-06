import { chromium, expect } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { writeFileSync } from "node:fs";
const target=process.env.TIMBER_URL || "http://127.0.0.1:5179/";
const browser=await chromium.launch({channel:"chrome",headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}), errors=[];
page.on("pageerror",e=>errors.push(e.message));
await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==="true");
const piece=(id,item,position,rotation=[0,0,0])=>({id,item,position,rotation,wood:"oak"});
await page.locator("#menu-tool").click();
await page.locator("#file-input").setInputFiles({name:"precision-check.timber",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({version:1,name:"Precision building",plots:[12],pieces:[
  piece("step","small-floor",[-5,.5,5]),piece("ramp","4-4-wedge",[5,2,0]),
  {...piece("upper","4-4-wedge",[5,3,0],[2,0,0]),wood:"birch"},piece("table","long-table",[0,5,-7]),
]}))});
await page.locator("#confirm-action").click();await page.locator("#menu-tool").click();
await page.locator("#home").click();
const r=await page.locator("#viewport>canvas").boundingBox();
const c=new PerspectiveCamera(45,r.width/r.height,.1,4000);c.position.set(40,30,44);c.lookAt(0,4,0);c.updateMatrixWorld();
const project=p=>{const v=new Vector3(...p).project(c);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];};
await page.mouse.click(...project([-5,1,5]));await page.locator("#duplicate-tool").click();
await page.locator("#hold-position").click();
await page.locator("#step-buttons-details summary").click();
for (let i=0;i<3;i++) {
  await page.locator('[data-nudge="up"]').click();await page.locator('[data-nudge="forward"]').click();
  await page.locator("#commit-preview").click();
}
await expect(page.locator("#piece-count")).toHaveText("7 pieces");
await page.keyboard.press("Escape");
await page.mouse.click(...project([5,5,0]));
await page.locator("#home").click();await page.waitForTimeout(1000);
c.position.set(40,30,44);c.lookAt(0,4,0);c.updateMatrixWorld();
const center=new Vector3(5,3,0), depth=-center.clone().applyMatrix4(c.matrixWorldInverse).z;
const scale=depth*2*Math.tan(c.fov*Math.PI/360)*90/r.height;
const handle=center.clone().add(new Vector3(0,scale*.7,0));
await page.mouse.move(...project(handle.toArray()));await page.mouse.down();
await page.mouse.move(...project(handle.clone().add(new Vector3(0,-1,0)).toArray()),{steps:8});await page.mouse.up();
await page.locator("#menu-tool").click();
const downloading=page.waitForEvent("download");await page.locator("#export").click();
const download=await downloading,stream=await download.createReadStream(),chunks=[];
for await(const chunk of stream)chunks.push(chunk);
const exported=JSON.parse(Buffer.concat(chunks).toString("utf8"));
expect(exported.pieces.find(p=>p.id==="upper").position).toEqual([5,2,0]);
const steps=exported.pieces.filter(p=>!["step","ramp","upper","table"].includes(p.id));
expect(steps.map(p=>p.position).sort((a,b)=>a[1]-b[1])).toEqual([[-5,1.5,4],[-5,2.5,3],[-5,3.5,2]]);
await page.locator("#home").click();await page.waitForTimeout(5000);
await page.locator("#step-buttons-details summary").click();
await page.screenshot({path:"artifacts/precision-building.png"});
await page.setViewportSize({width:390,height:844});
await page.locator("#step-buttons-details summary").click();
await expect(page.locator('[data-nudge="down"]')).toBeVisible();
expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
expect(errors).toEqual([]);
writeFileSync("artifacts/precision-live-check.json",JSON.stringify({target,errors,airSteps:steps.map(p=>p.position),complementaryWedge:[5,2,0],axisArrowMove:true,compactFits:true},null,2));
await browser.close();console.log("Production controls verified: held stair-step copies, shape collision, axis arrow move, export and compact layout.");
