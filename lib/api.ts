import { z, ZodError } from "zod";
import { AppError, body, challenge, database, json, rateLimit, requireAdmin, ownerIdentity, rowToSubmission, sameOrigin, sign, verifyChallenge } from "./server";
import { login, logout, setPassword } from "./admin-auth";
import { CATEGORIES, FLAGS, LOCATION_CATEGORIES, PRIORITIES, STATUSES, TERMINAL, changeSchema, feedbackSchema } from "./feedback";
const refSchema=z.string().regex(/^AF-[A-Z2-9]{12}$/);
const closedSql="('Resolved','Closed — No Further Action','Duplicate','Invalid / Insufficient Information')";
const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const referenceCode=()=>"AF-"+Array.from(crypto.getRandomValues(new Uint8Array(12)),n=>alphabet[n%32]).join("");
const sqlRow=async(ref:string)=>database().prepare("SELECT * FROM submissions WHERE reference_code = ?").bind(ref).first<Record<string,unknown>>();
async function find(ref:string){refSchema.parse(ref);const r=await sqlRow(ref);if(!r)throw new AppError(404,"Submission not found.");return r;}
async function update(ref:string,input:unknown,actor:string){const v=changeSchema.parse(input);const r=await find(ref);if(v.version!==Number(r.version))throw new AppError(409,"Another administrator updated this submission. Reload it before saving.");if(r.archived_at)throw new AppError(409,"Restore this submission before making changes.");const stamp=new Date().toISOString();const mutation=crypto.randomUUID();const changes=[];
 if(v.status!==r.status)changes.push("Status changed to "+v.status+(v.reason?". Reason: "+v.reason:""));else if(v.reason)changes.push("Resolution reason recorded: "+v.reason);
 if(JSON.stringify(v.flags)!==r.flags)changes.push("Flags updated: "+(v.flags.join(", ")||"none"));if(v.publicUpdate!==r.public_update)changes.push(v.publicUpdate?"Public update published":"Public update cleared");
 if(!changes.length)return {updated:false};
 const ops=[database().prepare("UPDATE submissions SET status=?,flags=?,public_update=?,updated_at=?,resolved_at=?,version=version+1,last_mutation=? WHERE id=? AND version=?").bind(v.status,JSON.stringify(v.flags),v.publicUpdate,stamp,v.status==="Resolved"?(r.status==="Resolved"?r.resolved_at:stamp):null,mutation,r.id,v.version)];
 for(const event of changes)ops.push(database().prepare("INSERT INTO history (id,submission_id,event,actor,created_at) SELECT ?,id,?,?,? FROM submissions WHERE id=? AND last_mutation=?").bind(crypto.randomUUID(),event,actor,stamp,r.id,mutation));
 const results=await database().batch(ops);if(!results[0].meta.changes)throw new AppError(409,"Another administrator updated this submission. Reload it before saving.");return {updated:true};
}
export async function handle(request:Request){try{
 const path=new URL(request.url).pathname.replace(/\/$/,"");const method=request.method;
 if(method!=="GET")sameOrigin(request);
 if(path==="/api/auth/login"&&method==="POST"){
  await rateLimit(request,"admin-login",8,900000);
  const v=z.object({username:z.string().min(1).max(80),password:z.string().min(1).max(128)}).strict().parse(await body(request));
  const response=json({signedIn:true});response.headers.set("Set-Cookie",await login(v.username,v.password));return response;
 }
 if(path==="/api/auth/logout"&&method==="POST"){
  const response=json({signedOut:true});response.headers.set("Set-Cookie",await logout(request));return response;
 }
 if(path==="/api/auth/password"&&method==="POST"){
  if(!await ownerIdentity())throw new AppError(403,"Only the verified site owner can set this password.");
  await rateLimit(request,"admin-password",5,900000);
  const v=z.object({password:z.string().min(15).max(128),confirmation:z.string().min(15).max(128)}).strict().parse(await body(request));
  if(v.password!==v.confirmation)throw new AppError(400,"The passwords don’t match.");
  await setPassword(v.password);const response=json({saved:true});response.headers.set("Set-Cookie",await logout(request));return response;
 }
 if(path==="/api/feedback/challenge"&&method==="GET"){await rateLimit(request,"challenge",300);return json({challenge:await challenge()});}
 if(path==="/api/feedback"&&method==="POST"){
  const v=feedbackSchema.parse(await body(request));await verifyChallenge(v.challenge);await rateLimit(request,"submit-attempt",200);const db=database();
  const existing=await db.prepare("SELECT reference_code FROM submissions WHERE submission_key=?").bind(v.submissionKey).first<{reference_code:string}>();if(existing)return json({referenceCode:existing.reference_code});
  await rateLimit(request,"feedback",120);const challengeKey="challenge:"+await sign(v.challenge);const now=Date.now();const used=await db.prepare("SELECT count FROM rate_limits WHERE key=?").bind(challengeKey).first<{count:number}>();if(used)throw new AppError(400,"Please refresh the form before submitting again.","CHALLENGE");
  const id=crypto.randomUUID(),ref=referenceCode(),stamp=new Date().toISOString();try { await db.batch<Record<string,unknown>>([db.prepare("INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?)").bind(challengeKey,now+7200000),db.prepare("INSERT INTO submissions (id,reference_code,submission_key,category,subject,message,priority,location,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id,ref,v.submissionKey,v.category,v.subject,v.message,v.priority,LOCATION_CATEGORIES.includes(v.category)?v.location||null:null,stamp,stamp),db.prepare("INSERT INTO history (id,submission_id,event,actor,created_at) VALUES (?,?,?,NULL,?)").bind(crypto.randomUUID(),id,"Submitted",stamp)]); } catch(e) { const retry=await db.prepare("SELECT reference_code FROM submissions WHERE submission_key=?").bind(v.submissionKey).first<{reference_code:string}>();if(retry)return json({referenceCode:retry.reference_code}); const spent=await db.prepare("SELECT count FROM rate_limits WHERE key=?").bind(challengeKey).first();if(spent)throw new AppError(400,"Please refresh the form before submitting again.","CHALLENGE");throw e; } return json({referenceCode:ref},201);
 }
 if(path==="/api/status"&&method==="POST"){await rateLimit(request,"status",40);const v=z.object({referenceCode:refSchema}).strict().parse(await body(request));const r=await database().prepare("SELECT reference_code,status,public_update,updated_at FROM submissions WHERE reference_code=?").bind(v.referenceCode).first<Record<string,string>>();if(!r)throw new AppError(404,"We couldn’t find that code. Check it and try again.");return json({referenceCode:r.reference_code,status:r.status,publicUpdate:r.public_update,updatedAt:r.updated_at});}
 if(!path.startsWith("/api/admin/"))throw new AppError(404,"Not found.");
 const admin=await requireAdmin();await rateLimit(request,"admin:"+admin.userId,180);const actor=admin.email;const db=database();
 if(path==="/api/admin/summary"&&method==="GET"){
  const results=await db.batch<Record<string,unknown>>([
   db.prepare(`SELECT COUNT(*) AS total,SUM(status='New') AS newCount,SUM(flags LIKE '%Needs Attention%') AS attention,SUM(status IN ('Action Planned','In Progress','Awaiting Action','Referred / Escalated')) AS handled,SUM(status='Resolved') AS resolved,SUM(status NOT IN ${closedSql}) AS unresolved,SUM(priority='Urgent' OR flags LIKE '%Urgent%') AS urgent,SUM(date(created_at,'+3 hours')=date('now','+3 hours')) AS today,SUM(julianday(created_at) >= julianday('now','-7 days')) AS thisWeek,SUM(status NOT IN ${closedSql} AND julianday('now')-julianday(created_at)>14) AS overdue,AVG(CASE WHEN resolved_at IS NOT NULL AND status='Resolved' THEN julianday(resolved_at)-julianday(created_at) END) AS averageDays FROM submissions WHERE archived_at IS NULL`),
   db.prepare("SELECT category,COUNT(*) AS count FROM submissions WHERE archived_at IS NULL GROUP BY category ORDER BY count DESC LIMIT 6"),
   db.prepare("SELECT date(created_at,'+3 hours') AS day,COUNT(*) AS count FROM submissions WHERE archived_at IS NULL AND julianday(created_at) >= julianday('now','-14 days') GROUP BY day ORDER BY day"),
   db.prepare("SELECT h.event,h.actor,h.created_at AS createdAt,s.reference_code AS referenceCode FROM history h JOIN submissions s ON s.id=h.submission_id ORDER BY h.created_at DESC,h.rowid DESC LIMIT 8")
  ]);return json({counts:results[0].results[0],categories:results[1].results,overTime:results[2].results,activity:results[3].results});
 }
 if(path==="/api/admin/submissions"&&method==="GET"){
  const q=new URL(request.url).searchParams;const filters=z.object({search:z.string().max(160).default(""),status:z.enum(STATUSES).optional(),category:z.enum(CATEGORIES).optional(),priority:z.enum(PRIORITIES).optional(),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),unresolved:z.enum(["true","false"]).optional(),archive:z.enum(["true","false"]).optional(),sort:z.enum(["newest","oldest","priority","updated"]).default("newest"),page:z.coerce.number().int().min(1).max(10000).default(1)}).strict().parse(Object.fromEntries(q));
  const clauses=[filters.archive==="true"?"archived_at IS NOT NULL":"archived_at IS NULL"];const args:(string|number)[]=[];
  if(filters.search){clauses.push("(subject LIKE ? ESCAPE '\\' OR reference_code LIKE ? ESCAPE '\\' OR message LIKE ? ESCAPE '\\')");const term="%"+filters.search.replace(/[\\%_]/g,"\\$&")+"%";args.push(term,term,term);}
  for(const k of ["status","category","priority"] as const)if(filters[k]){clauses.push(k+" = ?");args.push(filters[k]!);}
  if(filters.from){clauses.push("date(created_at,'+3 hours') >= ?");args.push(filters.from);}if(filters.to){clauses.push("date(created_at,'+3 hours') <= ?");args.push(filters.to);}if(filters.unresolved==="true")clauses.push("status NOT IN "+closedSql);
  const sorts={newest:"created_at DESC",oldest:"created_at ASC",priority:"CASE priority WHEN 'Urgent' THEN 0 WHEN 'Important' THEN 1 ELSE 2 END,created_at DESC",updated:"updated_at DESC"};const where=clauses.join(" AND ");const result=await db.batch<Record<string,unknown>>([db.prepare("SELECT * FROM submissions WHERE "+where+" ORDER BY "+sorts[filters.sort]+",id LIMIT 25 OFFSET ?").bind(...args,(filters.page-1)*25),db.prepare("SELECT COUNT(*) AS count FROM submissions WHERE "+where).bind(...args)]);return json({items:result[0].results.map(rowToSubmission),total:result[1].results[0].count,page:filters.page});
 }
 if(path==="/api/admin/bulk"&&method==="POST"){
  const v=z.object({items:z.array(z.object({referenceCode:refSchema,version:z.number().int().nonnegative()}).strict()).min(1).max(20),action:z.enum(["status","archive","restore"]),status:z.enum(STATUSES).optional(),reason:z.string().trim().max(1000).default("")}).strict().parse(await body(request));if(new Set(v.items.map(x=>x.referenceCode)).size!==v.items.length)throw new AppError(400,"Duplicate selections.");if(v.action==="status"&&!v.status)throw new AppError(400,"Choose a status.");if(v.status&&TERMINAL.includes(v.status)&&v.reason.length<3)throw new AppError(400,"Add a reason before closing submissions.");
  const stamp=new Date().toISOString();const ops:D1PreparedStatement[]=[];for(const item of v.items){const mutation=crypto.randomUUID();const condition="reference_code=? AND version=? AND archived_at IS "+(v.action==="restore"?"NOT NULL":"NULL");if(v.action==="status")ops.push(db.prepare("UPDATE submissions SET status=?,resolved_at=CASE WHEN ?='Resolved' THEN COALESCE(resolved_at,?) ELSE NULL END,updated_at=?,version=version+1,last_mutation=? WHERE "+condition).bind(v.status,v.status,stamp,stamp,mutation,item.referenceCode,item.version));else ops.push(db.prepare("UPDATE submissions SET archived_at=?,updated_at=?,version=version+1,last_mutation=? WHERE "+condition).bind(v.action==="archive"?stamp:null,stamp,mutation,item.referenceCode,item.version));
   const event=v.action==="status"?"Status changed to "+v.status+(v.reason?". Reason: "+v.reason:""):v.action==="archive"?"Archived":"Restored from archive";ops.push(db.prepare("INSERT INTO history(id,submission_id,event,actor,created_at) SELECT ?,id,?,?,? FROM submissions WHERE reference_code=? AND last_mutation=?").bind(crypto.randomUUID(),event,actor,stamp,item.referenceCode,mutation));
  }const results=await db.batch(ops);const updated=results.filter((_,i)=>i%2===0).reduce((n,r)=>n+(r.meta.changes||0),0);return json({updated,skipped:v.items.length-updated});
 }
 const match=path.match(/^\/api\/admin\/submissions\/(AF-[A-Z2-9]{12})(?:\/(notes|review))?$/);if(match){const ref=match[1];const r=await find(ref);
  if(!match[2]&&method==="GET"){const results=await db.batch<Record<string,unknown>>([db.prepare("SELECT id,body,actor,created_at AS createdAt FROM internal_notes WHERE submission_id=? ORDER BY created_at DESC").bind(r.id),db.prepare("SELECT id,event,actor,created_at AS createdAt FROM history WHERE submission_id=? ORDER BY created_at ASC,rowid").bind(r.id)]);return json({submission:rowToSubmission(r),notes:results[0].results,history:results[1].results});}
  if(!match[2]&&method==="PATCH")return json(await update(ref,await body(request),actor));
  if(match[2]==="review"&&method==="POST"){await body(request);if(r.status!=="New"||r.archived_at)return json({updated:false});return json(await update(ref,{status:"Under Review",flags:JSON.parse(String(r.flags)),publicUpdate:r.public_update,reason:"",version:r.version},actor));}
  if(match[2]==="notes"&&method==="POST"){if(r.archived_at)throw new AppError(409,"Restore this submission before adding notes.");const v=z.object({body:z.string().trim().min(3).max(2000)}).strict().parse(await body(request));const stamp=new Date().toISOString();await db.batch<Record<string,unknown>>([db.prepare("INSERT INTO internal_notes(id,submission_id,body,actor,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),r.id,v.body,actor,stamp),db.prepare("INSERT INTO history(id,submission_id,event,actor,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),r.id,"Internal note added",actor,stamp),db.prepare("UPDATE submissions SET updated_at=?,version=version+1 WHERE id=?").bind(stamp,r.id)]);return json({saved:true},201);}
 }
 throw new AppError(404,"Not found.");
 }catch(e){if(e instanceof ZodError)return json({error:e.issues[0]?.message||"Check the form and try again."},400);if(e instanceof AppError)return json({error:e.message,code:e.code},e.status);console.error("Feedback operation failed",e instanceof Error?e.name:"Unknown");return json({error:"The service is temporarily unavailable. Your text has not been cleared. Please try again."},503);}}
