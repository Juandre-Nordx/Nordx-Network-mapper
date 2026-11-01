import 'dotenv/config';
import {createDb,migrate,verifySchema} from './db.js';
import {createApp} from './app.js';
if(process.env.NODE_ENV==='production' && !process.env.APP_URL?.startsWith('https://'))throw new Error('Production APP_URL must use HTTPS.');
const db=createDb();
try {
 await migrate(db);
 await verifySchema(db);
 console.log('Database schema ready.');
} catch(error) {
 await db.end();
 console.error(JSON.stringify({level:'error',event:'database_initialization_failed',code:error.code,message:error.message}));
 throw error;
}
const server=createApp({db}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`Nordx Network Mapper listening on port ${server.address().port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(async()=>{await db.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();});
