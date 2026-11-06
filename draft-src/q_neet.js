/* ================= NEET physics, practice sets, plans and feedback ================= */
/* NEET UG physics follows the NMC syllabus: 20 units, built on NCERT Class 11 and 12 physics */
const NEET=[
 {u:1,t:'Physics and Measurement',ch:[[11,1]],f:['Check every formula with dimensions before using it.','Relative errors add in products and quotients; a power n multiplies the error by n.','Significant figures: leading zeros never count; trailing zeros after a decimal point do.']},
 {u:2,t:'Kinematics',ch:[[11,2],[11,3]],f:['Area under a v–t graph is displacement; its slope is acceleration.','Projectiles: horizontal and vertical motions are independent. R = u² sin 2θ/g is largest at 45°, and 30° and 60° give the same range.','Relative velocity problems become easy if you sit in the frame of one body.']},
 {u:3,t:'Laws of Motion',ch:[[11,4]],f:['Always draw a free-body diagram for one body at a time.','Lift problems: apparent weight = m(g + a) going up with acceleration a, m(g − a) going down.','Static friction adjusts up to μₛN; do not assume it is always μN.']},
 {u:4,t:'Work, Energy and Power',ch:[[11,5]],f:['Work–energy theorem: W_net = ΔK, often the fastest route.','K = p²/2m links kinetic energy and momentum.','In every collision momentum is conserved; kinetic energy only in elastic ones.']},
 {u:5,t:'Rotational Motion',ch:[[11,6]],f:['Learn I for ring (MR²), disc (½MR²), solid sphere (2/5 MR²) and rod about its centre (ML²/12).','No external torque means L = Iω is conserved.','Rolling down a slope: smaller I/MR² reaches the bottom first.']},
 {u:6,t:'Gravitation',ch:[[11,7]],f:['g at height h: g(R/(R+h))²; at h = R it is g/4.','Escape speed √(2gR) = √2 × orbital speed near the surface.','Kepler: T² ∝ r³; doubling r multiplies T by 2√2.']},
 {u:7,t:'Properties of Solids and Liquids',ch:[[11,8],[11,9],[11,10]],f:['Y = (F/A)/(ΔL/L); extension ΔL = FL/AY.','Continuity A₁v₁ = A₂v₂ and Bernoulli: faster flow, lower pressure.','Heat: Q = mcΔT, Q = mL; expansion ΔL = αLΔT; Newton’s law of cooling for small differences.']},
 {u:8,t:'Thermodynamics',ch:[[11,11]],f:['ΔQ = ΔU + ΔW, with W done by the gas positive.','Isothermal ΔU = 0; adiabatic Q = 0; isochoric W = 0.','Carnot efficiency 1 − T₂/T₁ — always use kelvin.']},
 {u:9,t:'Kinetic Theory of Gases',ch:[[11,12]],f:['pV = nRT; average KE per molecule = (3/2)k_BT.','v_rms ∝ √(T/M): heavier molecules move more slowly.','Degrees of freedom: monatomic 3, diatomic 5 (at room temperature).']},
 {u:10,t:'Oscillations and Waves',ch:[[11,13],[11,14]],f:['SHM: a = −ω²x; v_max = Aω; a_max = Aω².','Spring T = 2π√(m/k); pendulum T = 2π√(L/g).','Strings and open pipes: all harmonics; closed pipes: odd harmonics only. Beats = |f₁ − f₂|.']},
 {u:11,t:'Electrostatics',ch:[[12,1],[12,2]],f:['Field from a point charge falls as 1/r², potential as 1/r.','Gauss: flux = q_enc/ε₀; field inside a conducting shell is zero.','Capacitors: series like resistors in parallel, and vice versa. U = ½CV².']},
 {u:12,t:'Current Electricity',ch:[[12,3]],f:['Terminal voltage V = ε − Ir.','Stretching a wire n times (same volume) multiplies R by n².','Wheatstone bridge balance: P/Q = R/S; no current in the galvanometer.']},
 {u:13,t:'Magnetic Effects of Current and Magnetism',ch:[[12,4],[12,5]],f:['r = mv/qB; the period 2πm/qB does not depend on speed.','Straight wire μ₀I/2πr, loop centre μ₀I/2R, solenoid μ₀nI.','Dia: weakly repelled; para: weakly attracted; ferro: strongly attracted.']},
 {u:14,t:'Electromagnetic Induction and Alternating Currents',ch:[[12,6],[12,7]],f:['ε = −N dΦ/dt; Lenz’s law gives the direction.','Motional emf Blv.','LCR: Z = √(R² + (X_L − X_C)²), resonance at ω₀ = 1/√(LC); power P = V_rms I_rms cos φ.']},
 {u:15,t:'Electromagnetic Waves',ch:[[12,8]],f:['E and B are perpendicular, in phase, and travel at c = 1/√(μ₀ε₀).','Know the spectrum order and one use of each band.','E₀/B₀ = c.']},
 {u:16,t:'Optics',ch:[[12,9],[12,10]],f:['Sign convention first, then the formula.','sin C = 1/n; apparent depth = real depth/n.','YDSE: β = λD/d; in a medium, λ becomes λ/n so fringes shrink.']},
 {u:17,t:'Dual Nature of Matter and Radiation',ch:[[12,11]],f:['K_max = hf − φ₀; use hc = 1240 eV nm for quick energy.','Intensity changes the number of electrons, not their maximum energy.','Electron λ = 1.227/√V nm.']},
 {u:18,t:'Atoms and Nuclei',ch:[[12,12],[12,13]],f:['E_n = −13.6/n² eV; r_n ∝ n²; Lyman UV, Balmer visible.','Binding energy = Δm × 931.5 MeV; B/A peaks near iron.','R = R₀A^(1/3): every nucleus has about the same density.']},
 {u:19,t:'Electronic Devices',ch:[[12,14]],f:['Forward bias narrows the depletion layer; reverse bias widens it.','Full-wave output ripple is twice the input frequency.','n-type: pentavalent impurity; p-type: trivalent impurity.']},
 {u:20,t:'Experimental Skills',ch:[[11,1]],f:['Vernier reading = main scale + (coinciding division × least count).','Screw gauge least count = pitch ÷ number of circular divisions.','Know the set-ups: Young’s modulus, focal length by u–v method, metre bridge, pendulum.']}
];
const NEET_FACTS='In NEET UG, Physics is 45 of the 180 questions (180 of 720 marks). Each correct answer gets +4, each wrong answer −1, and an unanswered question 0.';

