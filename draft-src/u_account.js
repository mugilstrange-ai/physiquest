/* ================= accounts and secure payments =================
   Switched on when app-config.json holds the Firebase settings; until then the app works fully offline as before.
   Sign-in: Google, email + password (with password reset), or mobile number + OTP (Firebase Authentication).
   Payments: Razorpay. The server sets the price, checks every payment with Razorpay and alone grants Premium.
   Under-18 students need a parent's consent (the parent's mobile, confirmed by OTP) before paying. */
const ACC={mode:'off',cfg:null,fb:null,user:null,info:null,loading:false,tab:'google',phoneConf:null,parent:null,ret:'',payMsg:'',err:''};
const FB_VER='10.12.2';
const PRIVACY_URL='https://github.com/mugilstrange-ai/physiquest/blob/main/PRIVACY.md';
const IN_STATES=['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];
const CLS_OPTS=[['6','Class 6'],['7','Class 7'],['8','Class 8'],['9','Class 9'],['10','Class 10'],['11','Class 11'],['12','Class 12'],['dropper','Preparing for NEET / JEE (after Class 12)'],['college','College'],['other','Other']];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const onAndroid=()=>!!(window.PQAndroid&&typeof PQAndroid.googleSignIn==='function');
if(!isObj(ST.acct))ST.acct=null;

/* ---------- start: read the settings, restore a previous sign-in ---------- */
ACC.ready=(async()=>{try{const r=await fetch('app-config.json',{cache:'no-store'});if(!r.ok)return;const c=await r.json();
 if(c&&c.firebase&&c.firebase.apiKey&&c.firebase.projectId){ACC.cfg=c;ACC.mode='on';}}catch(e){}})();
ACC.ready.then(()=>{if(ACC.mode!=='on')return;document.documentElement.classList.add('acc-on');
 if(ST.acct)accFirebase().catch(()=>{});      /* signed in before: refresh Premium in the background */
 if(curView&&['plans','account','neet','jee','neetunit','jeeunit'].includes(curView)){curView=null;safe(route,'route');}});

/* Firebase is loaded only when needed, so the app still opens instantly and offline */
async function accFirebase(){if(ACC.fb)return ACC.fb;if(ACC.mode!=='on')throw accErr('Accounts are not switched on yet.');
 const base=`https://www.gstatic.com/firebasejs/${FB_VER}/`;let appM,authM;
 try{[appM,authM]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js')]);}catch(e){throw accErr('No internet connection. Connect and try again.');}
 const app=appM.initializeApp(ACC.cfg.firebase);const auth=authM.getAuth(app);auth.languageCode='en';
 ACC.fb={appM,authM,app,auth};let first=true;
 authM.onAuthStateChanged(auth,u=>{ACC.user=u;ACC.infoErr='';if(u)accRefresh().catch(e=>{ACC.infoErr=friendly(e)||'Could not load your account.';logErr(e,'acc refresh');accRerender();});else{if(ST.acct){ST.acct=null;save();}ACC.info=null;if(!first)accRerender();}first=false;});
 return ACC.fb;}
function accErr(m){const e=new Error(m);e.friendly=true;return e;}
const AUTH_MSG={'auth/invalid-credential':'The email or password is not right.','auth/wrong-password':'The email or password is not right.','auth/user-not-found':'No account uses this email. Create one instead.',
 'auth/email-already-in-use':'An account already uses this email. Sign in instead.','auth/weak-password':'Use a password of at least 8 characters.','auth/invalid-email':'Please enter a valid email address.',
 'auth/too-many-requests':'Too many tries. Please wait a few minutes and try again.','auth/network-request-failed':'No internet connection. Connect and try again.',
 'auth/invalid-verification-code':'That OTP is not right. Check the SMS and try again.','auth/code-expired':'That OTP has expired. Send a new one.','auth/invalid-phone-number':'Please enter a valid 10-digit mobile number.',
 'auth/quota-exceeded':'Too many OTPs were sent today. Please sign in with Google or email instead.','auth/popup-blocked':'The sign-in window was blocked. Please allow pop-ups and try again.',
 'auth/account-exists-with-different-credential':'This email already has an account with another sign-in method. Use that method.','auth/missing-phone-number':'Please enter your mobile number.',
 'auth/captcha-check-failed':'The security check failed. Please try again.','auth/user-disabled':'This account has been switched off. Please contact support.'};
const friendly=e=>e&&(e.friendly?e.message:AUTH_MSG[e.code])||(e&&e.code==='auth/popup-closed-by-user'?'':'Something went wrong. Please try again.');

/* every server request carries the student's sign-in token; the server checks it */
async function api(name,data){const {auth}=await accFirebase();const u=auth.currentUser;if(!u)throw accErr('Please sign in first.');
 const tok=await u.getIdToken();const url=`https://${ACC.cfg.region||'asia-south1'}-${ACC.cfg.firebase.projectId}.cloudfunctions.net/${name}`;let r;
 try{r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify({data:data||{}})});}catch(e){throw accErr('No internet connection. Connect and try again.');}
 const j=await r.json().catch(()=>({}));if(j.error)throw accErr(j.error.message||'Something went wrong. Please try again.');if(!r.ok)throw accErr('The server is busy. Please try again in a minute.');return j.result;}

