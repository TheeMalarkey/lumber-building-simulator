import {chromium,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const target=process.env.TIMBER_URL||'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*(error|warning)/i.test(m.text()))errors.push(m.text());});
 await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
 await page.locator('#menu-tool').click();
 await page.locator('#file-input').setInputFiles({name:'single-light.timber',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,name:'Walking light check',plots:[12],pieces:[{id:'work',item:'worklight',wood:'oak',position:[0,1.5,0],rotation:[0,0,0]}]}))});
 await page.locator('#confirm-action').click();
 if(await page.locator('#project-menu').isVisible())await page.locator('#menu-tool').click();
 await page.locator('#walk-tool').click();
 await page.keyboard.down('w');await page.waitForTimeout(1200);await page.keyboard.up('w');
 await expect(page.locator('#walk-tool')).toHaveAttribute('aria-pressed','true');
 mkdirSync('release/pages-verification',{recursive:true});
 await page.screenshot({path:'release/pages-verification/lighting-walk-live.png'});
 expect(errors).toEqual([]);
 writeFileSync('release/pages-verification/lighting-walk-live.json',JSON.stringify({target,walking:true,errors},null,2));
 console.log('Production walking near a lone Worklight: no GPU or JavaScript errors.');
}finally{await browser.close();}
