import companies from './companies.json';
import {requireValue} from './voting-model.js';
const query=(db,sql,...args)=>db.prepare(sql).bind(...args);
const known=new Set(companies.map(c=>c.id));
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
async function snapshot(db,user){
 const results=await query(db,`SELECT company_id,COUNT(*) AS supporters,NULL AS version FROM capital_company_interest GROUP BY company_id UNION ALL SELECT company_id,-1,version FROM capital_company_interest WHERE user_id=?`,user).all();
 const own=results.results.find(r=>r.supporters===-1);
 const counts=new Map(results.results.filter(r=>r.supporters>=0&&known.has(r.company_id)).map(r=>[r.company_id,r.supporters]));
 const ranked=companies.map(c=>({id:c.id,name:c.name,category:c.category,image:c.image,imagePosition:c.imagePosition,supporters:counts.get(c.id)||0})).sort((a,b)=>b.supporters-a.supporters||a.name.localeCompare(b.name,'en')||a.id.localeCompare(b.id));
 let rank=null;ranked.forEach((c,i)=>{if(i===0||c.supporters!==ranked[i-1].supporters)rank=c.supporters?i+1:null;c.rank=rank;});
 return {companies:ranked,selectedCompany:known.has(own?.company_id)?own.company_id:null,version:own?.version||0,totalPicks:ranked.reduce((n,c)=>n+c.supporters,0)};
}
export async function companyInterest(request,db,auth,readBody){
 if(request.method==='GET')return json(await snapshot(db,auth.user));
 requireValue(request.method==='POST','Method not allowed.',405);
 const input=await readBody(request);
 requireValue(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).length===2&&Object.hasOwn(input,'companyId')&&Object.hasOwn(input,'expectedVersion'),'Send a company choice and its version.');
 requireValue(input.companyId===null||typeof input.companyId==='string'&&known.has(input.companyId),'Choose a company from the current directory.');
 requireValue(Number.isSafeInteger(input.expectedVersion)&&input.expectedVersion>=0&&input.expectedVersion<Number.MAX_SAFE_INTEGER,'Invalid choice version.');
 const {companyId,expectedVersion}=input;
 const changed=expectedVersion===0
  ?await query(db,'INSERT OR IGNORE INTO capital_company_interest(user_id,company_id,version,updated_at) VALUES(?,?,1,unixepoch()) RETURNING version',auth.user,companyId).first()
  :await query(db,'UPDATE capital_company_interest SET company_id=?,version=version+1,updated_at=unixepoch() WHERE user_id=? AND version=? RETURNING version',companyId,auth.user,expectedVersion).first();
 if(!changed){
  const own=await query(db,'SELECT company_id,version FROM capital_company_interest WHERE user_id=?',auth.user).first();
  requireValue(own?.version===expectedVersion+1&&own.company_id===companyId,'Your choice changed in another tab. Refresh and choose again.',409);
 }
 return json(await snapshot(db,auth.user));
}