/* after sign-in: load the account, bring progress across, cache Premium for offline use */
async function accRefresh(){const info=await api('getAccount');ACC.info=info;ACC.infoErr='';ST.acct={uid:ACC.user.uid,sub:info.sub||null};save();
 if(info.progress){try{const added=mergeCode(readCode(info.progress));if(added){updateXP();if(window.renderBadges)renderBadges();}}catch(e){logErr(e,'merge cloud progress');}}
 accSyncNow(true);accRerender();}
function accRerender(){if(['account','plans','neet','jee','neetunit','jeeunit'].includes(curView)){const v=curView;curView=null;safe(route,'route');}accNav();}
function accNav(){const a=$('#navAcc');if(a)a.querySelector('span').textContent=ACC.user?'My account':'Sign in';}

/* ---------- progress saved to the account (so a lost phone does not mean lost progress) ---------- */
let accLastCode='',accSyncT=0;
async function accSyncNow(force){if(ACC.mode!=='on'||!ACC.user||!ACC.info)return;const code=progCode();if(!force&&code===accLastCode)return;
 try{await api('saveProgress',{code});accLastCode=code;accSyncT=Date.now();}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)accSyncNow();});
setInterval(()=>{if(Date.now()-accSyncT>180000)accSyncNow();},60000);

/* ---------- Android hands sign-in and payment results back here ---------- */
const NATIVE={};
window.pqNative=function(m){try{if(typeof m==='string')m=JSON.parse(m);const f=NATIVE[m.type];if(f){delete NATIVE[m.type];f(m);}}catch(e){logErr(e,'native');}};
const nativeCall=(type,start)=>new Promise(res=>{NATIVE[type]=res;start();});

/* ---------- sign-in ---------- */
async function signInGoogle(){const {authM,auth}=await accFirebase();
 if(onAndroid()){const m=await nativeCall('google',()=>PQAndroid.googleSignIn(ACC.cfg.googleWebClientId||''));
  if(!m.idToken){if(m.error)throw accErr(m.error);return;}
  await authM.signInWithCredential(auth,authM.GoogleAuthProvider.credential(m.idToken));return;}
 await authM.signInWithPopup(auth,new authM.GoogleAuthProvider());}
async function signInEmail(mode,email,pw){const {authM,auth}=await accFirebase();
 if(mode==='new'){if(pw.length<8)throw accErr('Use a password of at least 8 characters.');await authM.createUserWithEmailAndPassword(auth,email,pw);}
 else await authM.signInWithEmailAndPassword(auth,email,pw);}
async function resetPassword(email){const {authM,auth}=await accFirebase();if(!/^\S+@\S+\.\S+$/.test(email))throw accErr('Enter your email address first.');
 await authM.sendPasswordResetEmail(auth,email);}
