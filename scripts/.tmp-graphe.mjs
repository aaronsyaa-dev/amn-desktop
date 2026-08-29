const { chromium } = await import('playwright-core');
const a=(ms)=>new Promise(r=>setTimeout(r,ms));
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const p=await (await nav.newContext({viewport:{width:1440,height:1000}})).newPage();
const erreurs=[]; p.on('pageerror',e=>erreurs.push(e.message));
await p.goto('http://127.0.0.1:4180/'); await a(2500);
await p.locator('input[name="email"]').fill(process.env.E);
await p.locator('input[name="password"]').fill(process.env.P);
await p.locator('button:has-text("Se connecter")').click();
for(let i=0;i<20 && (await p.content()).includes('name="password"');i+=1) await a(1000);
await a(2000);
await p.goto('http://127.0.0.1:4180/#/notes'); await a(3000);

await p.getByRole('button',{name:'Graphe'}).first().click(); await a(1500);
await p.screenshot({path:'/tmp/e2e/graphe-large.png',fullPage:true});

const m=await p.evaluate(()=>{
  const btns=[...document.querySelectorAll('main button[title]')].filter(b=>b.querySelector('span[aria-hidden]'));
  const r=btns.map(b=>{const x=b.getBoundingClientRect();return {t:b.title.slice(0,22),w:Math.round(x.width),h:Math.round(x.height),x:Math.round(x.left),y:Math.round(x.top)};});
  // paires les plus proches (centre à centre)
  let pire=null;
  for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){
    const dx=(r[i].x+r[i].w/2)-(r[j].x+r[j].w/2), dy=(r[i].y+r[i].h/2)-(r[j].y+r[j].h/2);
    const d=Math.hypot(dx,dy);
    if(!pire||d<pire.d) pire={d:Math.round(d),a:r[i].t,b:r[j].t};
  }
  const svg=[...document.querySelectorAll('main svg')].find(x=>x.querySelector('line'));
  return {noeuds:r.length, traits:svg?svg.querySelectorAll('line').length:-1, pire,
    entete:(document.querySelector('main')||document.body).innerText.split('\n').filter(Boolean).slice(0,6)};
});
console.log('nœuds:',m.noeuds,' traits:',m.traits,' paire la plus serrée:',JSON.stringify(m.pire));
console.log('entête:',JSON.stringify(m.entete));

// cliquer un nœud ramène à la liste, note ouverte
const n0=p.locator('main button[title]').filter({has:p.locator('span[aria-hidden]')}).first();
const titre=await n0.getAttribute('title');
await n0.click(); await a(1500);
const ouvert=await p.locator('input[placeholder="Titre de la note"]').first().inputValue().catch(()=>'(aucun)');
console.log('clic sur «'+titre+'» → éditeur sur «'+ouvert+'»', ouvert===titre?'✓':'✗');

// à 390 px
await p.setViewportSize({width:390,height:844}); await a(1200);
await p.getByRole('button',{name:'Graphe'}).first().click(); await a(1500);
await p.screenshot({path:'/tmp/e2e/graphe-390.png',fullPage:true});
const deb=await p.evaluate(()=>{const d=document.documentElement;return {debordePage:d.scrollWidth-d.clientWidth};});
console.log('à 390 px, débordement de page:',deb.debordePage,'px',deb.debordePage<=1?'✓':'✗');
console.log(erreurs.length?'erreurs : '+erreurs.slice(0,3).join(' | '):'aucune erreur de page');
await nav.close();
