import {createDb,migrate} from '../src/db.js';
import bcrypt from 'bcryptjs';
import {readFileSync} from 'node:fs';
import {z} from 'zod';
const [email,name]=process.argv.slice(2);
const input=z.object({email:z.email().max(200),name:z.string().trim().min(1).max(200),password:z.string().min(12).max(128)}).parse({email,name,password:readFileSync(0,'utf8').replace(/\r?\n$/,'')});
const db=createDb();
try{
 await migrate(db);
 await db.query("INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,'superadmin') ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,role='superadmin',is_active=TRUE,auth_version=users.auth_version+1",[input.email.toLowerCase(),input.name,await bcrypt.hash(input.password,12)]);
 console.log('Super-admin account created or updated. Previous sessions for an updated account have been revoked.');
}finally{await db.end();}