const mobile10=s=>{const d=String(s||'').replace(/\D/g,'').replace(/^(91|0)(?=[6-9]\d{9}$)/,'');return /^[6-9]\d{9}$/.test(d)?d:null;};
/* the OTP needs Google's invisible “I am not a robot” check, which runs on its own */
async function sendOtp(auth,authM,num,btnId){const n=mobile10(num);if(!n)throw accErr('Please enter a valid 10-digit mobile number.');
 const v=new authM.RecaptchaVerifier(auth,btnId,{size:'invisible'});try{return await authM.signInWithPhoneNumber(auth,'+91'+n,v);}finally{try{v.clear();}catch(e){}}}

/* ---------- the account page ---------- */
function accBox(){return $('#accBox');}
function showAccount(){const box=accBox();if(!box)return;
 if(ACC.mode!=='on'){box.innerHTML=`<div class="panel stack"><h2 style="margin:0">Accounts are coming soon</h2><p class="muted" style="margin:0">In this version your progress is saved on this phone only. To move it to another device, use a progress code on the <a href="#badges">Badges</a> page.</p></div>`;return;}
 if(!ACC.fb){box.innerHTML='<div class="panel"><p class="muted" style="margin:0">Loading…</p></div>';accFirebase().then(()=>{if(curView==='account')showAccount();}).catch(e=>{box.innerHTML=`<div class="panel stack"><p style="margin:0">${esc(friendly(e))}</p><button class="btn sm" type="button" id="accRetry" style="align-self:flex-start">Try again</button></div>`;$('#accRetry').addEventListener('click',showAccount);});return;}
 if(!ACC.user)return accSignInView(box);
 if(!ACC.info){if(ACC.infoErr){box.innerHTML=`<div class="panel stack"><p style="margin:0">${esc(ACC.infoErr)}</p><div class="row"><button class="btn sm" type="button" id="accRetry2">Try again</button><button class="btn quiet sm" type="button" id="accOut3">Sign out</button></div></div>`;$('#accRetry2').addEventListener('click',e=>run(e.currentTarget,'x',accRefresh));$('#accOut3').addEventListener('click',accSignOut);return;}box.innerHTML='<div class="panel"><p class="muted" style="margin:0">Loading your account…</p></div>';return;}
 if(!ACC.info.profile)return accProfileView(box,true);
 if(ACC.info.needsParent)return accParentView(box);
 accSummaryView(box);}
HOOKS.account={show:showAccount};

function busyBtn(btn,on,txt){if(!btn)return;if(on){btn.dataset.t=btn.textContent;btn.textContent=txt||'Please wait…';btn.disabled=true;}else{btn.textContent=btn.dataset.t||btn.textContent;btn.disabled=false;}}
function setMsg(id,msg,good){const el=$('#'+id);if(!el)return;el.textContent=msg||'';el.className='acc-msg'+(good?' good':msg?' bad':'');}
async function run(btn,msgId,fn){setMsg(msgId,'');busyBtn(btn,true);try{await fn();}catch(e){const m=friendly(e);if(m)setMsg(msgId,m);logErr(e,'account');}finally{busyBtn(btn,false);}}

