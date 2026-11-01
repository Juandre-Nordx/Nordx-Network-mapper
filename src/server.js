import {isProduction,proxyHops,uploadDirectory} from './config.js';
import {prepareUploadStorage} from './storage.js';
import 'dotenv/config';
import {createDb,migrate,verifySchema} from './db.js';
import {createApp} from './app.js';
const production=isProduction();
const uploadDir=uploadDirectory();
const trustProxy=proxyHops();
if(production && !process.env.APP_URL?.startsWith('https://'))throw new Error('Production APP_URL must use HTTPS.');
await prepareUploadStorage(uploadDir);
console.log(`Upload storage ready at ${uploadDir} (uid ${process.getuid?.()??'unknown'}).`);
console.log(`Proxy hops: ${trustProxy}; production mode: ${production}.`);
const db=createDb();
try {
 await migrate(db);
 await verifySchema(db);
 console.log('Database schema ready.');
} catch(error) {
 await db.end();
 throw error;
}
const server=createApp({db,uploadDir,production,trustProxy}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`Nordx Network Mapper listening on port ${server.address().port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(async()=>{await db.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();});
