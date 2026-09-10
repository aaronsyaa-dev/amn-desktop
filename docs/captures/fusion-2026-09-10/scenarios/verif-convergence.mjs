// Deux points restés en suspens : A converge-t-il à l'écran ? la file finit-elle vide ?
import { chromium } from 'playwright-core';
const WEB='http://127.0.0.1:4280', API='http://127.0.0.1:4172';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const msgs=async()=>{const r=await fetch(`${API}/v1/collections/messages`,{headers:{Authorization:'Bearer audit-jeton'}});const{records}=await r.json();return records.filter(x=>!x.deleted);};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await b.newContext({viewport:{width:1280,height:800}});
await ctx.addInitScript(()=>{try{localStorage.setItem('amn.welcome.lastShown',new Date().toISOString().slice(0,10));}catch{}});
const p=await ctx.newPage();
await p.goto(WEB,{waitUntil:'networkidle'});
await p.locator('input[name="email"]').fill('demo.interne@exemple.test');
await p.locator('input[name="password"]').fill('Demo-2026-Interne');
await p.locator('button:has-text("Se connecter")').click();
await p.waitForFunction(()=>!document.querySelector('input[name="password"]'),null,{timeout:20000});
await p.goto(`${WEB}/#/team`,{waitUntil:'networkidle'});
await sleep(6000);
const cible=(await msgs()).filter(m=>String(m.data.body).startsWith('FUSION C1')).pop();
console.log('SERVEUR   :', JSON.stringify({body:cible.data.body,pinned:!!cible.data.pinned,reactions:cible.data.reactions}));
const vu=await p.evaluate((corps)=>{
  const el=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&e.textContent?.trim()===corps);
  let n=el; for(let i=0;i<8&&n;i+=1){ if(n.innerText?.includes('👍')) return {bulle_montre_le_pouce:true, extrait:n.innerText.slice(0,120)}; n=n.parentElement; }
  return {bulle_montre_le_pouce:false, page_contient_pouce:document.body.innerText.includes('👍')};
},cible.data.body);
console.log('ÉCRAN DE A:', JSON.stringify(vu));
console.log('FILE      :', await p.evaluate(()=>localStorage.getItem('amn.sync.__envoi')));
await p.screenshot({path:'/home/user/amn-desktop/docs/captures/fusion-2026-09-10/C1-convergence-A.png'});
await b.close();
