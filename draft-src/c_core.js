/* ================= core helpers ================= */
const $=(q,r=document)=>r.querySelector(q), $$=(q,r=document)=>[...r.querySelectorAll(q)];
const NS='http://www.w3.org/2000/svg';
const RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;
function S_(tag,attrs,parent){const e=document.createElementNS(NS,tag);if(attrs)for(const k in attrs){if(attrs[k]!==undefined&&attrs[k]!==null)e.setAttribute(k,attrs[k]);}if(parent)parent.appendChild(e);return e;}
function H(tag,attrs,html){const e=document.createElement(tag);if(attrs)for(const k in attrs){if(k==='class')e.className=attrs[k];else e.setAttribute(k,attrs[k]);}if(html!==undefined)e.innerHTML=html;return e;}
const fmt=(v,d=2)=>{if(!isFinite(v))return '—';const a=Math.abs(v);if(a!==0&&(a<1e-3||a>=1e5))return v.toExponential(2).replace('e',' × 10^');return v.toFixed(d);};
const uSp=' '; /* narrow no-break space between number and unit */

/* ---------- saved progress (this browser only) ---------- */
const KEY='physiquest-v3';
let ST={xp:0,done:{},labSeen:{},mockBest:null,badges:{},mockBy:{},lastCls:null,gen:{},reports:[],neetBest:null,jeeBest:null,acct:null};
/* storage can be missing (private mode), full, or damaged: every read and write is guarded, a damaged save is
   kept aside as a backup instead of being lost, and each field is checked before use */
let STORE_OK=true;
try{const raw=localStorage.getItem(KEY);if(raw){let o=null;try{o=JSON.parse(raw);}catch(e){try{localStorage.setItem(KEY+'-damaged',raw);}catch(_){}}
 if(o&&typeof o==='object'&&!Array.isArray(o))ST=Object.assign(ST,o);}}catch(e){STORE_OK=false;}
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
['done','labSeen','badges','mockBy','gen'].forEach(k=>{if(!isObj(ST[k]))ST[k]={};});if(!Array.isArray(ST.reports))ST.reports=[];
if(typeof ST.xp!=='number'||!isFinite(ST.xp)||ST.xp<0)ST.xp=0;
let saveT=null;
function saveNow(){clearTimeout(saveT);saveT=null;try{localStorage.setItem(KEY,JSON.stringify(ST));STORE_OK=true;}catch(e){STORE_OK=false;
 /* storage full: drop old reports and the error log, then try once more */
 try{ST.reports=(ST.reports||[]).slice(-5);ST.errs=[];localStorage.setItem(KEY,JSON.stringify(ST));STORE_OK=true;}catch(_){}}}
/* many quick changes (several right answers in a row) are written once, a moment later */
function save(){if(!saveT)saveT=setTimeout(saveNow,250);}
window.addEventListener('pagehide',saveNow);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow();});

/* ---------- crash protection: log the error, keep the app running ---------- */
function logErr(e,where){try{const m=String((e&&(e.message||e.reason&&e.reason.message))||e||'error').slice(0,160);
 ST.errs=(Array.isArray(ST.errs)?ST.errs:[]).concat([{m,w:String(where||'').slice(0,40),v:curView||'',t:Date.now()}]).slice(-8);save();console.error('PhysiQuest',where||'',e);}catch(_){}}
/* harmless browser notices (resize timing, other sites’ scripts) are not app errors */
const NOISE=/ResizeObserver loop|^Script error\.?$/;
window.addEventListener('error',e=>{const m=String(e.message||'');if(NOISE.test(m))return;logErr(e.error||m,'window');});
window.addEventListener('unhandledrejection',e=>logErr(e.reason,'promise'));
function safe(f,where){try{return f();}catch(e){logErr(e,where);}}
/* used once by the Android app to bring progress across from the older version */
window.pqImport=function(json){try{if(!json)return 0;const o=JSON.parse(json);if(!isObj(o))return 0;if(ST.xp>0&&Object.keys(ST.done).length)return 0;ST=Object.assign(ST,o);saveNow();return 1;}catch(e){logErr(e,'import');return 0;}};

