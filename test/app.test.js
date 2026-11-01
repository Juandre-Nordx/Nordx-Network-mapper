import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {PGlite} from '@electric-sql/pglite';
import request from 'supertest';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../src/app.js';
test('authenticated planning workflow, persistence, exports, uploads and authorization',async t=>{
 const real=process.env.TEST_DATABASE_URL ? new pg.Pool({connectionString:process.env.TEST_DATABASE_URL}) : null;
 const db=real ? {query:(...a)=>real.query(...a),exec:(sql)=>real.query(sql),close:()=>real.end()} : new PGlite();const dir=await mkdtemp(path.join(os.tmpdir(),'nordx-test-'));
 t.after(async()=>{await db.close();await rm(dir,{recursive:true,force:true});});
 await db.exec(await readFile(new URL('../src/schema.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../src/schema.sql',import.meta.url),'utf8'));
 const hash=await bcrypt.hash('secure-test-password',4);
 await db.query('INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,$4)',['admin@example.test','Admin',hash,'admin']);
 const app=createApp({db,sessionStore:new session.MemoryStore(),sessionSecret:'a'.repeat(64),uploadDir:dir,production:false});const a=request.agent(app);
 const csrf=async(agent,url='/')=>{const r=await agent.get(url);assert.equal(r.status,200);return r.text.match(/name="csrf-token" content="([^"]+)"/)[1];};
 assert.equal((await a.get('/health')).body.status,'ok');assert.equal((await a.get('/')).status,302);
 let token=await csrf(a,'/login');assert.equal((await a.post('/login').send({email:'admin@example.test',password:'secure-test-password'})).status,403);
 assert.equal((await a.post('/login').type('form').send({_csrf:token,email:'admin@example.test',password:'bad'})).status,401);
 assert.equal((await a.post('/login').type('form').send({_csrf:token,email:'admin@example.test',password:'secure-test-password'})).status,302);token=await csrf(a);
 const post=(url,body)=>a.post(url).type('form').send({_csrf:token,...body});
 let r=await post('/clients',{name:'Nordx Test Client',contact:'test'});assert.equal(r.status,302);const client=r.headers.location;
 assert.equal((await a.get(client)).status,200);
 r=await post(client+'/sites',{name:'Main Site',address:'Test address'});assert.equal(r.status,302);const site=r.headers.location;
 r=await post(site+'/plans',{name:'Office',kind:'network',template:'office'});assert.equal(r.status,302);const plan=r.headers.location;
 assert.equal((await a.get(site)).status,200);assert.equal((await a.get(plan)).status,200);
 const diagram={groups:[{id:'cabinet-a',name:'Main Cabinet'}],nodes:[{id:'one',label:'Core router',type:'router',x:100,y:100,width:180,height:90,groupId:'cabinet-a'},{id:'two',label:'Desk phone',type:'voip',x:300,y:200,groupId:'cabinet-a'}],edges:[{from:'one',to:'two',masterPort:'Gi0/1',slavePort:'ether2'}]};
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send(diagram)).status,200);
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send({...diagram,edges:[{from:'missing',to:'two'}]})).status,400);
 assert.match((await a.get(plan)).text,/Core router/);
 assert.match((await a.get(plan)).text,/Main Cabinet/);
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send({...diagram,groups:[]})).status,400,'Dangling group memberships must be rejected');
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send({...diagram,groups:[...diagram.groups,...diagram.groups]})).status,400,'Duplicate group IDs must be rejected');
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send({...diagram,groups:[{id:'cabinet-a',name:' '}]})).status,400);
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send({...diagram,nodes:diagram.nodes.map((n,i)=>i===0?{...n,width:361}:n)})).status,400);
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send({...diagram,nodes:diagram.nodes.map((n,i)=>i===0?{...n,height:47}:n)})).status,400);
 assert.match((await a.get(plan)).text,/Gi0\/1/);
 assert.match((await a.get(plan)).text,/ether2/);
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send({...diagram,edges:[{from:'one',to:'two',masterPort:'Gi0/1'}]})).status,400);
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send({...diagram,edges:[{from:'one',to:'two'}]})).status,200,'Legacy unlabelled connections remain supported');
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send(diagram)).status,200);
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send({...diagram,edges:[{from:'one',to:'two',masterPort:'x'.repeat(65),slavePort:'ether2'}]})).status,400);
 assert.deepEqual((await db.query('SELECT diagram FROM plans WHERE id=1')).rows[0].diagram,diagram);
 const pdf=await a.get(plan+'/pdf');assert.equal(pdf.status,200);assert.equal(pdf.headers['content-type'],'application/pdf');assert.ok(pdf.body.subarray(0,4).equals(Buffer.from('%PDF')));
 assert.equal((await post(site+'/equipment',{name:'Camera',kind:'camera',ip:'10.0.0.2',notes:'Entrance'})).status,302);assert.match((await a.get(site)).text,/10.0.0.2/);
 assert.equal((await a.post(site+'/uploads').set('x-csrf-token',token).attach('file',Buffer.from('<script>bad</script>'),'bad.png')).status,400);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jbmQAAAAASUVORK5CYII=','base64');
 assert.equal((await a.post(site+'/uploads').set('x-csrf-token',token).attach('file',png,'floor.png')).status,302);
 assert.equal((await a.get('/uploads/1')).status,200);
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send({...diagram,backgroundUploadId:1})).status,200);
 assert.equal((await a.post(plan+'/diagram').set('x-csrf-token',token).send({...diagram,backgroundUploadId:99999})).status,400);
 assert.equal((await db.query('SELECT diagram FROM plans WHERE id=1')).rows[0].diagram.backgroundUploadId,1);
 assert.equal((await post('/users',{name:'Tech',email:'tech@example.test',password:'secure-test-password',role:'technician'})).status,302);assert.equal((await a.get('/users')).status,200);
 const tech=request.agent(app);let tt=await csrf(tech,'/login');await tech.post('/login').type('form').send({_csrf:tt,email:'tech@example.test',password:'secure-test-password'});tt=await csrf(tech);
 for(const url of [client,site,plan,plan+'/pdf','/uploads/1'])assert.equal((await tech.get(url)).status,404,url);
 assert.equal((await tech.get('/users')).status,403);
 assert.equal((await tech.post('/clients').type('form').send({_csrf:tt,name:'Forbidden'})).status,403);
 assert.equal((await post(client+'/access',{userId:2,assigned:'yes'})).status,302);
 for(const url of [client,site,plan,plan+'/pdf','/uploads/1'])assert.equal((await tech.get(url)).status,200,url);
 assert.equal((await post(client+'/access',{userId:2,assigned:'no'})).status,302);assert.equal((await tech.get(plan)).status,404);
 // A new app instance reads the existing database and uploaded files.
 const restarted=request.agent(createApp({db,sessionStore:new session.MemoryStore(),sessionSecret:'a'.repeat(64),uploadDir:dir,production:false}));let rt=await csrf(restarted,'/login');await restarted.post('/login').type('form').send({_csrf:rt,email:'admin@example.test',password:'secure-test-password'});assert.match((await restarted.get(plan)).text,/Core router/);assert.equal((await restarted.get('/uploads/1')).status,200);
 assert.equal((await a.post('/logout').type('form').send({_csrf:token})).status,302);assert.equal((await a.get(plan)).status,302);
});

