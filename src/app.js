import {verifySchema} from './db.js';
import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile,unlink,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
const root=fileURLToPath(new URL('../',import.meta.url));
const text=z.string().trim().min(1).max(200);
const optional=z.string().trim().max(2000).default('');
const diagramSchema=z.object({backgroundUploadId:z.number().int().positive().nullable().optional(),nodes:z.array(z.object({id:z.string().max(80),label:text,type:text,x:z.number().min(0).max(1200),y:z.number().min(0).max(800)})).max(300),edges:z.array(z.object({from:z.string().max(80),to:z.string().max(80)})).max(600)}).superRefine((d,ctx)=>{const ids=new Set(d.nodes.map(n=>n.id));if(ids.size!==d.nodes.length || d.edges.some(e=>!ids.has(e.from)||!ids.has(e.to)))ctx.addIssue({code:'custom',message:'Invalid diagram references'});});
export const templates={blank:{nodes:[],edges:[]},office:{nodes:[{id:'router',label:'Gateway',type:'router',x:150,y:100},{id:'switch',label:'Core switch',type:'switch',x:450,y:100},{id:'ap',label:'Wireless AP',type:'wifi',x:750,y:250}],edges:[{from:'router',to:'switch'},{from:'switch',to:'ap'}]},cctv:{nodes:[{id:'nvr',label:'NVR',type:'nvr',x:450,y:100},{id:'cam1',label:'Entrance camera',type:'camera',x:200,y:350},{id:'cam2',label:'Parking camera',type:'camera',x:750,y:350}],edges:[{from:'nvr',to:'cam1'},{from:'nvr',to:'cam2'}]}};
export function createApp({db,sessionStore,uploadDir=process.env.UPLOAD_DIR||path.join(root,'var/uploads'),production=process.env.NODE_ENV==='production',sessionSecret=process.env.SESSION_SECRET}) {
 if(!sessionSecret || sessionSecret.length<32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
 const app=express();
 app.disable('x-powered-by');
 if(production) app.set('trust proxy',1);
 app.set('views',path.join(root,'views'));app.set('view engine','ejs');
 app.use(helmet({contentSecurityPolicy:{directives:{'upgrade-insecure-requests':production?[]:null,'img-src':["'self'","data:"],'script-src':["'self'"],'style-src':["'self'","'unsafe-inline'"]}}}));
 app.use(express.static(path.join(root,'public')));
 app.get('/health',async(req,res)=>{try{await verifySchema(db);res.json({status:'ok'});}catch{res.status(503).json({status:'unavailable'});}});
 const Store=pgSession(session);
 app.use(session({store:sessionStore||new Store({pool:db,tableName:'sessions'}),secret:sessionSecret,resave:false,saveUninitialized:false,name:'nordx.sid',cookie:{httpOnly:true,secure:production,sameSite:'lax',maxAge:8*60*60*1000}}));
 app.use(express.urlencoded({extended:false,limit:'100kb'}));app.use(express.json({limit:'250kb'}));
 app.use(async(req,res,next)=>{try{res.locals.user=null;if(req.session.userId){const r=await db.query('SELECT id,name,email,role,auth_version FROM users WHERE id=$1 AND is_active=TRUE',[req.session.userId]);res.locals.user=r.rows[0]&&r.rows[0].auth_version===(req.session.authVersion??0)?r.rows[0]:null;}req.user=res.locals.user;req.session.csrf ||= randomBytes(32).toString('hex');res.locals.csrf=req.session.csrf;res.locals.title='Nordx Network Mapper';next();}catch(e){next(e);}});
 app.use((req,res,next)=>{if(['GET','HEAD','OPTIONS'].includes(req.method))return next();const token=req.get('x-csrf-token')||req.body?._csrf;const expected=req.session.csrf;if(typeof token!=='string'||Buffer.byteLength(token)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))return res.status(403).send('Invalid request token. Reload the page.');next();});
 const loginLimit=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-8',legacyHeaders:false});
 app.get('/login',(req,res)=>res.render('login',{error:null}));
 app.post('/login',loginLimit,async(req,res)=>{const r=await db.query('SELECT * FROM users WHERE email=$1',[String(req.body.email||'').toLowerCase().trim()]);const u=r.rows[0];if(!u||!u.is_active||!await bcrypt.compare(String(req.body.password||''),u.password_hash))return res.status(401).render('login',{error:'Email or password is incorrect.'});await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));req.session.userId=u.id;req.session.authVersion=u.auth_version;res.redirect('/');});
 app.use((req,res,next)=>req.user?next():res.redirect('/login'));
 app.post('/logout',(req,res,next)=>req.session.destroy(e=>{if(e)return next(e);res.clearCookie('nordx.sid');res.redirect('/login');}));
 function admin(req,res,next){if(!['admin','superadmin'].includes(req.user.role))return res.status(403).send('Administrator access required.');next();}
 async function canClient(req,id){if(['admin','superadmin'].includes(req.user.role))return true;const r=await db.query('SELECT 1 FROM client_access WHERE client_id=$1 AND user_id=$2',[id,req.user.id]);return r.rows.length>0;}
 async function site(req,res,next){const id=z.coerce.number().int().positive().parse(req.params.id);const r=await db.query('SELECT s.*,c.name AS client_name FROM sites s JOIN clients c ON c.id=s.client_id WHERE s.id=$1',[id]);req.site=r.rows[0];if(!req.site||!await canClient(req,req.site.client_id))return res.status(404).send('Site not found.');next();}
 async function plan(req,res,next){const id=z.coerce.number().int().positive().parse(req.params.id);const r=await db.query('SELECT p.*,s.client_id,s.name AS site_name FROM plans p JOIN sites s ON s.id=p.site_id WHERE p.id=$1',[id]);req.plan=r.rows[0];if(!req.plan||!await canClient(req,req.plan.client_id))return res.status(404).send('Plan not found.');next();}
 app.get('/',async(req,res)=>{const clients=await db.query("SELECT c.* FROM clients c WHERE $1 IN ('admin','superadmin') OR EXISTS(SELECT 1 FROM client_access a WHERE a.client_id=c.id AND a.user_id=$2) ORDER BY c.name",[req.user.role,req.user.id]);res.render('dashboard',{clients:clients.rows});});
 app.post('/clients',admin,async(req,res)=>{const v=z.object({name:text,contact:optional}).parse(req.body);const r=await db.query('INSERT INTO clients(name,contact) VALUES($1,$2) RETURNING id',[v.name,v.contact]);res.redirect('/clients/'+r.rows[0].id);});
 app.get('/clients/:id',async(req,res)=>{const id=z.coerce.number().int().positive().parse(req.params.id);if(!await canClient(req,id))return res.status(404).send('Client not found.');const r=await db.query('SELECT * FROM clients WHERE id=$1',[id]);if(!r.rows[0])return res.status(404).send('Client not found.');const sites=await db.query('SELECT * FROM sites WHERE client_id=$1 ORDER BY name',[id]);const users=['admin','superadmin'].includes(req.user.role)?(await db.query("SELECT u.id,u.name,EXISTS(SELECT 1 FROM client_access a WHERE a.user_id=u.id AND a.client_id=$1) AS assigned FROM users u WHERE u.role='technician' ORDER BY u.name",[id])).rows:[];res.render('client',{client:r.rows[0],sites:sites.rows,users});});
 app.post('/clients/:id/access',admin,async(req,res)=>{const v=z.object({userId:z.coerce.number().int().positive(),assigned:z.enum(['yes','no'])}).parse(req.body);if(v.assigned==='yes')await db.query('INSERT INTO client_access(client_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,v.userId]);else await db.query('DELETE FROM client_access WHERE client_id=$1 AND user_id=$2',[req.params.id,v.userId]);res.redirect('/clients/'+req.params.id);});
 app.post('/clients/:id/sites',async(req,res)=>{if(!await canClient(req,req.params.id))return res.status(404).send('Client not found.');const v=z.object({name:text,address:optional}).parse(req.body);const r=await db.query('INSERT INTO sites(client_id,name,address) VALUES($1,$2,$3) RETURNING id',[req.params.id,v.name,v.address]);res.redirect('/sites/'+r.rows[0].id);});
 app.get('/sites/:id',site,async(req,res)=>{const plans=await db.query('SELECT * FROM plans WHERE site_id=$1 ORDER BY name',[req.site.id]);const equipment=await db.query('SELECT * FROM equipment WHERE site_id=$1 ORDER BY name',[req.site.id]);const uploads=await db.query('SELECT * FROM uploads WHERE site_id=$1 ORDER BY created_at DESC',[req.site.id]);res.render('site',{site:req.site,plans:plans.rows,equipment:equipment.rows,uploads:uploads.rows});});
 app.post('/sites/:id/plans',site,async(req,res)=>{const v=z.object({name:text,kind:z.enum(['network','cctv']),template:z.enum(['blank','office','cctv'])}).parse(req.body);const r=await db.query('INSERT INTO plans(site_id,name,kind,diagram) VALUES($1,$2,$3,$4) RETURNING id',[req.site.id,v.name,v.kind,JSON.stringify(templates[v.template])]);res.redirect('/plans/'+r.rows[0].id);});
 app.post('/sites/:id/equipment',site,async(req,res)=>{const v=z.object({name:text,kind:text,ip:optional,notes:optional}).parse(req.body);await db.query('INSERT INTO equipment(site_id,name,kind,ip,notes) VALUES($1,$2,$3,$4,$5)',[req.site.id,v.name,v.kind,v.ip,v.notes]);res.redirect('/sites/'+req.site.id);});
 app.get('/plans/:id',plan,async(req,res)=>{const uploads=await db.query('SELECT id,original_name FROM uploads WHERE site_id=$1',[req.plan.site_id]);res.render('plan',{plan:req.plan,uploads:uploads.rows,diagramJson:JSON.stringify(req.plan.diagram).replace(/</g,'\\u003c')});});
 app.post('/plans/:id/diagram',plan,async(req,res)=>{const diagram=diagramSchema.parse(req.body);if(diagram.backgroundUploadId){const u=await db.query('SELECT 1 FROM uploads WHERE id=$1 AND site_id=$2',[diagram.backgroundUploadId,req.plan.site_id]);if(!u.rows.length)return res.status(400).send('Background must belong to this site.');}await db.query('UPDATE plans SET diagram=$1,updated_at=NOW() WHERE id=$2',[JSON.stringify(diagram),req.plan.id]);res.json({saved:true});});
 app.get('/plans/:id/pdf',plan,async(req,res)=>{res.type('pdf');res.set('Content-Disposition',`attachment; filename="nordx-plan-${req.plan.id}.pdf"`);const doc=new PDFDocument({layout:'landscape',size:'A4',margin:36});doc.pipe(res);doc.fillColor('#153E35').fontSize(22).text('Nordx Network Mapper');doc.fontSize(12).text(`${req.plan.site_name} / ${req.plan.name}`);doc.fontSize(9).text('Professional network and CCTV planning, mapping, and documentation.');const nodes=req.plan.diagram.nodes;const byId=new Map(nodes.map(n=>[n.id,n]));const pos=n=>[45+n.x*0.58,130+n.y*0.42];for(const e of req.plan.diagram.edges){const a=byId.get(e.from),b=byId.get(e.to);if(a&&b)doc.moveTo(...pos(a)).lineTo(...pos(b)).stroke('#7c998c');}for(const n of nodes){const [x,y]=pos(n);doc.roundedRect(x-36,y-14,95,38,5).fillAndStroke('#C4E9AD','#153E35');doc.fillColor('#153E35').fontSize(9).text(n.label,x-30,y-8,{width:85,height:18}).fontSize(7).text(n.type,x-30,y+8,{width:85,height:10});}doc.end();});
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1}});
 app.post('/sites/:id/uploads',site,upload.single('file'),async(req,res)=>{if(!req.file)return res.status(400).send('Choose a PNG or JPEG image.');const b=req.file.buffer;let mime,ext;if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){mime='image/png';ext='png';}else if(b[0]===255&&b[1]===216&&b[2]===255){mime='image/jpeg';ext='jpg';}else return res.status(400).send('Only PNG and JPEG images are accepted.');const name=randomUUID()+'.'+ext;await mkdir(uploadDir,{recursive:true});await writeFile(path.join(uploadDir,name),b,{flag:'wx',mode:0o600});try{await db.query('INSERT INTO uploads(site_id,user_id,original_name,stored_name,mime) VALUES($1,$2,$3,$4,$5)',[req.site.id,req.user.id,path.basename(req.file.originalname).slice(0,200),name,mime]);}catch(e){await unlink(path.join(uploadDir,name));throw e;}res.redirect('/sites/'+req.site.id);});
 app.get('/uploads/:id',async(req,res)=>{const id=z.coerce.number().int().positive().parse(req.params.id);const r=await db.query('SELECT u.*,s.client_id FROM uploads u JOIN sites s ON s.id=u.site_id WHERE u.id=$1',[id]);const u=r.rows[0];if(!u||!await canClient(req,u.client_id))return res.status(404).send('File not found.');res.set('Cache-Control','private, no-store');res.type(u.mime).send(await readFile(path.join(uploadDir,u.stored_name)));});
 app.get('/users',admin,async(req,res)=>res.render('users',{users:(await db.query('SELECT id,name,email,role,is_active FROM users ORDER BY name')).rows}));
 app.post('/users',admin,async(req,res)=>{const v=z.object({name:text,email:z.email().max(200),password:z.string().min(12).max(128),role:z.enum(['superadmin','admin','technician'])}).parse(req.body);if(v.role==='superadmin'&&req.user.role!=='superadmin')return res.status(403).send('Super-admin access required.');await db.query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4)',[v.name,v.email.toLowerCase(),await bcrypt.hash(v.password,12),v.role]);res.redirect('/users');});

 app.post('/users/:id/manage',async(req,res)=>{
  if(req.user.role!=='superadmin')return res.status(403).send('Super-admin access required.');
  const id=z.coerce.number().int().positive().parse(req.params.id);
  if(id===req.user.id)return res.status(400).send('Manage other accounts here. Your own super-admin access is protected.');
  const v=z.object({name:text,email:z.email().max(200),role:z.enum(['superadmin','admin','technician']),active:z.enum(['yes','no']),password:z.union([z.literal(''),z.string().min(12).max(128)]).default('')}).parse(req.body);
  const hash=v.password?await bcrypt.hash(v.password,12):null;
  const client=db.connect?await db.connect():db;
  try{
   await client.query('BEGIN');
   await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
   const actor=(await client.query("SELECT 1 FROM users WHERE id=$1 AND role='superadmin' AND is_active=TRUE AND auth_version=$2",[req.user.id,req.session.authVersion??0])).rows[0];
   if(!actor){await client.query('ROLLBACK');return res.status(403).send('Super-admin access required.');}
   const result=await client.query('UPDATE users SET name=$1,email=$2,role=$3,is_active=$4,password_hash=COALESCE($5,password_hash),auth_version=auth_version+1 WHERE id=$6 RETURNING id',[v.name,v.email.toLowerCase(),v.role,v.active==='yes',hash,id]);
   if(!result.rows.length){await client.query('ROLLBACK');return res.status(404).send('Account not found.');}
   await client.query('COMMIT');res.redirect('/users');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{if(client.release)client.release();}
 });
 app.use((req,res)=>res.status(404).send('Page not found.'));
 app.use((err,req,res,next)=>{if(res.headersSent)return next(err);if(err instanceof z.ZodError)return res.status(400).send('Invalid input. Check required fields and field lengths.');if(err.code==='23505')return res.status(409).send('This record already exists.');if(err instanceof multer.MulterError)return res.status(400).send('Upload failed. Maximum size is 10 MB.');console.error(JSON.stringify({level:'error',message:err.message}));res.status(500).send('The request could not be completed.');});
 return app;
}