const RANKS=[{n:'Spark',xp:0},{n:'Current',xp:100},{n:'Voltage',xp:250},{n:'Field',xp:450},{n:'Flux',xp:700},{n:'Quantum',xp:1000},{n:'Photon',xp:1500},{n:'Nova',xp:2100}];
function rankOf(xp){let i=0;for(let k=0;k<RANKS.length;k++)if(xp>=RANKS[k].xp)i=k;const next=RANKS[i+1];return{i,name:RANKS[i].n,next,frac:next?(xp-RANKS[i].xp)/(next.xp-RANKS[i].xp):1};}
function updateXP(){const r=rankOf(ST.xp);$('#xpNum').textContent=ST.xp+' XP';$('#xpRank').textContent=r.name;$('#xpLvl').textContent=r.i+1;$('#xpRing').setAttribute('stroke-dashoffset',(94.2*(1-r.frac)).toFixed(1));if(window.renderXPPanel)renderXPPanel();}

/* award XP once per activity id */
function award(id,xp,label){if(ST.done[id])return false;ST.done[id]=Date.now();ST.xp+=xp;save();toast('+'+xp+' XP',label);burst();updateXP();checkBadges();if(window.refreshPath)refreshPath();return true;}

/* ---------- badges ---------- */
const BADGES=[
 {id:'first-spark',name:'First Spark',desc:'Finish your first activity',icon:'i-home',c:'#19e0dc',test:()=>Object.keys(ST.done).length>=1},
 {id:'unit-wizard',name:'Unit Wizard',desc:'Practice: SI units and notation',icon:'i-plan',c:'#a8f060',test:()=>ST.done['p-units']&&ST.done['p-sci']},
 {id:'trajectory',name:'Trajectory Tamer',desc:'Lab: land a projectile on target',icon:'i-lab',c:'#19e0dc',test:()=>ST.done['lab-proj-target']},
 {id:'free-body',name:'Free-Body Hero',desc:'Studio: a correct force diagram',icon:'i-studio',c:'#ffb547',test:()=>ST.done['fbd']},
 {id:'energy',name:'Energy Keeper',desc:'Lab: set a spring to 0.50 J',icon:'i-practice',c:'#ff8a65',test:()=>ST.done['lab-spring-energy']},
 {id:'wave',name:'Wave Rider',desc:'Lab: make a 2.0 m/s wave',icon:'i-lab',c:'#ff5bd6',test:()=>ST.done['lab-wave-speed']},
 {id:'ray',name:'Ray Tracer',desc:'Studio: aim a refracted ray',icon:'i-studio',c:'#ffe06b',test:()=>ST.done['ray']},
 {id:'circuit',name:'Circuit Architect',desc:'Circuit lab: finish the desk-light project',icon:'i-circuit',c:'#ffe06b',test:()=>ST.done['c-project']},
 {id:'flux',name:'Flux Master',desc:'Lesson: both transformer checks',icon:'i-lesson',c:'#ff5bd6',test:()=>ST.done['lesson-q1']&&ST.done['lesson-q2']},
 {id:'exam',name:'Exam Ready',desc:'Score 80 % or more on any class mock test',icon:'i-mock',c:'#4cf0a0',test:()=>ST.mockBest!==null&&ST.mockBest>=0.8},
 {id:'explorer',name:'Lab Explorer',desc:'Open all four lab simulations',icon:'i-lab',c:'#bfb2e4',test:()=>['proj','spring','wave','field'].every(k=>ST.labSeen[k])}
];
/* one badge per class: every chapter quick check in that class */
[[6,'Curious Mind','#a8f060'],[7,'Circuit Starter','#ffe06b'],[8,'Force Finder','#ffb547'],[9,'Motion Master','#ff8a65'],[10,'Light Bender','#ff5bd6'],[11,'Mechanics Ace','#19e0dc'],[12,'Field Theorist','#7aa8ff']].forEach(([c,name,col])=>BADGES.push({id:'class-'+c,name,desc:`Every quick check in Class ${c}`,icon:'i-book',c:col,test:()=>clsDone(c)}));
function badgeSVG(b,big){const id='bg'+b.id.replace(/\W/g,'');return `<svg viewBox="0 0 84 94" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b.c}"/><stop offset=".55" stop-color="#44158f"/><stop offset="1" stop-color="${b.c}"/></linearGradient></defs>
 <path d="M42 3 79 24v46L42 91 5 70V24z" fill="url(#${id})" stroke="${b.c}" stroke-width="2"/>
 <path d="M42 13 70 29v36L42 81 14 65V29z" fill="#170a3a" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>
 <svg x="24" y="29" width="36" height="36" style="color:${b.c}"><use href="#${b.icon}"/></svg>
 <path d="M14 65 42 81 70 65" fill="none" stroke="${b.c}" stroke-width="2" opacity=".6"/></svg>`;}
