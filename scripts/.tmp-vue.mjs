/* La boucle visuelle : capture un écran, dans l'état demandé. */
const { chromium } = await import('playwright-core');
const a=(ms)=>new Promise(r=>setTimeout(r,ms));
const route=process.env.ROUTE||'#/';
const sortie=process.env.SORTIE||'/tmp/e2e/vue.png';
const vp=(process.env.VP||'1440x900').split('x').map(Number);
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const p=await (await nav.newContext({viewport:{width:vp[0],height:vp[1]}})).newPage();
await p.goto('http://127.0.0.1:4180/'); await a(2200);
if(process.env.E){
  await p.locator('input[name="email"]').fill(process.env.E);
  await p.locator('input[name="password"]').fill(process.env.P);
  await p.locator('button:has-text("Se connecter")').click();
  for(let i=0;i<20 && (await p.content()).includes('name="password"');i+=1) await a(1000);
  await a(2200);
}
await p.goto('http://127.0.0.1:4180/'+route); await a(2500);
if(process.env.SURVOL){ await p.locator(process.env.SURVOL).first().hover().catch(()=>{}); await a(600); }
await p.screenshot({path:sortie,fullPage:process.env.PLEINE==='1'});
await nav.close();
console.log('capturé →',sortie);