function accSignInView(box){const t=ACC.tab;
 box.innerHTML=`<div class="panel stack acc-card"><h2 style="margin:0">Sign in or create an account</h2>
  <p class="muted" style="margin:0">Your account keeps your Premium plan and your progress safe, even if you change phones.</p>
  <div class="acc-seg" role="tablist" aria-label="How to sign in">${[['google','Google'],['phone','Mobile OTP'],['email','Email']].map(([k,l])=>`<button type="button" role="tab" aria-selected="${t===k}" class="${t===k?'on':''}" data-tab="${k}">${l}</button>`).join('')}</div>
  <div id="accPane"></div><p class="acc-msg" id="accMsg" role="alert"></p>
  <p class="faint" style="font-size:.85rem;margin:0">By continuing you agree to the <a href="${PRIVACY_URL}" target="_blank" rel="noopener">privacy policy</a>. Students under 18 will be asked for a parent’s consent.</p></div>`;
 $$('#accBox [data-tab]').forEach(b=>b.addEventListener('click',()=>{ACC.tab=b.dataset.tab;ACC.phoneConf=null;accSignInView(box);}));
 const pane=$('#accPane');
 if(t==='google'){pane.innerHTML=`<button class="btn" type="button" id="gBtn"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#fff" opacity=".8" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#fff" opacity=".6" d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2z"/><path fill="#fff" opacity=".9" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z"/></svg>Continue with Google</button>`;
  $('#gBtn').addEventListener('click',e=>run(e.currentTarget,'accMsg',signInGoogle));}
 else if(t==='phone'){if(!ACC.phoneConf){pane.innerHTML=`<form class="stack" id="phForm" novalidate><div class="field"><label for="phNum">Mobile number</label><div class="ph-row"><span class="ph-cc">+91</span><input id="phNum" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="98765 43210"></div></div><button class="btn" type="submit" id="phSend">Send OTP</button></form>`;
   $('#phForm').addEventListener('submit',e=>{e.preventDefault();const b=$('#phSend');run(b,'accMsg',async()=>{const {authM,auth}=await accFirebase();ACC.phoneConf=await sendOtp(auth,authM,$('#phNum').value,'phSend');ACC.phoneNum=mobile10($('#phNum').value);ACC.otpAt=Date.now();accSignInView(box);setMsg('accMsg','OTP sent by SMS to +91 '+ACC.phoneNum+'.',true);});});}
  else{pane.innerHTML=`<form class="stack" id="otpForm" novalidate><div class="field"><label for="otp">Enter the 6-digit OTP sent to +91 ${esc(ACC.phoneNum)}</label><input id="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></div><div class="row"><button class="btn" type="submit" id="otpGo">Verify and sign in</button><button class="btn quiet sm" type="button" id="otpBack">Change number</button></div></form>`;
   $('#otpBack').addEventListener('click',()=>{ACC.phoneConf=null;accSignInView(box);});
   $('#otpForm').addEventListener('submit',e=>{e.preventDefault();run($('#otpGo'),'accMsg',async()=>{const c=$('#otp').value.replace(/\D/g,'');if(c.length!==6)throw accErr('The OTP has 6 digits.');await ACC.phoneConf.confirm(c);ACC.phoneConf=null;});});}}
 else{pane.innerHTML=`<form class="stack" id="emForm" novalidate><div class="field"><label for="emAddr">Email</label><input id="emAddr" type="email" autocomplete="email" placeholder="you@example.com"></div>
   <div class="field"><label for="emPw">Password</label><input id="emPw" type="password" autocomplete="current-password" placeholder="At least 8 characters"></div>
   <div class="row"><button class="btn" type="submit" id="emIn">Sign in</button><button class="btn ghost" type="button" id="emNew">Create account</button></div>
   <button class="btn quiet sm" type="button" id="emForgot" style="align-self:flex-start">Forgot password?</button></form>`;
  const v=()=>[$('#emAddr').value.trim(),$('#emPw').value];
  $('#emForm').addEventListener('submit',e=>{e.preventDefault();const [a,p]=v();run($('#emIn'),'accMsg',()=>signInEmail('in',a,p));});
  $('#emNew').addEventListener('click',e=>{const [a,p]=v();run(e.currentTarget,'accMsg',()=>signInEmail('new',a,p));});
  $('#emForgot').addEventListener('click',e=>{run(e.currentTarget,'accMsg',async()=>{await resetPassword($('#emAddr').value.trim());setMsg('accMsg','If an account uses this email, a link to set a new password is on its way. Check your inbox and spam folder.',true);});});}}

