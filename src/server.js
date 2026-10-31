import 'dotenv/config';
import {createDb} from './db.js';
import {createApp} from './app.js';
if(process.env.NODE_ENV==='production' && !process.env.APP_URL?.startsWith('https://'))throw new Error('Production APP_URL must use HTTPS.');
const db=createDb();
await db.query('SELECT 1');
const server=createApp({db}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Nordx Network Mapper listening'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(async()=>{await db.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();});