/* ---------- generated practice, used by chapter pages and the NEET section ---------- */
let GQSEQ=0;
const genKey=(c,n)=>c+'-'+n;
function genRight(key,label){ST.gen=ST.gen||{};ST.gen[key]=(ST.gen[key]||0)+1;ST.xp+=2;save();toast('+2 XP',label);burst(.5);updateXP();checkBadges();}
function genFor(c,n,mcqOnly){for(let k=0;k<12;k++){const q=genQ(c,n);if(q&&(!mcqOnly||q.type==='mcq'))return q;}return null;}
function makeGen(c,n,opt){opt=opt||{};const q=genFor(c,n,opt.mcq);if(!q)return null;const key=opt.key||genKey(c,n);
 return Object.assign(q,{id:'gq'+(++GQSEQ),topic:opt.topic||`Class ${c} · Ch ${n}`,kind:opt.kind||'Practice',xp:2,cls:c,n,onRight:()=>genRight(key,opt.topic||`Class ${c} · Ch ${n}`)});}
function practiceSet(box,c,n,count){box.innerHTML='';for(let i=0;i<count;i++){const q=makeGen(c,n);if(!q)break;const p=H('div',{class:'panel tight gq'});box.appendChild(p);renderQ(p,q);}}
/* a worked example: one generated question shown with its full solution */
function workedHTML(c,n){const q=genFor(c,n,true);if(!q)return '';const right=q.options.find(o=>o.ok);
 return `<p class="q-prompt">${q.prompt}</p><div class="fb good"><b>Answer: ${right.t}</b>${right.why}</div>`;}

