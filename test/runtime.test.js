import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,chmod,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import session from 'express-session';
import {isProduction,proxyHops,uploadDirectory} from '../src/config.js';
import {prepareUploadStorage} from '../src/storage.js';
import {createApp} from '../src/app.js';

test('Railway enables production proxy and resolves persistent storage independently of NODE_ENV',()=>{
 const env={NODE_ENV:'development',RAILWAY_SERVICE_ID:'test-service',RAILWAY_VOLUME_MOUNT_PATH:'/var/uploads'};
 assert.equal(isProduction(env),true);assert.equal(proxyHops(env),1);assert.equal(uploadDirectory(env),'/var/uploads');
 assert.equal(isProduction({NODE_ENV:'development'}),false);assert.equal(proxyHops({NODE_ENV:'development'}),0);
 assert.equal(uploadDirectory({NODE_ENV:'production'}),'/var/uploads');
 assert.equal(uploadDirectory({...env,UPLOAD_DIR:'/var/uploads/images'}),'/var/uploads/images');
 assert.throws(()=>uploadDirectory({...env,UPLOAD_DIR:'./var/uploads'}),/absolute persistent path/);
 assert.throws(()=>uploadDirectory({...env,UPLOAD_DIR:'/app/var/uploads'}),/inside the Railway volume mount/);
 assert.throws(()=>proxyHops({...env,TRUST_PROXY_HOPS:'true'}),/integer/);
});

test('storage preflight creates a usable upload directory and leaves no probe files',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'nordx-storage-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const uploads=path.join(directory,'uploads');await prepareUploadStorage(uploads,{dropPrivileges:false});assert.deepEqual(await readdir(uploads),[]);
 if(process.getuid?.()!==0){await chmod(uploads,0o500);try{await assert.rejects(()=>prepareUploadStorage(uploads,{dropPrivileges:false}),/not writable.*UID 1000/);}finally{await chmod(uploads,0o700);}}
});

test('forwarded client IPs have separate login rate limits and secure cookies behind one proxy',async()=>{
 const app=createApp({db:{query:async()=>({rows:[]})},sessionStore:new session.MemoryStore(),sessionSecret:'x'.repeat(64),production:true,trustProxy:1});
 assert.equal(app.get('trust proxy'),1);
 const login=await request(app).get('/login').set('X-Forwarded-Proto','https');assert.match(login.headers['set-cookie'][0],/Secure/);
 const cookie=login.headers['set-cookie'][0].split(';')[0],csrf=login.text.match(/name="csrf-token" content="([^"]+)"/)[1];
 const attempt=ip=>request(app).post('/login').set('X-Forwarded-Proto','https').set('X-Forwarded-For',ip).set('Cookie',cookie).type('form').send({_csrf:csrf,email:'missing@example.test',password:'not-a-real-password'});
 for(let i=1;i<=11;i++)assert.equal((await attempt('203.0.113.'+i)).status,401,'Different clients must not share one login bucket');
 for(let i=0;i<9;i++)assert.equal((await attempt('203.0.113.1')).status,401);
 assert.equal((await attempt('203.0.113.1')).status,429);
});
