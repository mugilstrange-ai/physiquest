/* ================= Premium by UPI, with device-bound unlock codes =================
   A student pays Mugilan by UPI, sends the transaction ID (UTR) and this device's ID,
   and gets back an unlock code made with the PhysiQuest unlock-code tool.
   Without a server the app cannot see payments itself; a determined person who reads
   the app's source could make codes. A payment server later will close that gap. */
const PAY={upi:'mugilstrange@oksbi',name:'Mugilan',to:'mugilstrange@gmail.com',
 plans:{M:{key:'monthly',label:'Premium · monthly',price:199,days:31},Y:{key:'yearly',label:'Premium · yearly',price:1999,days:366}}};
const PQ_KEY='imZBEPxRCHHjQkDtZn2mt3SXqvy9JLEE';
const B32='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY0=Date.UTC(2026,0,1)/864e5;
const todayN=()=>Math.floor(Date.now()/864e5)-DAY0;
const dayDate=n=>new Date((n+DAY0)*864e5).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});

/* SHA-256 and HMAC, small and dependency-free */
function sha256(msg){const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];const l=msg.length,n=((l+9+63)>>6)<<6,b=new Uint8Array(n);b.set(msg);b[l]=0x80;const bits=l*8;b[n-4]=bits>>>24;b[n-3]=bits>>>16&255;b[n-2]=bits>>>8&255;b[n-1]=bits&255;
 const w=new Uint32Array(64),r=(x,s)=>(x>>>s)|(x<<(32-s));for(let o=0;o<n;o+=64){for(let i=0;i<16;i++)w[i]=(b[o+4*i]<<24)|(b[o+4*i+1]<<16)|(b[o+4*i+2]<<8)|b[o+4*i+3];
  for(let i=16;i<64;i++){const s0=r(w[i-15],7)^r(w[i-15],18)^(w[i-15]>>>3),s1=r(w[i-2],17)^r(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
  let [a,c,d,e,f,g,h,k]=H;for(let i=0;i<64;i++){const S1=r(f,6)^r(f,11)^r(f,25),ch=(f&g)^(~f&h),t1=(k+S1+ch+K[i]+w[i])>>>0,S0=r(a,2)^r(a,13)^r(a,22),mj=(a&c)^(a&d)^(c&d),t2=(S0+mj)>>>0;k=h;h=g;g=f;f=(e+t1)>>>0;e=d;d=c;c=a;a=(t1+t2)>>>0;}
  H[0]=(H[0]+a)>>>0;H[1]=(H[1]+c)>>>0;H[2]=(H[2]+d)>>>0;H[3]=(H[3]+e)>>>0;H[4]=(H[4]+f)>>>0;H[5]=(H[5]+g)>>>0;H[6]=(H[6]+h)>>>0;H[7]=(H[7]+k)>>>0;}
 const out=new Uint8Array(32);H.forEach((v,i)=>{out[4*i]=v>>>24;out[4*i+1]=v>>>16&255;out[4*i+2]=v>>>8&255;out[4*i+3]=v&255;});return out;}
const utf8=s=>new TextEncoder().encode(s);
function hmac(key,msg){let k=utf8(key);if(k.length>64)k=sha256(k);const kp=new Uint8Array(64);kp.set(k);const ip=kp.map(x=>x^0x36),op=kp.map(x=>x^0x5c),m=utf8(msg);
 const inner=new Uint8Array(64+m.length);inner.set(ip);inner.set(m,64);const ih=sha256(inner);const outer=new Uint8Array(96);outer.set(op);outer.set(ih,64);return sha256(outer);}
function b32(bytes,nChars){let bits=0,val=0,s='';for(const x of bytes){val=(val<<8)|x;bits+=8;while(bits>=5&&s.length<nChars){s+=B32[(val>>>(bits-5))&31];bits-=5;}if(s.length>=nChars)break;}return s;}
const expChars=e=>B32[(e>>10)&31]+B32[(e>>5)&31]+B32[e&31];
const expFrom=s=>(B32.indexOf(s[0])<<10)|(B32.indexOf(s[1])<<5)|B32.indexOf(s[2]);
/* code = plan letter + expiry day (3 chars) + 8-char signature, shown as XXXX-XXXX-XXXX */
function makeCode(dev,plan,exp){const sig=b32(hmac(PQ_KEY,`PQ1|${dev}|${plan}|${exp}`),8);const c=plan+expChars(exp)+sig;return c.slice(0,4)+'-'+c.slice(4,8)+'-'+c.slice(8);}
function readCodeU(raw,dev){const s=(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(s.length!==12)return{err:'An unlock code has 12 letters and numbers, like M8KQ-ABCD-2345.'};
 const plan=s[0];if(!PAY.plans[plan])return{err:'That code does not start with M or Y. Check it and try again.'};if([...s].some(ch=>!B32.includes(ch)))return{err:'That code has a character that is never used in codes (such as 0, 1, O or I). Check it again.'};
 const exp=expFrom(s.slice(1,4));if(makeCode(dev,plan,exp).replace(/-/g,'')!==s)return{err:'That code is not valid for this device. Check that you sent the Device ID shown on this page.'};
 if(exp<todayN())return{err:`That code expired on ${dayDate(exp)}.`};return{plan,exp};}

/* this device's ID, made once and kept */
function devId(){if(!ST.dev||!/^[A-Z2-9]{6}$/.test(ST.dev)){const r=new Uint8Array(6);try{crypto.getRandomValues(r);}catch(e){for(let i=0;i<6;i++)r[i]=Math.random()*256|0;}ST.dev=[...r].map(x=>B32[x&31]).join('');save();}return ST.dev;}
/* the Google Play build may not sell digital content by UPI, so there Premium is simply free */
const STORE_PLAY=typeof window!=='undefined'&&window.PQ_STORE==='play';
/* with accounts switched on, only the server-confirmed plan counts (the old device codes are ignored) */
const accountsOn=()=>typeof ACC!=='undefined'&&ACC.mode==='on';
function premExp(){if(accountsOn())return ST.acct&&ST.acct.sub&&typeof ST.acct.sub.exp==='number'?ST.acct.sub.exp:null;return ST.prem&&typeof ST.prem.exp==='number'?ST.prem.exp:null;}
function isPremium(){if(STORE_PLAY)return true;const e=premExp();return e!==null&&e>=todayN();}
/* free users get three extra practice sets a day; Premium is unlimited */
function usePracticeSet(){if(isPremium())return true;const d=todayN();if(!ST.freeSets||ST.freeSets.d!==d)ST.freeSets={d,n:0};if(ST.freeSets.n>=3)return false;ST.freeSets.n++;save();return true;}
const freeSetsLeft=()=>{const d=todayN();return Math.max(0,3-((ST.freeSets&&ST.freeSets.d===d)?ST.freeSets.n:0));};
function lockHTML(what){return `<div class="note lock"><b>${what} is part of Premium.</b> ₹${PAY.plans.M.price} a month or ₹${PAY.plans.Y.price.toLocaleString('en-IN')} a year, paid by UPI. <a href="#plans">See plans and unlock</a></div>`;}

/* UPI payment link and QR code */
function upiLink(plan){const p=PAY.plans[plan];return `upi://pay?pa=${encodeURIComponent(PAY.upi)}&pn=${encodeURIComponent(PAY.name)}&am=${p.price}.00&cu=INR&tn=${encodeURIComponent(`PhysiQuest ${p.key} ${devId()}`)}`;}
/* a compact QR encoder (byte mode, error correction level M, versions 1–10) */
const QRV=[null,[16,1,10,0,0],[28,1,16,0,0],[44,1,26,0,0],[64,2,18,0,0],[86,2,24,0,0],[108,4,16,0,0],[124,4,18,0,0],[154,2,22,2,0],[182,3,22,2,0],[216,4,26,1,0]];
const QRBLK=[null,[[1,16]],[[1,28]],[[1,44]],[[2,32]],[[2,43]],[[4,27]],[[4,31]],[[2,38],[2,39]],[[3,36],[2,37]],[[4,43],[1,44]]];
const QRECC=[0,10,16,26,18,24,16,18,22,22,26];
const QRALN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
const QRVER={7:0x07C94,8:0x085BC,9:0x09A99,10:0x0A4D3};
function qrMatrix(text){const data=utf8(text);let v=1;while(v<=10&&data.length+(v<10?2:3)>QRV[v][0])v++;if(v>10)return null;
 const cap=QRV[v][0],bits=[];const put=(x,n)=>{for(let i=n-1;i>=0;i--)bits.push((x>>>i)&1);};put(4,4);put(data.length,v<10?8:16);data.forEach(x=>put(x,8));
 for(let i=0;i<4&&bits.length<cap*8;i++)bits.push(0);while(bits.length%8)bits.push(0);const cw=[];for(let i=0;i<bits.length;i+=8){let x=0;for(let j=0;j<8;j++)x=(x<<1)|bits[i+j];cw.push(x);}for(let p=0;cw.length<cap;p++)cw.push(p%2?0x11:0xEC);
 const EXP=new Array(512),LOG=new Array(256);let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11D;}for(let i=255;i<512;i++)EXP[i]=EXP[i-255];const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
 const ne=QRECC[v];let gen=[1];for(let i=0;i<ne;i++){const g=new Array(gen.length+1).fill(0);for(let j=0;j<gen.length;j++){g[j]^=gen[j];g[j+1]^=mul(gen[j],EXP[i]);}gen=g;}
 const blocks=[],ecs=[];let off=0;for(const [cnt,len] of QRBLK[v])for(let k=0;k<cnt;k++){const d=cw.slice(off,off+len);off+=len;blocks.push(d);const r=d.concat(new Array(ne).fill(0));for(let i=0;i<len;i++){const f=r[i];if(f)for(let j=0;j<gen.length;j++)r[i+j]^=mul(gen[j],f);}ecs.push(r.slice(len));}
 const seq=[];const ml=Math.max(...blocks.map(b=>b.length));for(let i=0;i<ml;i++)for(const b of blocks)if(i<b.length)seq.push(b[i]);for(let i=0;i<ne;i++)for(const e of ecs)seq.push(e[i]);
 const N=17+4*v,M=[...Array(N)].map(()=>new Array(N).fill(null)),fixed=[...Array(N)].map(()=>new Array(N).fill(false));const set=(r,c,val)=>{M[r][c]=val;fixed[r][c]=true;};
 const finder=(r0,c0)=>{for(let r=-1;r<=7;r++)for(let c=-1;c<=7;c++){const rr=r0+r,cc=c0+c;if(rr<0||cc<0||rr>=N||cc>=N)continue;const on=r>=0&&r<=6&&c>=0&&c<=6&&(r===0||r===6||c===0||c===6||(r>=2&&r<=4&&c>=2&&c<=4));set(rr,cc,on);}};finder(0,0);finder(0,N-7);finder(N-7,0);
 for(let i=8;i<N-8;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
 const A=QRALN[v];for(const r of A)for(const c of A){if((r===6&&c===6)||(r===6&&c===A[A.length-1])||(r===A[A.length-1]&&c===6))continue;for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++)set(r+dr,c+dc,Math.max(Math.abs(dr),Math.abs(dc))!==1);}
 set(N-8,8,true);for(let i=0;i<9;i++){if(!fixed[8][i])set(8,i,false);if(!fixed[i][8])set(i,8,false);}for(let i=0;i<8;i++){set(8,N-1-i,false);set(N-1-i,8,false);}
 if(v>=7){const vb=QRVER[v];for(let i=0;i<18;i++){const bit=(vb>>>i)&1,a=Math.floor(i/3),b=N-11+i%3;set(a,b,!!bit);set(b,a,!!bit);}}
 const dbits=[];seq.forEach(x=>{for(let i=7;i>=0;i--)dbits.push((x>>>i)&1);});let k=0;
 for(let c=N-1;c>0;c-=2){if(c===6)c--;for(let i=0;i<N;i++){const up=((N-1-c)>>1)%2===0;const r=up?N-1-i:i;for(let d=0;d<2;d++){const cc=c-d;if(!fixed[r][cc]){M[r][cc]=k<dbits.length?!!dbits[k]:false;k++;}}}}
 const MASKS=[(r,c)=>(r+c)%2===0,(r,c)=>r%2===0,(r,c)=>c%3===0,(r,c)=>(r+c)%3===0,(r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0,(r,c)=>(r*c)%2+(r*c)%3===0,(r,c)=>((r*c)%2+(r*c)%3)%2===0,(r,c)=>((r+c)%2+(r*c)%3)%2===0];
 const fmt=mask=>{const d=(0<<3)|mask;let rem=d;for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);return((d<<10)|rem)^0x5412;};
 const build=mask=>{const Q=M.map((row,r)=>row.map((val,c)=>fixed[r][c]?val:(val!==MASKS[mask](r,c))));const f=fmt(mask);
  const bt=i=>!!((f>>>i)&1);for(let i=0;i<=5;i++)Q[i][8]=bt(i);Q[7][8]=bt(6);Q[8][8]=bt(7);Q[8][7]=bt(8);for(let i=9;i<15;i++)Q[8][14-i]=bt(i);
  for(let i=0;i<8;i++)Q[8][N-1-i]=bt(i);for(let i=8;i<15;i++)Q[N-15+i][8]=bt(i);Q[N-8][8]=true;return Q;};
 const penalty=Q=>{let p=0;for(let r=0;r<N;r++){let run=1;for(let c=1;c<N;c++){if(Q[r][c]===Q[r][c-1]){run++;if(run===5)p+=3;else if(run>5)p++;}else run=1;}}for(let c=0;c<N;c++){let run=1;for(let r=1;r<N;r++){if(Q[r][c]===Q[r-1][c]){run++;if(run===5)p+=3;else if(run>5)p++;}else run=1;}}
  for(let r=0;r<N-1;r++)for(let c=0;c<N-1;c++){const v0=Q[r][c];if(v0===Q[r][c+1]&&v0===Q[r+1][c]&&v0===Q[r+1][c+1])p+=3;}let dark=0;Q.forEach(row=>row.forEach(x=>{if(x)dark++;}));p+=Math.floor(Math.abs(dark*20-N*N*10)/(N*N))*10;return p;};
 let best=null,bp=Infinity;for(let m=0;m<8;m++){const Q=build(m),p=penalty(Q);if(p<bp){bp=p;best=Q;}}return best;}
function qrSVG(text,px){const Q=qrMatrix(text);if(!Q)return '';const N=Q.length,q=4,S=N+2*q;let d='';Q.forEach((row,r)=>row.forEach((on,c)=>{if(on)d+=`M${c+q} ${r+q}h1v1h-1z`;}));
 return `<svg viewBox="0 0 ${S} ${S}" width="${px||200}" height="${px||200}" role="img" aria-label="UPI payment QR code" shape-rendering="crispEdges"><rect width="${S}" height="${S}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;}

/* ---------- the Plans page ---------- */
let PLANSEL='M';
function renderPlans(){if(!STORE_PLAY&&accountsOn()){renderPlansSecure();return;}if(STORE_PLAY){$('#plansBox').innerHTML=`<div class="note good"><b>Everything is unlocked in this Google Play version.</b> NEET and JEE Main practice and mocks, and unlimited practice, are free for now. If paid plans come later, they will be offered through Google Play.</div>`;return;}
 const dev=devId(),prem=isPremium(),p=PAY.plans[PLANSEL];
 $('#plansBox').innerHTML=`${prem?`<div class="note good"><b>Premium is active on this device</b> (${PAY.plans[ST.prem.plan].label}) until ${dayDate(ST.prem.exp)}. Thank you!</div>`:''}
 <div class="plans">
  <div class="plan"><span class="eyebrow">Free</span><div class="price">₹0</div><ul><li>All 52 NCERT chapters, Class 6–12</li><li>Animations, lessons, worked examples and quick checks</li><li>Class mock tests and drills</li><li>3 extra practice sets a day</li></ul>${prem?'':'<span class="chip good">Your current plan</span>'}</div>
  <div class="plan ${PLANSEL==='M'?'best':''}"><span class="eyebrow">Premium · monthly</span><div class="price">₹199<small> / month</small></div><ul><li>Everything in Free</li><li>NEET Physics: all 20 units, tips and practice</li><li>JEE Main Physics: 20 units, numerical questions</li><li>NEET and JEE mocks marked +4 / −1</li><li>Unlimited new-number practice</li><li>Open until your plan's end date</li></ul><button class="btn ${PLANSEL==='M'?'':'ghost'}" type="button" data-plan="M" aria-pressed="${PLANSEL==='M'}">${PLANSEL==='M'?'Selected':'Choose monthly'}</button></div>
  <div class="plan ${PLANSEL==='Y'?'best':''}"><span class="eyebrow">Premium · yearly</span><div class="price">₹1,999<small> / year</small></div><ul><li>Everything in Premium</li><li>Save ₹389 compared with 12 monthly payments</li><li>Best for a full school, NEET or JEE year</li></ul><button class="btn ${PLANSEL==='Y'?'':'ghost'}" type="button" data-plan="Y" aria-pressed="${PLANSEL==='Y'}">${PLANSEL==='Y'?'Selected':'Choose yearly'}</button></div></div>
 <div class="grid2 pay-steps" style="margin-top:20px">
  <div class="panel stack"><span class="eyebrow">Step 1 · Pay ₹${p.price.toLocaleString('en-IN')} by UPI</span>
   <a class="btn" href="${upiLink(PLANSEL)}" id="upiBtn">Pay ₹${p.price.toLocaleString('en-IN')} with GPay / UPI</a>
   <div class="row" style="align-items:flex-start;gap:18px"><div class="qr">${qrSVG(upiLink(PLANSEL),180)}</div><div class="stack" style="gap:6px;min-width:150px;flex:1"><p class="muted" style="margin:0">On a computer, scan this with any UPI app. Or pay by hand to:</p><p style="margin:0"><b>${PAY.name}</b><br><span style="font-family:var(--f-mono);overflow-wrap:anywhere">${PAY.upi}</span></p><button class="btn quiet sm" type="button" id="upiCopy">Copy UPI ID</button><p class="faint" style="font-size:.85rem;margin:0">Add the note <b>PhysiQuest ${dev}</b> so the payment can be matched to you.</p></div></div>
   <p class="faint" style="font-size:.85rem;margin:0">If your UPI app will not open from the button, scan the QR code or pay to the UPI ID directly. PhysiQuest never asks for your UPI PIN, card or bank details.</p></div>
  <div class="panel stack"><span class="eyebrow">Step 2 · Send your payment details</span>
   <p class="muted" style="margin:0">After paying, copy the 12-digit UPI transaction ID (UTR) from your UPI app.</p>
   <div class="field"><label for="payUtr">UPI transaction ID (UTR)</label><input id="payUtr" type="text" inputmode="numeric" autocomplete="off" placeholder="For example 412345678901"></div>
   <div class="field"><label for="payName">Your name (optional)</label><input id="payName" type="text" autocomplete="name"></div>
   <p style="margin:0">Your Device ID: <b class="m" style="font-family:var(--f-mono);font-size:1.1rem;letter-spacing:.08em">${dev}</b></p>
   <div class="row"><button class="btn sm" type="button" id="paySend">Send by email</button><button class="btn quiet sm" type="button" id="payCopy">Copy details</button></div><p class="faint" id="payMsg" role="status" style="font-size:.88rem;margin:0"></p>
   <span class="eyebrow" style="margin-top:8px">Step 3 · Enter your unlock code</span>
   <p class="muted" style="margin:0">Once the payment is checked, you will get a 12-character unlock code. It works only on this device.</p>
   <div class="field"><label for="payCode">Unlock code</label><input id="payCode" type="text" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX"></div>
   <div class="row"><button class="btn" type="button" id="payUnlock">Unlock Premium</button></div><p id="unlockMsg" role="status" style="margin:0"></p></div></div>`;
 $$('#plansBox [data-plan]').forEach(b=>b.addEventListener('click',()=>{PLANSEL=b.dataset.plan;renderPlans();}));
 $('#upiCopy').addEventListener('click',async()=>{let ok=false;try{await navigator.clipboard.writeText(PAY.upi);ok=true;}catch(e){}$('#upiCopy').textContent=ok?'Copied':PAY.upi;});
 const details=()=>{const utr=$('#payUtr').value.trim(),nm=$('#payName').value.trim();return{utr,nm,subject:`PhysiQuest payment · ${p.key} · ${dev}`,body:`Plan: ${p.label} (₹${p.price})\nDevice ID: ${dev}\nUPI transaction ID (UTR): ${utr}\nName: ${nm||'not given'}\nDate: ${new Date().toLocaleString('en-IN')}\n\n— PhysiQuest ${APP_VER}`};};
 const check=d=>{const m=$('#payMsg');if(!/^\d{12}$/.test(d.utr.replace(/\s/g,''))){m.textContent='Enter the 12-digit UPI transaction ID (UTR) from your UPI app first.';m.style.color='var(--bad)';$('#payUtr').focus();return false;}m.style.color='';return true;};
 $('#paySend').addEventListener('click',()=>{const d=details();if(!check(d))return;ST.payments=(ST.payments||[]).concat([{plan:PLANSEL,utr:d.utr,at:Date.now()}]).slice(-10);save();location.href=`mailto:${PAY.to}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;$('#payMsg').textContent='Your email app should open with the details filled in. Press send there. Your unlock code will come back to you.';});
 $('#payCopy').addEventListener('click',async()=>{const d=details();if(!check(d))return;const t=`To: ${PAY.to}\nSubject: ${d.subject}\n\n${d.body}`;let ok=false;try{await navigator.clipboard.writeText(t);ok=true;}catch(e){}$('#payMsg').textContent=ok?`Copied. Send it to ${PAY.to}.`:t;});
 $('#payUnlock').addEventListener('click',()=>{const r=readCodeU($('#payCode').value,dev),m=$('#unlockMsg');if(r.err){m.innerHTML=`<span style="color:var(--bad)">${r.err}</span>`;return;}
  ST.prem={plan:r.plan,exp:r.exp,code:makeCode(dev,r.plan,r.exp)};save();toast('Premium unlocked',`${PAY.plans[r.plan].label} until ${dayDate(r.exp)}`);burst(1.4);renderPlans();});}
HOOKS.plans={show:renderPlans};