function checkBadges(){for(const b of BADGES){if(!ST.badges[b.id]&&b.test()){ST.badges[b.id]=Date.now();save();setTimeout(()=>{toast('Badge unlocked: '+b.name,b.desc,badgeSVG(b));burst(1.6);},700);}}if(window.renderBadges)renderBadges();}

/* ---------- toasts & spark burst ---------- */
function toast(title,sub,art){const t=H('div',{class:'toast'},(art||'<svg viewBox="0 0 24 24" style="color:#19e0dc;width:28px;height:28px"><use href="#i-badge"/></svg>')+`<div><b>${title}</b><span>${sub||''}</span></div>`);$('#toasts').appendChild(t);setTimeout(()=>{t.style.transition='opacity .4s,transform .4s';t.style.opacity='0';t.style.transform='translateY(8px)';setTimeout(()=>t.remove(),450);},3800);}
const FX={cv:null,ctx:null,parts:[],running:false};
function burst(power){if(RM)return;power=power||1;const cv=$('#fx');if(!FX.cv){FX.cv=cv;FX.ctx=cv.getContext('2d');}
 const dpr=Math.min(devicePixelRatio||1,2);cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;FX.ctx.setTransform(dpr,0,0,dpr,0,0);
 const ox=innerWidth-110,oy=innerHeight-70,cols=['#19e0dc','#ff5bd6','#ffe06b','#a8f060','#f4efff'];
 for(let i=0;i<70*power;i++){const a=-Math.PI/2+(Math.random()-.5)*2.2,sp=260+Math.random()*420*power;FX.parts.push({x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,c:cols[i%5],w:1.5+Math.random()*2});}
 if(!FX.running){FX.running=true;let last=performance.now();const step=t=>{const dt=Math.min(.033,(t-last)/1000);last=t;const c=FX.ctx;c.clearRect(0,0,innerWidth,innerHeight);
  FX.parts=FX.parts.filter(p=>p.life>0);for(const p of FX.parts){p.vy+=900*dt;p.vx*=.985;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt*.8;c.globalAlpha=clamp(p.life,0,1);c.strokeStyle=p.c;c.lineWidth=p.w;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.03,p.y-p.vy*.03);c.stroke();}
  c.globalAlpha=1;if(FX.parts.length)requestAnimationFrame(step);else{FX.running=false;c.clearRect(0,0,innerWidth,innerHeight);}};requestAnimationFrame(step);}}

/* ---------- one animation loop; only the visible view's animations run ---------- */
const ANIMS=new Set();let lastT=0,loopOn=false;
function loop(t){const dt=Math.max(0,Math.min(.05,(t-lastT)/1000||0));lastT=t;for(const f of ANIMS)f(dt,t/1000);if(ANIMS.size&&!document.hidden)requestAnimationFrame(loop);else loopOn=false;}
function startAnim(f){ANIMS.add(f);if(!loopOn){loopOn=true;lastT=performance.now();requestAnimationFrame(loop);}}
function stopAnim(f){ANIMS.delete(f);}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ANIMS.size&&!loopOn){loopOn=true;lastT=performance.now();requestAnimationFrame(loop);}});