/* ---------- NEET view ---------- */
const NM={phase:'intro',size:15,qs:[],ans:{},idx:0,left:0,timer:null};
function neetChLinks(U){return U.ch.map(([c,n])=>`<a class="chip c" href="#ch-${c}-${n}">Class ${c} · Ch ${n} ${findCh(c,n).t}</a>`).join('');}
function premUntil(){const e=premExp();if(STORE_PLAY||e===null||e<todayN())return '';const left=e-todayN();return `<span class="chip good">Premium until ${dayDate(e)} · ${left+1} day${left?'s':''} left</span>`;}
const premEnded=()=>{const e=premExp();return e!==null&&e<todayN()?`<span class="chip bad">Your Premium ended on ${dayDate(e)}</span>`:'';};
function neetLocked(){return `<div class="panel lock-panel stack"><h2 style="margin:0">NEET Physics is for Premium members</h2>
 <p class="muted" style="margin:0">Unlock all 20 NEET units with must-know tips, NEET-style practice and full mocks marked +4 / −1. It stays open until your plan's end date.</p>
 <div class="row"><span class="chip c">₹199 / month</span><span class="chip c">₹1,999 / year</span></div>
 <div class="row"><a class="btn" href="#plans">See plans</a>${premEnded()}</div></div>`;}
function showNeet(){const done=(ST.neetBest!==undefined&&ST.neetBest!==null)?`<span class="chip good">Best mock: ${ST.neetBest} marks</span>`:'';
 $('#neetHead').innerHTML=`<p>${NEET_FACTS}</p><p class="muted">NEET follows the NMC syllabus. Its physics is built on NCERT Class 11 and 12, so every unit below links to those chapters in PhysiQuest.</p><div class="row">${done}<span class="chip">${NEET.length} units</span>${isPremium()?premUntil():'<span class="chip c">Premium only</span>'}</div>`;
 $('#neetUnits').innerHTML=NEET.map(U=>`<a class="quest neet-card" href="#neet-${U.u}"><span class="eyebrow">Unit ${U.u}</span><h3>${U.t}</h3><p>${U.ch.map(([c,n])=>`Class ${c} Ch ${n}`).join(' · ')}</p><div class="row"><span class="chip">${U.f.length} NEET tips</span><span class="chip">Practice set</span></div></a>`).join('');
 if(!isPremium()){$('#neetMock').innerHTML=neetLocked();$('#neetUnits').innerHTML=NEET.map(U=>`<div class="quest neet-card locked" aria-disabled="true"><span class="eyebrow">Unit ${U.u} · locked</span><h3>${U.t}</h3><p>${U.ch.map(([c,n])=>`Class ${c} Ch ${n}`).join(' · ')}</p></div>`).join('');return;}
 neetMockRender();}