test('production cookies, required secrets, and database health failures',async()=>{
 const db={query:async()=>({rows:[]})};
 assert.throws(()=>createApp({db,sessionSecret:'short'}),/SESSION_SECRET/);
 const app=createApp({db,sessionStore:new session.MemoryStore(),production:true,sessionSecret:'x'.repeat(64)});
 const r=await request(app).get('/login').set('X-Forwarded-Proto','https');
 assert.equal(r.status,200);assert.match(r.headers['content-security-policy'],/upgrade-insecure-requests/);assert.match(r.headers['set-cookie'][0],/HttpOnly/);assert.match(r.headers['set-cookie'][0],/Secure/);assert.match(r.headers['set-cookie'][0],/SameSite=Lax/);
 const unhealthy=createApp({db:{query:async()=>{throw Error('offline');}},sessionStore:new session.MemoryStore(),production:false,sessionSecret:'x'.repeat(64)});
 const health=await request(unhealthy).get('/health');assert.equal(health.status,503);assert.doesNotMatch(health.headers['content-security-policy'],/upgrade-insecure-requests/);
});

test('health rejects a connected PostgreSQL database without the sessions table',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(await readFile(new URL('../src/schema.sql',import.meta.url),'utf8'));
 const app=createApp({db,sessionStore:new session.MemoryStore(),sessionSecret:'x'.repeat(64),production:false});
 assert.equal((await request(app).get('/health')).status,200);
 await db.query('DROP TABLE sessions');
 assert.equal((await request(app).get('/health')).status,503);
});

