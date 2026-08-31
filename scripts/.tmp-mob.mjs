const { chromium } = await import('playwright-core');
const a=(ms)=>new Promise(r=>setTimeout(r,ms));
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const p=await (await nav.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();
await p.goto('http://127.0.0.1:4180/'); await a(2200);
await p.locator('input[name="email"]').fill(process.env.E);
await p.locator('input[name="password"]').fill(process.env.P);
await p.locator('button:has-text("Se connecter")').click();
for(let i=0;i<20 && (await p.content()).includes('name="password"');i+=1) await a(1000);
await a(2500);
await p.mouse.click(195,800); await a(600); // passer un éventuel welcome
const routes=(process.env.ROUTES||'').split(',').filter(Boolean);
if(routes.length===0){const r=await p.evaluate(()=>[...new Set([...document.querySelectorAll('a[href^="#/"]')].map(x=>x.getAttribute('href')))]);routes.push(...r);}
console.log('routes:',routes.length);
let i=0;
for(const r of routes){
  await p.goto('http://127.0.0.1:4180/'+r); await a(1600);
  const nom=r.replace(/[#\/]/g,'_')||'_';
  await p.screenshot({path:`/tmp/e2e/mob/${process.env.PREFIX}${String(i).padStart(2,'0')}${nom}.png`});
  i++;
}
await nav.close();
console.log('capturés:',i);