function showNeetUnit(u){const U=NEET.find(x=>x.u===u)||NEET[0];
 if(!isPremium()){$('#neetUnitBox').innerHTML=`<div class="v-head"><span class="eyebrow">NEET Physics · Unit ${U.u}</span><h1 id="h-neetunit">${U.t}</h1></div><div class="row"><a class="chip c" href="#neet">← All NEET units</a></div>${neetLocked()}`;return;}
 $('#neetUnitBox').innerHTML=`<div class="v-head"><span class="eyebrow">NEET Physics · Unit ${U.u}</span><h1 id="h-neetunit">${U.t}</h1><p>The must-know points for NEET, then fresh NEET-style questions from the matching NCERT chapters.</p></div>
  <div class="row"><a class="chip c" href="#neet">← All NEET units</a>${neetChLinks(U)}</div>
  <div class="panel"><h2>NEET focus</h2><ol class="ideas">${U.f.map(s=>`<li><span>${s}</span></li>`).join('')}</ol></div>
  <div class="panel stack"><div class="row" style="justify-content:space-between"><h2 style="margin:0">NEET-style practice</h2><button class="btn sm" id="neetMore" type="button">5 new questions</button></div><p class="muted" style="margin:0">New numbers every set. +2 XP for each correct answer.</p><div class="stack" id="neetQs" style="gap:16px"></div></div>`;
 const fill=()=>{const box=$('#neetQs');box.innerHTML='';for(let i=0;i<5;i++){const [c,n]=rp(U.ch);const q=makeGen(c,n,{key:'neet-'+U.u,topic:'NEET · Unit '+U.u,kind:'NEET practice'});if(!q)continue;const p=H('div',{class:'panel tight gq'});box.appendChild(p);renderQ(p,q);}};
 if(!isPremium()){$('#neetQs').innerHTML=lockHTML('NEET practice');$('#neetMore').hidden=true;return;}
 fill();$('#neetMore').addEventListener('click',fill);}
HOOKS.neet={show:showNeet};HOOKS.neetunit={show:u=>showNeetUnit(u)};
/* NEET mock: +4 / −1 / 0, about a minute per question as in the real paper */
function neetMockStart(size){NM.size=size;NM.phase='run';NM.ans={};NM.idx=0;NM.left=size*60;NM.qs=[];
 const units=shuffle(NEET.filter(U=>U.u!==20));for(let i=0;NM.qs.length<size&&i<size*3;i++){const U=units[i%units.length];const [c,n]=rp(U.ch);const q=genFor(c,n,true);if(q){q.unit=U;NM.qs.push(q);}}
 clearInterval(NM.timer);NM.timer=setInterval(()=>{NM.left--;const t=$('#nmTimer');if(t)t.textContent=mmss(NM.left);if(NM.left<=0)neetMockFinish();},1000);neetMockRender();}
function neetMockFinish(){clearInterval(NM.timer);NM.phase='done';let right=0,wrong=0;NM.qs.forEach((q,i)=>{if(NM.ans[i]===undefined)return;if(q.options[NM.ans[i]].ok)right++;else wrong++;});
 NM.right=right;NM.wrong=wrong;NM.marks=4*right-wrong;if(NM.size===45)ST.neetBest=Math.max(ST.neetBest===undefined||ST.neetBest===null?-999:ST.neetBest,NM.marks);save();award('neet-mock-'+NM.size,NM.size===45?60:25,'NEET mock finished');neetMockRender();}