/* canvas sized to its box in CSS pixels, drawn at device resolution */
function fitCanvas(cv,hFn){const box=cv.getBoundingClientRect();const W=Math.max(280,box.width||cv.parentElement.clientWidth||600);const Hh=hFn(W);const dpr=Math.min(devicePixelRatio||1,2);
 if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(Hh*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(Hh*dpr);cv.style.height=Hh+'px';}
 const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,W,H:Hh};}

/* range sliders show their filled part */
function fillRange(el){const p=(el.value-el.min)/(el.max-el.min)*100;el.style.setProperty('--p',p+'%');}
document.addEventListener('input',e=>{if(e.target.type==='range')fillRange(e.target);});

/* play / pause toggle buttons */
function setPlayBtn(btn,playing){btn.innerHTML=`<svg aria-hidden="true"><use href="#i-${playing?'pause':'play'}"/></svg>`;btn.setAttribute('aria-label',playing?'Pause animation':'Play animation');}

/* ---------- logo (vector trace of the PhysiQuest logo) ---------- */
function logoIcon(svg,opts){opts=opts||{};const g=S_('g',{},svg);
 const main=S_('path',{d:LOGO_ICON.main,'fill-rule':'evenodd',fill:opts.fill||'#19e0dc'},g);
 const fins=S_('path',{d:LOGO_ICON.fins,'fill-rule':'evenodd',fill:opts.fins||opts.fill||'#19e0dc'},g);
 const needle=S_('path',{d:LOGO_ICON.needle,fill:opts.fill||'#19e0dc'},g);return{g,main,fins,needle};}
function logoWord(svg,fill){const g=S_('g',{},svg);return LOGO_WORD.map(d=>S_('path',{d,'fill-rule':'evenodd',fill:fill||'#ffffff'},g));}
function buildBrand(){const box=$('#brandLogo');const a=S_('svg',{viewBox:'412 130 342 340',class:'b-icon','aria-hidden':'true'});logoIcon(a);const b=S_('svg',{viewBox:'405 500 355 180',class:'b-word','aria-hidden':'true'});logoWord(b);box.append(a,b);}

/* ---------- colour language legend ---------- */
function buildColorLang(){const items=[
 ['velocity  v','<line x1="4" y1="12" x2="44" y2="12" stroke="#19e0dc" stroke-width="3"/><path d="M44 6 52 12 44 18z" fill="#19e0dc"/>','Velocity: cyan arrow'],
 ['force  F','<line x1="4" y1="12" x2="44" y2="12" stroke="#ffb547" stroke-width="4"/><path d="M42 5 52 12 42 19z" fill="#ffb547"/>','Force and acceleration: amber arrow'],
 ['field','<path d="M2 18 C16 2 36 2 50 18" stroke="#ff5bd6" stroke-width="2.5" fill="none"/><path d="M24 2.5 31 6 24 9.5z" fill="#ff5bd6"/>','Electric or magnetic field: magenta line'],
 ['current','<line x1="2" y1="12" x2="52" y2="12" stroke="rgba(191,178,228,.5)" stroke-width="2"/><circle cx="10" cy="12" r="3.2" fill="#19e0dc"/><circle cx="26" cy="12" r="3.2" fill="#19e0dc"/><circle cx="42" cy="12" r="3.2" fill="#19e0dc"/>','Conventional current: cyan dots'],
 ['electrons','<line x1="2" y1="12" x2="52" y2="12" stroke="rgba(191,178,228,.5)" stroke-width="2"/><circle cx="10" cy="12" r="3.2" fill="#ffe06b"/><circle cx="26" cy="12" r="3.2" fill="#ffe06b"/><circle cx="42" cy="12" r="3.2" fill="#ffe06b"/>','Electron flow: gold dots'],
 ['energy','<rect x="4" y="6" width="20" height="12" rx="2" fill="#ff8a65"/><rect x="28" y="6" width="22" height="12" rx="2" fill="#a8f060"/>','Kinetic energy coral, potential energy lime']];
 $('#colorLang').innerHTML=items.map(i=>`<div><svg viewBox="0 0 54 24" aria-hidden="true">${i[1]}</svg><span>${i[2]}</span></div>`).join('');}