function accProfileView(box,isNew){const p=(ACC.info&&ACC.info.profile)||{},u=ACC.user,phoneLocked=!!u.phoneNumber;
 const opt=(list,cur)=>list.map(([v,l])=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(l)}</option>`).join('');
 box.innerHTML=`<form class="panel stack acc-card" id="profForm" novalidate><h2 style="margin:0">${isNew?'Tell us about you':'Edit your details'}</h2>
  <p class="muted" style="margin:0">We only ask what PhysiQuest needs. We never sell your details, and you can delete your account at any time.</p>
  <div class="field"><label for="pfName">Full name</label><input id="pfName" type="text" autocomplete="name" maxlength="60" value="${esc(p.name||u.displayName||'')}"></div>
  <div class="field"><label for="pfCls">Class</label><select id="pfCls"><option value="">Choose…</option>${opt(CLS_OPTS,p.cls)}</select></div>
  <div class="grid2" style="gap:12px"><div class="field"><label for="pfCity">City or town</label><input id="pfCity" type="text" autocomplete="address-level2" maxlength="50" value="${esc(p.city||'')}"></div>
  <div class="field"><label for="pfState">State</label><select id="pfState"><option value="">Choose…</option>${opt(IN_STATES.map(s=>[s,s]),p.state)}</select></div></div>
  <div class="field"><label for="pfPhone">Mobile number ${phoneLocked?'(verified)':'(optional)'}</label><div class="ph-row"><span class="ph-cc">+91</span><input id="pfPhone" type="tel" inputmode="numeric" maxlength="14" ${phoneLocked?'disabled':''} value="${esc((phoneLocked?u.phoneNumber:p.phone||'').replace(/^\+91/,''))}"></div></div>
  <fieldset class="field acc-age"><legend>Are you 18 or older?</legend><label><input type="radio" name="pfAdult" value="1" ${p.adult===true?'checked':''}> Yes, I am 18 or older</label><label><input type="radio" name="pfAdult" value="0" ${p.adult===false?'checked':''}> No, I am under 18</label></fieldset>
  <label class="acc-check"><input type="checkbox" id="pfAgree" ${isNew?'':'checked'}> I agree to the <a href="${PRIVACY_URL}" target="_blank" rel="noopener">privacy policy</a>.</label>
  <div class="row"><button class="btn" type="submit" id="pfSave">${isNew?'Save and continue':'Save changes'}</button>${isNew?'':'<a class="btn quiet sm" href="#account" id="pfCancel">Cancel</a>'}</div><p class="acc-msg" id="pfMsg" role="alert"></p></form>`;
 const c=$('#pfCancel');if(c)c.addEventListener('click',e=>{e.preventDefault();ACC.editing=false;showAccount();});
 $('#profForm').addEventListener('submit',e=>{e.preventDefault();const ad=$('input[name=pfAdult]:checked');
  run($('#pfSave'),'pfMsg',async()=>{if(!$('#pfAgree').checked)throw accErr('Please tick the box to agree to the privacy policy.');if(!ad)throw accErr('Please say whether you are 18 or older.');
   const ph=$('#pfPhone').value.trim();if(!phoneLocked&&ph&&!mobile10(ph))throw accErr('Please enter a 10-digit mobile number, or leave it empty.');
   ACC.info=await api('saveProfile',{name:$('#pfName').value,cls:$('#pfCls').value,city:$('#pfCity').value,state:$('#pfState').value,phone:phoneLocked?'':(ph?mobile10(ph):''),adult:ad.value==='1'});
   ACC.editing=false;toast('Details saved',ACC.info.needsParent?'Next: a parent’s consent':'Welcome, '+ACC.info.profile.name.split(' ')[0]);showAccount();});});}

/* a parent confirms with an OTP on their own phone; it is checked on the server */
function accParentView(box){const P=ACC.parent;
 box.innerHTML=`<div class="panel stack acc-card"><span class="eyebrow">Step 2 of 2</span><h2 style="margin:0">A parent’s consent</h2>
  <p class="muted" style="margin:0">Because you are under 18, a parent or guardian must agree before PhysiQuest keeps your account. Ask them to enter <b>their own</b> mobile number below; they will get an OTP.</p>
  <div class="note"><b>For the parent:</b> PhysiQuest stores your child’s name, class, city, state and contact details to run their account and Premium plan. We never sell them or show ads. You can ask for the account to be deleted at any time.</div>
  ${P&&P.conf?`<form class="stack" id="parOtp" novalidate><div class="field"><label for="parCode">OTP sent to the parent’s mobile +91 ${esc(P.num)}</label><input id="parCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div>
   <label class="acc-check"><input type="checkbox" id="parAgree"> I am this student’s parent or guardian, and I agree.</label>
   <div class="row"><button class="btn" type="submit" id="parGo">Confirm consent</button><button class="btn quiet sm" type="button" id="parBack">Change number</button></div></form>`
  :`<form class="stack" id="parForm" novalidate><div class="field"><label for="parNum">Parent’s mobile number</label><div class="ph-row"><span class="ph-cc">+91</span><input id="parNum" type="tel" inputmode="numeric" maxlength="14"></div></div><button class="btn" type="submit" id="parSend">Send OTP to the parent</button></form>`}
  <p class="acc-msg" id="parMsg" role="alert"></p><div class="row"><button class="btn quiet sm" type="button" id="parEdit">Edit my details</button><button class="btn quiet sm" type="button" id="accOut2">Sign out</button></div></div>`;
 $('#parEdit').addEventListener('click',()=>{ACC.editing=true;accProfileView(box,false);});$('#accOut2').addEventListener('click',accSignOut);
 const f=$('#parForm');if(f)f.addEventListener('submit',e=>{e.preventDefault();run($('#parSend'),'parMsg',async()=>{const {appM,authM}=await accFirebase();
  if(!ACC.parentApp){ACC.parentApp=appM.initializeApp(ACC.cfg.firebase,'parent');ACC.parentAuth=authM.initializeAuth(ACC.parentApp,{persistence:authM.inMemoryPersistence});}
  const num=mobile10($('#parNum').value);if(num&&ACC.user.phoneNumber==='+91'+num)throw accErr('The parent must use a different mobile number from yours.');
  const conf=await sendOtp(ACC.parentAuth,authM,$('#parNum').value,'parSend');ACC.parent={conf,num};accParentView(box);setMsg('parMsg','OTP sent to the parent’s mobile.',true);});});
 const o=$('#parOtp');if(o){$('#parBack').addEventListener('click',()=>{ACC.parent=null;accParentView(box);});
  o.addEventListener('submit',e=>{e.preventDefault();run($('#parGo'),'parMsg',async()=>{if(!$('#parAgree').checked)throw accErr('The parent needs to tick the box to agree.');
   const c=$('#parCode').value.replace(/\D/g,'');if(c.length!==6)throw accErr('The OTP has 6 digits.');const cred=await ACC.parent.conf.confirm(c);const parentToken=await cred.user.getIdToken();
   ACC.info=await api('parentConsent',{parentToken});try{await ACC.fb.authM.signOut(ACC.parentAuth);}catch(e){}ACC.parent=null;toast('Thank you','Parent consent saved');showAccount();});});}}

function accSummaryView(box){if(ACC.editing)return accProfileView(box,false);const p=ACC.info.profile,s=ACC.info.sub,u=ACC.user,prem=isPremium();
 const how=u.phoneNumber&&!u.email?'Mobile '+u.phoneNumber:(u.providerData||[]).some(x=>x.providerId==='google.com')?'Google · '+(u.email||''):'Email · '+(u.email||'');
 box.innerHTML=`<div class="grid2" style="gap:20px;align-items:start"><div class="panel stack acc-card"><span class="eyebrow">Signed in</span><h2 style="margin:0">${esc(p.name)}</h2>
  <p class="muted" style="margin:0">${esc((CLS_OPTS.find(c=>c[0]===p.cls)||['',''])[1])} · ${esc(p.city)}, ${esc(p.state)}</p><p class="faint" style="margin:0;font-size:.9rem;overflow-wrap:anywhere">${esc(how)}</p>
  <div class="row"><button class="btn quiet sm" type="button" id="accEdit">Edit details</button><button class="btn quiet sm" type="button" id="accOut">Sign out</button></div></div>
  <div class="panel stack acc-card"><span class="eyebrow">Your plan</span>${prem&&!STORE_PLAY&&s?`<h2 style="margin:0">Premium</h2><p class="muted" style="margin:0">Until ${dayDate(s.exp)} · ${s.exp-todayN()+1} day${s.exp-todayN()?'s':''} left</p><a class="btn ghost sm" href="#plans" style="align-self:flex-start">Extend</a>`
   :STORE_PLAY?'<h2 style="margin:0">Everything unlocked</h2><p class="muted" style="margin:0">Premium is free in this version.</p>'
   :`<h2 style="margin:0">Free</h2><p class="muted" style="margin:0">${s?'Your Premium ended on '+dayDate(s.exp)+'.':'Unlock NEET, JEE Main and unlimited practice.'}</p><a class="btn sm" href="#plans" style="align-self:flex-start">See plans</a>`}
  <p class="faint" style="margin:0;font-size:.85rem">Progress is saved to your account automatically.</p></div></div>
  <details class="panel acc-danger"><summary>Delete my account</summary><div class="stack" style="margin-top:12px"><p class="muted" style="margin:0">This deletes your details and saved progress from PhysiQuest. Payment records are kept as the law requires. ${prem&&!STORE_PLAY?'<b>Your remaining Premium days will be lost.</b>':''}</p><button class="btn sm danger" type="button" id="accDel" style="align-self:flex-start">Delete my account</button><p class="acc-msg" id="delMsg" role="alert"></p></div></details>`;
 $('#accEdit').addEventListener('click',()=>{ACC.editing=true;accProfileView(box,false);});$('#accOut').addEventListener('click',accSignOut);
 $('#accDel').addEventListener('click',e=>{const b=e.currentTarget;if(!b.dataset.arm){b.dataset.arm=1;b.textContent='Tap again to delete for good';return;}
  run(b,'delMsg',async()=>{await accSyncNow(true);await api('deleteAccount');ST.acct=null;saveNow();try{await ACC.fb.authM.signOut(ACC.fb.auth);}catch(_){}toast('Account deleted','Your progress stays on this phone.');showAccount();});});}
async function accSignOut(){await accSyncNow(true);try{await ACC.fb.authM.signOut(ACC.fb.auth);}catch(e){}ST.acct=null;ACC.info=null;ACC.editing=false;saveNow();accNav();showAccount();}

/* ---------- Plans page with secure checkout ---------- */
let RZP_LOADING=null;
function loadRazorpay(){if(window.Razorpay)return Promise.resolve();if(RZP_LOADING)return RZP_LOADING;
 RZP_LOADING=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.onload=()=>res();s.onerror=()=>{RZP_LOADING=null;rej(accErr('Could not reach the payment page. Check your internet and try again.'));};document.head.appendChild(s);});return RZP_LOADING;}
/* opens Razorpay: the native screen in the Android app (best for GPay/PhonePe), the web checkout elsewhere */
async function openCheckout(o){const opts={key:o.keyId,order_id:o.orderId,amount:o.amount,currency:o.currency,name:'PhysiQuest',description:o.label,
  prefill:{name:o.name||'',email:o.email||'',contact:o.contact||''},notes:{plan:o.plan},theme:{color:'#19e0dc'}};
 if(window.PQAndroid&&typeof PQAndroid.pay==='function')return nativeCall('pay',()=>PQAndroid.pay(JSON.stringify(opts)));
 await loadRazorpay();
 return new Promise(res=>{const rz=new Razorpay(Object.assign(opts,{handler:r=>res({ok:true,orderId:r.razorpay_order_id,paymentId:r.razorpay_payment_id,signature:r.razorpay_signature}),
  modal:{ondismiss:()=>res({ok:false,cancelled:true})}}));rz.on('payment.failed',r=>{/* Razorpay lets the student retry in the same window */logErr(new Error('payment failed: '+(r&&r.error&&r.error.description)),'pay');});rz.open();});}
async function buyPlan(plan,btn){const st=$('#payStatus');const say=(m,cls)=>{if(st){st.className='acc-msg '+(cls||'');st.textContent=m;}};
 if(!ACC.user){ACC.ret='plans';location.hash='#account';return;}
 busyBtn(btn,true,'Opening secure payment…');say('');
 try{const o=await api('createOrder',{plan});const r=await openCheckout(o);
  if(!r||!r.ok){say(r&&r.cancelled?'Payment cancelled. You have not been charged.':(r&&r.message)||'The payment did not go through. You have not been charged.','bad');return;}
  say('Payment received. Confirming it with the bank…','good');busyBtn(btn,true,'Confirming…');
  let res=null;try{res=await api('confirmPayment',{orderId:r.orderId,paymentId:r.paymentId,signature:r.signature});}catch(e){logErr(e,'confirm');}
  if(!res){/* the backup path: Razorpay also tells the server directly, so check back */for(let i=0;i<24&&!res;i++){await new Promise(z=>setTimeout(z,5000));try{const inf=await api('getAccount');if(inf.sub&&inf.sub.exp>=todayN()&&(!ST.acct||!ST.acct.sub||inf.sub.exp!==ST.acct.sub.exp))res={sub:inf.sub};}catch(e){}}}
  if(res&&res.sub){ST.acct={uid:ACC.user.uid,sub:res.sub};saveNow();if(ACC.info)ACC.info.sub=res.sub;toast('Premium unlocked','Until '+dayDate(res.sub.exp));burst(1.4);renderPlans();
   const s2=$('#payStatus');if(s2){s2.className='acc-msg good';s2.textContent='Thank you! Premium is active until '+dayDate(res.sub.exp)+'. Payment ID: '+r.paymentId;}return;}
  say('Your payment is safe and is still being confirmed. Premium will appear here within a few minutes. If it does not, send us this payment ID: '+r.paymentId,'bad');}
 catch(e){say(friendly(e)||'Something went wrong. You have not been charged.','bad');logErr(e,'buy');}
 finally{busyBtn(btn,false);}}
function renderPlansSecure(){const box=$('#plansBox');const prem=isPremium(),s=ST.acct&&ST.acct.sub,P=PAY.plans;
 const gate=!ACC.user?'<a class="btn sm" href="#account">Sign in to buy</a>':ACC.info&&!ACC.info.profile?'<a class="btn sm" href="#account">Add your details first</a>':ACC.info&&ACC.info.needsParent?'<a class="btn sm" href="#account">A parent’s consent is needed first</a>':'';
 const card=(k,extra)=>`<div class="plan ${k==='Y'?'best':''}"><span class="eyebrow">${P[k].label}</span><div class="price">₹${P[k].price.toLocaleString('en-IN')}<small> / ${k==='M'?'month':'year'}</small></div><ul>${extra}</ul>${gate||`<button class="btn ${k==='Y'?'':'ghost'}" type="button" data-buy="${k}">${prem?'Add':'Pay'} ₹${P[k].price.toLocaleString('en-IN')} securely</button>`}</div>`;
 box.innerHTML=`${prem&&s?`<div class="note good"><b>Premium is active</b> until ${dayDate(s.exp)}. Buying again adds the new days after that date.</div>`:''}
 <div class="plans"><div class="plan"><span class="eyebrow">Free</span><div class="price">₹0</div><ul><li>All 52 NCERT chapters, Class 6–12</li><li>Animations, lessons, worked examples and quick checks</li><li>Class mock tests and drills</li><li>3 extra practice sets a day</li></ul>${prem?'':'<span class="chip good">Your current plan</span>'}</div>
  ${card('M','<li>Everything in Free</li><li>NEET Physics: 20 units, tips and practice</li><li>JEE Main Physics: 20 units, numerical questions</li><li>NEET and JEE mocks marked +4 / −1</li><li>Unlimited new-number practice</li>')}
  ${card('Y','<li>Everything in monthly</li><li>366 days for the price of about 10 months</li><li>Best for a full school, NEET or JEE year</li>')}</div>
 <div class="panel stack" style="margin-top:20px"><h2 style="margin:0">Safe payment</h2><p class="muted" style="margin:0">Payments are handled by Razorpay, a payment company regulated in India. Pay with a debit or credit card, GPay, PhonePe, Paytm or any UPI app, or net banking. PhysiQuest never sees your card number or UPI PIN.</p>
  <p class="muted" style="margin:0">Every payment is checked by the PhysiQuest server with Razorpay before Premium is switched on, and Razorpay also tells the server directly, so if the app closes during payment your Premium still arrives.</p><p class="acc-msg" id="payStatus" role="status" aria-live="polite"></p></div>`;
 $$('#plansBox [data-buy]').forEach(b=>b.addEventListener('click',()=>buyPlan(b.dataset.buy,b)));
 if(ACC.user&&!ACC.info&&!ACC.infoErr)accRefresh().catch(()=>{});else if(!ACC.fb)accFirebase().catch(()=>{});}

/* when someone signs in from the Plans page, take them back there once their account is ready */
const accWatch=setInterval(()=>{if(ACC.ret&&ACC.user&&ACC.info&&ACC.info.profile&&!ACC.info.needsParent&&curView==='account'){const r=ACC.ret;ACC.ret='';location.hash='#'+r;}},700);