function neetMockRender(){const box=$('#neetMock');if(!box)return;
 if(NM.phase==='intro'&&!isPremium()){box.innerHTML=`<h2 style="margin:0">NEET physics mock</h2><p class="muted">Quick 15-question and full 45-question mocks with NEET marking (+4 / −1 / 0), new questions every time.</p>${lockHTML('The NEET mock')}`;return;}
 if(NM.phase==='intro'){box.innerHTML=`<h2 style="margin:0">NEET physics mock</h2><p class="muted">Questions are drawn from every unit with new numbers each time. Marking as in NEET: +4 correct, −1 wrong, 0 unanswered. About one minute per question.</p>
  <div class="row"><button class="btn" id="nm15" type="button">Quick mock · 15 questions, 15 min</button><button class="btn ghost" id="nm45" type="button">Full physics section · 45 questions, 45 min</button></div>`;
  $('#nm15').addEventListener('click',()=>neetMockStart(15));$('#nm45').addEventListener('click',()=>neetMockStart(45));return;}
 if(NM.phase==='run'){const q=NM.qs[NM.idx];box.innerHTML=`<div class="row" style="justify-content:space-between"><span class="eyebrow">Question ${NM.idx+1} of ${NM.qs.length} · ${q.unit.t}</span><span class="timer"><span id="nmTimer">${mmss(NM.left)}</span> left</span></div>
  <div class="mock-dots">${NM.qs.map((_,i)=>`<button class="${NM.ans[i]!==undefined?'ans':''} ${i===NM.idx?'cur':''}" data-go="${i}" aria-label="Question ${i+1}">${i+1}</button>`).join('')}</div>
  <p class="q-prompt" style="font-size:1.08rem">${q.prompt}</p><div class="opts">${q.options.map((o,k)=>`<button class="opt ${NM.ans[NM.idx]===k?'sel':''}" data-k="${k}" aria-pressed="${NM.ans[NM.idx]===k}"><span class="k">${'ABCD'[k]}</span><span>${o.t}</span></button>`).join('')}</div>
  <div class="row" style="justify-content:space-between"><div class="row"><button class="btn quiet sm" id="nmPrev" ${NM.idx?'':'disabled'}>Previous</button><button class="btn quiet sm" id="nmClear">Clear answer</button></div><div class="row">${NM.idx<NM.qs.length-1?'<button class="btn sm" id="nmNext">Next</button>':''}<button class="btn ghost sm" id="nmDone">Finish</button></div></div>
  <p class="faint" style="font-size:.85rem;margin:0">Skipping costs nothing; a wrong answer costs 1 mark.</p>`;
  $$('#neetMock .opt').forEach(b=>b.addEventListener('click',()=>{NM.ans[NM.idx]=+b.dataset.k;neetMockRender();}));$$('#neetMock [data-go]').forEach(b=>b.addEventListener('click',()=>{NM.idx=+b.dataset.go;neetMockRender();}));
  $('#nmPrev').addEventListener('click',()=>{NM.idx--;neetMockRender();});$('#nmClear').addEventListener('click',()=>{delete NM.ans[NM.idx];neetMockRender();});const nx=$('#nmNext');if(nx)nx.addEventListener('click',()=>{NM.idx++;neetMockRender();});$('#nmDone').addEventListener('click',neetMockFinish);return;}
 const max=NM.qs.length*4,skipped=NM.qs.length-NM.right-NM.wrong,byU={};NM.qs.forEach((q,i)=>{const k=q.unit.u;byU[k]=byU[k]||{U:q.unit,ok:0,n:0};byU[k].n++;if(NM.ans[i]!==undefined&&q.options[NM.ans[i]].ok)byU[k].ok++;});
 const weak=Object.values(byU).filter(x=>x.ok<x.n).sort((a,b)=>a.ok/a.n-b.ok/b.n).slice(0,3);
 box.innerHTML=`<h2 style="margin:0">${NM.marks} / ${max} marks</h2><p class="muted">${NM.right} correct (+${4*NM.right}), ${NM.wrong} wrong (−${NM.wrong}), ${skipped} skipped.</p>
  ${weak.length?`<div class="note"><b>Review next.</b> ${weak.map(x=>`<a href="#neet-${x.U.u}">${x.U.t}</a> (${x.ok}/${x.n})`).join(' · ')}</div>`:'<div class="note good"><b>Every unit correct.</b> Try the full 45-question section.</div>'}
  <h3 style="margin:8px 0 0">Mistakes, explained</h3><div class="stack">${NM.qs.map((q,i)=>({q,i})).filter(o=>NM.ans[o.i]===undefined||!o.q.options[NM.ans[o.i]].ok).map(o=>{const a=NM.ans[o.i],r=o.q.options.find(x=>x.ok);return `<div class="review-item"><span class="chip c">${o.q.unit.t}</span><p>${o.q.prompt}</p>${a!==undefined?`<div class="fb bad"><b>You chose: ${o.q.options[a].t}</b>${o.q.options[a].why}</div>`:'<div class="fb warn"><b>Skipped.</b>0 marks. Answer when you can rule out two options.</div>'}<div class="fb good"><b>Correct: ${r.t}</b>${r.why}</div></div>`;}).join('')||'<p class="muted">None.</p>'}</div>
  <div class="row"><button class="btn" id="nmAgain" type="button">New mock</button></div>`;
 $('#nmAgain').addEventListener('click',()=>{NM.phase='intro';neetMockRender();});}