/* ---------- question engine (practice + lesson checks) ---------- */
function renderQ(box,q){const wrap=H('div',{class:'q'});
 wrap.innerHTML=`<div class="q-top"><span class="chip c">${q.topic}</span><span class="chip">${q.kind}</span>${ST.done[q.id]?'<span class="chip good">✓ solved</span>':''}<span class="chip" style="margin-left:auto">+${q.xp} XP</span></div><p class="q-prompt">${q.prompt}</p>${q.visual?`<div class="q-visual">${q.visual}</div>`:''}`;
 const fb=H('div',{'aria-live':'polite'});
 if(q.type==='mcq'){const opts=H('div',{class:'opts'+(q.cols?' cols':'')});q.options.forEach((o,i)=>{const b=H('button',{class:'opt',type:'button'},`<span class="k">${'ABCD'[i]}</span><span style="flex:1;min-width:0">${o.t}</span>`);b.addEventListener('click',()=>{
   if(o.ok){b.classList.add('right');$$('.opt',opts).forEach(x=>x.disabled=true);fb.innerHTML=`<div class="fb good"><b>Correct.</b>${o.why}</div>`;if(q.onRight){if(!q._done){q._done=1;q.onRight();}}else award(q.id,q.xp,q.topic);}
   else{b.classList.add('wrong');b.disabled=true;fb.innerHTML=`<div class="fb bad"><b>Not quite. Try again.</b>${o.why}</div>`;}});opts.appendChild(b);});wrap.appendChild(opts);}
 else if(q.type==='num'){const row=H('div',{class:'numrow'});const inp=H('input',{type:'number',step:'any',id:q.id+'-in','aria-label':'Your answer'});const sel=H('select',{id:q.id+'-unit','aria-label':'Unit'},['<option value="">unit…</option>'].concat(q.units.map(u=>`<option>${u}</option>`)).join(''));const go=H('button',{class:'btn sm',type:'button'},'Check');row.append(inp,sel,go);wrap.appendChild(row);
  go.addEventListener('click',()=>{const v=parseFloat(inp.value);const u=sel.value;if(!isFinite(v)){fb.innerHTML='<div class="fb bad"><b>Enter a number first.</b>Type your answer, then pick its unit.</div>';return;}
   const okV=Math.abs(v-q.answer)<=Math.abs(q.answer)*q.tol;const okU=u===q.unit;
   if(okV&&okU){fb.innerHTML=`<div class="fb good"><b>Correct: ${String(q.answer).replace('-','−')} ${q.unit}.</b>${q.explain}</div>`;if(q.onRight){if(!q._done){q._done=1;q.onRight();}}else award(q.id,q.xp,q.topic);return;}
   let msg='';for(const m of q.mistakes){if(Math.abs(v-m.v)<=Math.abs(m.v)*0.03+1e-9){msg=m.why;break;}}
   if(okV&&!okU)msg='Your number is right, but the unit is not. '+q.unitWhy;
   fb.innerHTML=`<div class="fb bad"><b>Not quite. Try again.</b>${msg||'Check which formula links the quantities you know to the one you want.'}</div>`;});}
 else if(q.type==='int'){const row=H('div',{class:'numrow'});const inp=H('input',{type:'number',step:'any',inputmode:'decimal',autocomplete:'off',id:q.id+'-in','aria-label':'Your answer'+(q.unitTxt?' in '+q.unitTxt:'')});const go=H('button',{class:'btn sm',type:'button'},'Check');row.append(inp);if(q.unitTxt)row.append(H('span',{class:'unit-tag'},q.unitTxt));row.append(go);wrap.appendChild(row);
  const check=()=>{const v=parseFloat(String(inp.value).replace('−','-'));if(!isFinite(v)){fb.innerHTML='<div class="fb bad"><b>Enter a number first.</b>Type a whole number, then press Check.</div>';return;}
   if(Math.round(v)===q.answer){fb.innerHTML=`<div class="fb good"><b>Correct: ${q.answer}${q.unitTxt?' '+q.unitTxt:''}.</b>${q.explain}</div>`;inp.disabled=true;go.disabled=true;if(q.onRight){if(!q._done){q._done=1;q.onRight();}}else award(q.id,q.xp,q.topic);return;}
   let msg='';for(const m of q.mistakes){if(Math.abs(v-m.v)<=Math.abs(m.v)*0.03+0.5){msg=m.why;break;}}
   fb.innerHTML=`<div class="fb bad"><b>Not quite. Try again.</b>${msg||'Write down what you know, pick the law that links it to what you want, and solve in symbols before putting numbers in.'}</div>`;};
  go.addEventListener('click',check);inp.addEventListener('keydown',e=>{if(e.key==='Enter')check();});}
 if(q.hint){const d=H('details',{class:'hintbox'},`<summary>Show a hint</summary><p class="hint">${q.hint}</p>`);wrap.appendChild(d);}
 wrap.appendChild(fb);box.appendChild(wrap);return wrap;}