test('super-admin manages other accounts without privilege escalation or stale sessions',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec(await readFile(new URL('../src/schema.sql',import.meta.url),'utf8'));
 const hash=await bcrypt.hash('account-test-password',4);
 for(const [email,role] of [['super@example.test','superadmin'],['admin@example.test','admin'],['tech@example.test','technician']])await db.query('INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,$4)',[email,email,hash,role]);
 const app=createApp({db,sessionStore:new session.MemoryStore(),sessionSecret:'q'.repeat(64),production:false});
 async function login(email,password='account-test-password'){
  const agent=request.agent(app);const page=await agent.get('/login');const csrf=page.text.match(/name="csrf-token" content="([^"]+)"/)[1];const result=await agent.post('/login').type('form').send({_csrf:csrf,email,password});return {agent,result};
 }
 async function token(agent){return (await agent.get('/')).text.match(/name="csrf-token" content="([^"]+)"/)[1];}
 const root=await login('super@example.test'),admin=await login('admin@example.test'),tech=await login('tech@example.test');
 assert.equal(root.result.status,302);const csrf=await token(root.agent),adminCsrf=await token(admin.agent),techCsrf=await token(tech.agent);
 assert.match((await root.agent.get('/users')).text,/Save account changes/);
 const payload={name:'Managed Admin',email:'admin@example.test',role:'admin',active:'yes',password:'',_csrf:csrf};
 assert.equal((await admin.agent.post('/users/3/manage').type('form').send({...payload,_csrf:adminCsrf})).status,403);
 assert.equal((await tech.agent.post('/users/2/manage').type('form').send({...payload,_csrf:techCsrf})).status,403);
 assert.equal((await admin.agent.post('/users').type('form').send({_csrf:adminCsrf,name:'Escalation',email:'bad@example.test',role:'superadmin',password:'account-test-password'})).status,403);
 assert.equal((await root.agent.post('/users/1/manage').type('form').send(payload)).status,400);
 assert.equal((await root.agent.post('/users/2/manage').type('form').send({...payload,active:'no'})).status,302);
 assert.equal((await admin.agent.get('/users')).status,302);
 assert.equal((await login('admin@example.test')).result.status,401);
 assert.equal((await root.agent.post('/users/2/manage').type('form').send({...payload,active:'yes',role:'technician',password:'replacement-password'})).status,302);
 assert.equal((await login('admin@example.test')).result.status,401);
 const changed=await login('admin@example.test','replacement-password');assert.equal(changed.result.status,302);assert.equal((await changed.agent.get('/users')).status,403);
 assert.equal((await admin.agent.get('/')).status,302,'Re-enabling an account must not restore revoked sessions');
 assert.equal((await root.agent.post('/users').type('form').send({_csrf:csrf,name:'Second Super',email:'second@example.test',role:'superadmin',password:'account-test-password'})).status,302);
 assert.equal((await root.agent.post('/users/4/manage').type('form').send({...payload,email:'second@example.test',role:'admin'})).status,302,'Super-admin can manage other super-admin accounts');
 assert.equal((await root.agent.post('/clients').type('form').send({_csrf:csrf,name:'Super client'})).status,302);
 assert.equal((await root.agent.get('/clients/1')).status,200);
});

test('super-admin schema upgrade preserves existing administrator accounts',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec("CREATE TABLE users(id SERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','technician'))); INSERT INTO users(email,name,password_hash,role) VALUES('existing@example.test','Existing user','existing-hash','admin');");
 await db.exec(await readFile(new URL('../src/schema.sql',import.meta.url),'utf8'));
 const row=(await db.query('SELECT * FROM users WHERE id=1')).rows[0];assert.equal(row.name,'Existing user');assert.equal(row.password_hash,'existing-hash');assert.equal(row.is_active,true);assert.equal(row.auth_version,0);
 await db.query("UPDATE users SET role='superadmin' WHERE id=1");assert.equal((await db.query('SELECT role FROM users WHERE id=1')).rows[0].role,'superadmin');
});