/* ---------- feedback: bugs, topic ideas and question errors ---------- */
const FEEDBACK_TO='mugilstrange@gmail.com';const APP_VER='1.7';
let FB={ctx:''};
function renderFeedback(){const ctx=FB.ctx||'';const list=(ST.reports||[]).slice(-5).reverse();
 $('#fbBox').innerHTML=`<div class="grid2" style="gap:20px"><form class="stack" id="fbForm" novalidate>
  <div class="field"><label for="fbType">What is it about?</label><select id="fbType"><option value="Bug">Something is broken (a bug)</option><option value="Wrong answer">A question or answer looks wrong</option><option value="Topic idea">Suggest a topic or chapter</option><option value="Other">Other idea or comment</option></select></div>
  <div class="field"><label for="fbWhere">Where in the app?</label><input id="fbWhere" type="text" value="${ctx.replace(/"/g,'&quot;')}" placeholder="For example: Class 10, Ch 11, quick check 2"></div>
  <div class="field"><label for="fbMsg">Tell us what happened or what you would like</label><textarea id="fbMsg" rows="5" class="code" style="font-family:var(--f-body);font-size:1rem" placeholder="What did you do, what did you expect, and what happened?"></textarea></div>
  <div class="row"><button class="btn" type="submit">Send by email</button><button class="btn quiet sm" type="button" id="fbCopy">Copy the report</button></div>
  <p class="faint" id="fbStatus" role="status" style="font-size:.88rem;margin:0"></p></form>
  <div class="stack"><h2 style="margin:0">How this works</h2><p class="muted">“Send by email” opens your email app with the report filled in, addressed to the PhysiQuest team. Nothing is sent until you press send there. If email does not open, copy the report and paste it into any message.</p>
   ${list.length?`<h3 style="font-size:.95rem">Your recent reports</h3><ul class="act-list">${list.map(r=>`<li><a><span class="chip">${r.type}</span><span>${r.msg.slice(0,60)}${r.msg.length>60?'…':''}</span></a></li>`).join('')}</ul>`:''}</div></div>`;
 const build=()=>{const t=$('#fbType').value,w=$('#fbWhere').value.trim(),m=$('#fbMsg').value.trim();return{t,w,m,subject:`PhysiQuest ${t}${w?' · '+w:''}`,body:`Type: ${t}\nWhere: ${w||'not given'}\n\n${m}\n\n— PhysiQuest ${APP_VER} · ${navigator.userAgent.slice(0,90)}${(ST.errs&&ST.errs.length&&t==='Bug')?'\nRecent errors: '+ST.errs.slice(-3).map(x=>x.v+': '+x.m).join(' | '):''}`};};
 $('#fbForm').addEventListener('submit',e=>{e.preventDefault();const r=build();const st=$('#fbStatus');if(r.m.length<5){st.textContent='Please write a few words about the problem or idea first.';st.style.color='var(--bad)';$('#fbMsg').focus();return;}
  ST.reports=ST.reports||[];ST.reports.push({type:r.t,msg:r.m,at:Date.now()});if(ST.reports.length>20)ST.reports.shift();save();
  location.href=`mailto:${FEEDBACK_TO}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body)}`;st.style.color='';st.textContent='Your email app should open with the report ready. Press send there.';});
 $('#fbCopy').addEventListener('click',async()=>{const r=build();const txt=`To: ${FEEDBACK_TO}\nSubject: ${r.subject}\n\n${r.body}`;let ok=false;try{if(navigator.clipboard){await navigator.clipboard.writeText(txt);ok=true;}}catch(e){}$('#fbStatus').textContent=ok?'Copied. Paste it into an email or message.':'Select and copy this: '+txt;});}
HOOKS.feedback={show:()=>{renderFeedback();FB.ctx='';}};
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('[data-fb]');if(a)FB.ctx=a.dataset.fb;});
