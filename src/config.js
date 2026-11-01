import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export function isProduction(env=process.env){
 return env.NODE_ENV==='production'||Boolean(env.RAILWAY_ENVIRONMENT_ID||env.RAILWAY_PROJECT_ID||env.RAILWAY_SERVICE_ID);
}
export function proxyHops(env=process.env,production=isProduction(env)){
 if(env.TRUST_PROXY_HOPS===undefined||env.TRUST_PROXY_HOPS==='')return production?1:0;
 if(!/^[0-4]$/.test(env.TRUST_PROXY_HOPS))throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 4. Railway normally uses 1.');
 return Number(env.TRUST_PROXY_HOPS);
}
export function uploadDirectory(env=process.env,production=isProduction(env)){
 const mount=env.RAILWAY_VOLUME_MOUNT_PATH;
 const directory=env.UPLOAD_DIR||mount||(production?'/var/uploads':path.join(root,'var/uploads'));
 if(production&&!path.isAbsolute(directory))throw new Error('UPLOAD_DIR must be an absolute persistent path in production. Set UPLOAD_DIR=/var/uploads to match your Railway volume mount.');
 const resolved=path.resolve(directory);
 if(production&&mount){
  const relative=path.relative(path.resolve(mount),resolved);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('UPLOAD_DIR must be inside the Railway volume mount (RAILWAY_VOLUME_MOUNT_PATH). Existing files will not be moved automatically.');
 }
 return resolved;
}
