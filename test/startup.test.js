import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Uses a private schema, never drops or changes existing application tables.
test('real server initializes an empty PostgreSQL schema and preserves sessions across restart',{
 skip:!process.env.STARTUP_TEST_DATABASE_URL,timeout:45000
},async t=>{
 const schema='nordx_startup_'+randomUUID().replaceAll('-','');
 const admin=new pg.Pool({connectionString:process.env.STARTUP_TEST_DATABASE_URL});
 await admin.query(`CREATE SCHEMA ${schema}`);
 const url=new URL(process.env.STARTUP_TEST_DATABASE_URL);
 url.searchParams.set('options',`-c search_path=${schema}`);
 const db=new pg.Pool({connectionString:url.toString()});
 const children=new Set();
 async function stop(child){if(child.exitCode!==null||child.signalCode!==null)return;const exited=once(child,'exit');child.kill('SIGTERM');await exited;children.delete(child);}
 t.after(async()=>{for(const child of children)await stop(child);await db.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
 async function start(){
  const child=spawn(process.execPath,['src/server.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,DATABASE_URL:url.toString(),SESSION_SECRET:'test-only-secret-'.repeat(4),NODE_ENV:'development',PORT:'0'},stdio:['ignore','pipe','pipe']});children.add(child);
  let logs='';const base=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Startup timed out: '+logs)),15000);
   child.once('error',e=>{clearTimeout(timer);reject(e);});
   child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited before readiness: '+logs));});
   child.stderr.on('data',b=>{logs+=b.toString();});child.stdout.on('data',b=>{logs+=b.toString();const match=logs.match(/listening on port (\d+)/);if(match){clearTimeout(timer);assert.match(logs,/Database schema ready\./);resolve('http://127.0.0.1:'+match[1]);}});
  });return {child,base};
 }
 let {child,base}=await start();
 assert.equal((await request(base).get('/health')).status,200);
 await db.query('INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,$4)',['startup@example.test','Startup Admin',await bcrypt.hash('startup-test-password',4),'admin']);
 const agent=request.agent(base);const login=await agent.get('/login');assert.equal(login.status,200);
 assert.ok(Number((await db.query('SELECT count(*) FROM sessions')).rows[0].count)>0,'Login page persisted a real PostgreSQL session');
 const csrf=login.text.match(/name="csrf-token" content="([^"]+)"/)[1];
 const signedIn=await agent.post('/login').type('form').send({_csrf:csrf,email:'startup@example.test',password:'startup-test-password'});assert.equal(signedIn.status,302);
 const cookie=signedIn.headers['set-cookie'].map(c=>c.split(';')[0]).join('; ');
 await db.query('INSERT INTO clients(name) VALUES($1)',['Preserved client']);
 await stop(child);
 ({child,base}=await start());
 const dashboard=await request(base).get('/').set('Cookie',cookie);assert.equal(dashboard.status,200);assert.match(dashboard.text,/Preserved client/);
 await db.query('DROP TABLE sessions');assert.equal((await request(base).get('/health')).status,503);
 await stop(child);({child,base}=await start());assert.equal((await request(base).get('/login')).status,200);assert.equal((await request(base).get('/health')).status,200);assert.equal((await db.query('SELECT name FROM clients')).rows[0].name,'Preserved client');
 const promoted=spawnSync(process.execPath,['scripts/create-super-admin.js','startup@example.test','Super Owner'],{cwd:new URL('../',import.meta.url),env:{...process.env,DATABASE_URL:url.toString()},input:'secure-super-admin-password\n',encoding:'utf8'});
 assert.equal(promoted.status,0,promoted.stderr);
 const owner=(await db.query('SELECT role,is_active,password_hash FROM users WHERE email=$1',['startup@example.test'])).rows[0];assert.equal(owner.role,'superadmin');assert.equal(owner.is_active,true);assert.equal(await bcrypt.compare('secure-super-admin-password',owner.password_hash),true);
 await stop(child);
});
