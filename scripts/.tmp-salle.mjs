const { chromium } = await import('playwright-core');
const a=(ms)=>new Promise(r=>setTimeout(r,ms));
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const p=await (await nav.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:4180/'); await a(2200);
await p.locator('input[name="email"]').fill(process.env.E);
await p.locator('input[name="password"]').fill(process.env.P);
await p.locator('button:has-text("Se connecter")').click();
for(let i=0;i<20 && (await p.content()).includes('name="password"');i+=1) await a(1000);
await a(2500);
await p.mouse.click(720,850); await a(800); // passer le welcome
await p.goto('http://127.0.0.1:4180/#/salle'); await a(3000);
await p.screenshot({path:'/tmp/e2e/sv-salle.png'});
console.log('points:', await p.evaluate(()=>document.querySelectorAll('.sv-souffle-calme,.sv-souffle-tendu').length));
await nav.close();
