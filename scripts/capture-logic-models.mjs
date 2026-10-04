import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1150}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'||/GL_INVALID/.test(m.text()))errors.push(m.text());});
 await mkdir('artifacts',{recursive:true});
 for(const view of ['all','lever']){
  await page.goto('http://127.0.0.1:5178/scripts/logic-model-preview.html?view='+view);
  await page.waitForSelector('body[data-ready="true"]');
  await page.setViewportSize({width:1440,height:view==='lever'?540:1230});
  await page.screenshot({path:`artifacts/logic-models-${view}-${process.argv[2]??'after'}.png`,fullPage:true});
 }
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Captured model inspection views without rendering errors.');
} finally {await browser.close();}
