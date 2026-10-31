import {createDb} from '../src/db.js';
import bcrypt from 'bcryptjs';
import {readFileSync} from 'node:fs';
const [email,name]=process.argv.slice(2);
const password=readFileSync(0,'utf8').trim();
if(!email || !name || password.length<12) throw new Error('Usage: supply a password of at least 12 characters on stdin; npm run create-admin -- email "Full name"');
const db=createDb();
try {await db.query('INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,$4)',[email.toLowerCase(),name,await bcrypt.hash(password,12),'admin']); console.log('Administrator created.');} finally {await db.end();}
