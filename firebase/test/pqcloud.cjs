/* copied from the app by build.py: do not edit here */
/* ================= PhysiQuest cloud: Google sign-in and the database, over plain HTTPS =================
   No big libraries: the app still opens instantly and works offline. Firebase's own web addresses are used:
   Identity Toolkit (sign-in), Secure Token (keeping the sign-in fresh) and Firestore (the database).
   The database rules decide what each person may read or write; this code just asks. */
const PQC=(()=>{
 const W=typeof window!=='undefined'?window:globalThis;
 const C=Object.assign({authUrl:'https://identitytoolkit.googleapis.com',tokenUrl:'https://securetoken.googleapis.com',fsUrl:'https://firestore.googleapis.com',owner:'mugilstrange@gmail.com'},W.PQ_CLOUD||{});
 const on=()=>!!(C.apiKey&&C.projectId);
 const SKEY='physiquest-auth';
 class CloudErr extends Error{constructor(code,msg){super(msg);this.code=code;this.friendly=true;}}
 const MSG={offline:'No internet connection. Connect and try again.',busy:'The server is busy. Please try again in a minute.',denied:'You are not allowed to do that.',
  'signed-out':'Please sign in first.',exists:'That already exists.',expired:'Your sign-in has expired. Please sign in again.'};
 const err=(code,m)=>new CloudErr(code,m||MSG[code]||'Something went wrong. Please try again.');
 let S=null;try{S=JSON.parse(localStorage.getItem(SKEY)||'null');if(!S||typeof S!=='object'||!S.uid||!S.refresh)S=null;}catch(e){S=null;}
 const keep=()=>{try{if(S)localStorage.setItem(SKEY,JSON.stringify(S));else localStorage.removeItem(SKEY);}catch(e){}};
 const listeners=new Set();const changed=()=>listeners.forEach(f=>{try{f(S);}catch(e){}});

 /* one request, with a time limit; turns every failure into a clear CloudErr */
 async function req(method,url,body,form,tok){const ctl=typeof AbortController!=='undefined'?new AbortController():null;const t=ctl?setTimeout(()=>ctl.abort(),20000):0;let r;
  const h={};if(body!==undefined)h['Content-Type']=form?'application/x-www-form-urlencoded':'application/json';if(tok)h.Authorization='Bearer '+tok;
  try{r=await fetch(url,{method,headers:h,body:body===undefined?undefined:(form?body:JSON.stringify(body)),signal:ctl?ctl.signal:undefined});}catch(e){throw err('offline');}finally{if(t)clearTimeout(t);}
  let j=null;const txt=await r.text().catch(()=>'');try{j=txt?JSON.parse(txt):null;}catch(e){}
  if(r.ok)return j;
  const e0=Array.isArray(j)?j[0]&&j[0].error:j&&j.error;const st=e0&&(e0.status||(e0.message||'').split(' ')[0])||'';
  if(r.status===404||st==='NOT_FOUND')return null;
  if(r.status===409||st==='ALREADY_EXISTS'||(st==='FAILED_PRECONDITION'&&/exist/i.test(e0&&e0.message||'')))throw err('exists');
  if(r.status===403||st==='PERMISSION_DENIED')throw err('denied');
  if(/TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_NOT_FOUND|USER_DISABLED|INVALID_ID_TOKEN|CREDENTIAL_TOO_OLD/.test(st))throw err('expired');
  if(r.status===401||st==='UNAUTHENTICATED')throw err('expired');
  if(r.status>=500||r.status===429)throw err('busy');
  throw err('bad',(e0&&e0.message)?'The request was refused: '+String(e0.message).slice(0,120):undefined);}

 /* ---------- sign-in ---------- */
 function setSession(r,old){S={uid:r.localId||r.user_id||(old&&old.uid),email:r.email||(old&&old.email)||'',name:r.displayName||r.fullName||(old&&old.name)||'',
  idToken:r.idToken||r.id_token,refresh:r.refreshToken||r.refresh_token,exp:Date.now()+((+(r.expiresIn||r.expires_in)||3600)-120)*1000,
  at:old&&old.at?old.at:Date.now()};keep();}  /* at = when this person last signed in with Google */
 /* a Google ID token (from the Android sign-in sheet or Google's web button) becomes a PhysiQuest sign-in */
 async function signInGoogle(googleIdToken){if(!on())throw err('off','Accounts are not switched on yet.');
  const r=await req('POST',`${C.authUrl}/v1/accounts:signInWithIdp?key=${C.apiKey}`,{postBody:'id_token='+encodeURIComponent(googleIdToken)+'&providerId=google.com',requestUri:'http://localhost',returnSecureToken:true,returnIdpCredential:true});
  if(!r||!r.idToken)throw err('bad','Google sign-in did not work. Please try again.');setSession(r,null);changed();return S;}
 let refreshing=null;
 async function token(){if(!S)throw err('signed-out');if(Date.now()<S.exp&&S.idToken)return S.idToken;
  if(!refreshing)refreshing=(async()=>{try{const r=await req('POST',`${C.tokenUrl}/v1/token?key=${C.apiKey}`,'grant_type=refresh_token&refresh_token='+encodeURIComponent(S.refresh),true);setSession(r,S);}
   catch(e){if(e.code==='expired'||e.code==='bad'){S=null;keep();changed();}throw e;}finally{refreshing=null;}})();
  await refreshing;return S.idToken;}
 function signOut(){S=null;keep();changed();}

 /* ---------- the database (Firestore REST) ---------- */
 const root=()=>`projects/${C.projectId}/databases/(default)/documents`;
 const url=p=>`${C.fsUrl}/v1/${root()}/${p}`;
 function enc(v){if(v===null||v===undefined)return{nullValue:null};if(typeof v==='boolean')return{booleanValue:v};
  if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(typeof v==='string')return{stringValue:v};
  if(v instanceof Date)return{timestampValue:v.toISOString()};if(Array.isArray(v))return{arrayValue:{values:v.map(enc)}};
  const f={};for(const k in v)f[k]=enc(v[k]);return{mapValue:{fields:f}};}
 function dec(x){if(!x)return null;if('stringValue'in x)return x.stringValue;if('integerValue'in x)return Number(x.integerValue);if('doubleValue'in x)return x.doubleValue;
  if('booleanValue'in x)return x.booleanValue;if('nullValue'in x)return null;if('timestampValue'in x)return new Date(x.timestampValue);
  if('arrayValue'in x)return(x.arrayValue.values||[]).map(dec);if('mapValue'in x)return fields(x.mapValue.fields);return null;}
 function fields(f){const o={};for(const k in (f||{}))o[k]=dec(f[k]);return o;}
 const encFields=o=>{const f={};for(const k in o)f[k]=enc(o[k]);return f;};
 const idOf=name=>String(name||'').split('/').pop();
 async function get(path){const j=await req('GET',url(path),undefined,false,await token());return j?Object.assign(fields(j.fields),{_id:idOf(j.name)}):null;}
 /* replace a whole document (create it if missing) */
 async function set(path,obj){await req('PATCH',url(path),{fields:encFields(obj)},false,await token());}
 /* create only if it does not exist yet */
 async function create(path,obj){await req('PATCH',url(path)+'?currentDocument.exists=false',{fields:encFields(obj)},false,await token());}
 async function del(path){await req('DELETE',url(path),undefined,false,await token());}
 /* documents in a collection where every field equals the given value */
 async function query(coll,where,limit){const filters=Object.keys(where).map(k=>({fieldFilter:{field:{fieldPath:k},op:'EQUAL',value:enc(where[k])}}));
  const sq={from:[{collectionId:coll}],limit:limit||100};if(filters.length===1)sq.where=filters[0];else if(filters.length)sq.where={compositeFilter:{op:'AND',filters}};
  const j=await req('POST',`${C.fsUrl}/v1/${root()}:runQuery`,{structuredQuery:sq},false,await token());
  return(j||[]).filter(x=>x.document).map(x=>Object.assign(fields(x.document.fields),{_id:idOf(x.document.name)}));}
 /* several writes that all happen together, or not at all */
 async function commit(writes){await req('POST',`${C.fsUrl}/v1/${root()}:commit`,{writes:writes.map(w=>{const o={update:{name:`${root()}/${w.path}`,fields:encFields(w.data)}};
  if(w.mask)o.updateMask={fieldPaths:w.mask};if(w.mustExist)o.currentDocument={exists:true};return o;})},false,await token());}
 /* deletes the sign-in account itself (the database records are removed first by the caller) */
 async function deleteAccount(){const t=await token();await req('POST',`${C.authUrl}/v1/accounts:delete?key=${C.apiKey}`,{idToken:t});signOut();}

 return{C,on,CloudErr,err,user:()=>S,isOwner:()=>!!(S&&S.email&&S.email.toLowerCase()===String(C.owner).toLowerCase()),onChange:f=>listeners.add(f),
  signInGoogle,signOut,token,get,set,create,del,query,commit,deleteAccount,enc,dec};
})();
if(typeof module!=='undefined')module.exports=PQC;