/* ---------- router ---------- */
const VIEWS=['home','account','classes','chapter','neet','neetunit','jee','jeeunit','plans','feedback','path','lesson','lab','circuits','studio','practice','mock','badges','blueprint'];
const HOOKS={};let curView=null,curParam=null,routed=false;
function route(){let hsh=(location.hash||'#home').slice(1);let anchor=null,param=null,m;
 if(/^bp\d$/.test(hsh)){anchor=hsh;hsh='blueprint';}
 else if((m=hsh.match(/^class-(\d+)$/))){param=+m[1];hsh='classes';}
 else if((m=hsh.match(/^neet-(\d+)$/))){param=+m[1];hsh='neetunit';}
 else if((m=hsh.match(/^jee-(\d+)$/))){param=clamp(+m[1],1,20);hsh='jeeunit';}
 else if((m=hsh.match(/^ch-(\d+)-(\d+)$/))){param=[+m[1],+m[2]];hsh='chapter';if(!findCh(param[0],param[1])){param=param[0];hsh='classes';}}
 if(!VIEWS.includes(hsh))hsh='home';
 const key=JSON.stringify(param);
 if(curView!==hsh||curParam!==key){if(curView&&HOOKS[curView]&&HOOKS[curView].hide)safe(()=>HOOKS[curView].hide(),'hide '+curView);
  for(const v of VIEWS){$('#v-'+v).hidden=(v!==hsh);}
  const navKey=hsh==='chapter'?'classes':hsh==='neetunit'?'neet':hsh==='jeeunit'?'jee':hsh;
  $$('.nav a').forEach(a=>{if(a.getAttribute('href')==='#'+navKey)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const act=$('.nav a[aria-current]');if(act&&act.scrollIntoView)act.scrollIntoView({block:'nearest',inline:'nearest'});
  curView=hsh;curParam=key;if(HOOKS[hsh]&&HOOKS[hsh].show){try{HOOKS[hsh].show(param);}catch(e){logErr(e,'show '+hsh);viewFailed(hsh);}}if(!anchor)window.scrollTo(0,0);
  if(routed){const h=$('#v-'+hsh+' h1');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true});}}routed=true;}
 if(anchor){const el=document.getElementById(anchor);if(el)setTimeout(()=>el.scrollIntoView({behavior:RM?'auto':'smooth',block:'start'}),30);}}
window.addEventListener('hashchange',()=>safe(route,'route'));
/* if a page fails to draw, show a friendly panel instead of a blank screen */
function viewFailed(v){const sec=$('#v-'+v);if(!sec)return;let box=sec.querySelector('.view-error');if(!box){box=H('div',{class:'panel view-error stack',role:'alert'});sec.prepend(box);}
 box.innerHTML=`<h2 style="margin:0">This page hit a problem</h2><p class="muted" style="margin:0">Your progress is safe. Try again, or go back home. If it keeps happening, please report it so it can be fixed.</p><div class="row"><button class="btn sm" type="button" data-retry>Try again</button><a class="btn ghost sm" href="#home">Home</a><a class="btn quiet sm" href="#feedback" data-fb="Page error: ${v}">Report it</a></div>`;
 box.querySelector('[data-retry]').addEventListener('click',()=>{box.remove();curView=null;route();});}

