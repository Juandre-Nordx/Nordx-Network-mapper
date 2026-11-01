import {mkdir,chown,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export async function prepareUploadStorage(directory,{dropPrivileges=true}={}){
 try{
  await mkdir(directory,{recursive:true});
  // Mounted volumes replace image directory ownership. Initialize only the upload
  // directory, then run the app as the image's node user; never chmod world-writable.
  if(dropPrivileges&&process.getuid?.()===0){
   await chown(directory,1000,1000);
   process.setgroups([]);process.setgid(1000);process.setuid(1000);
  }
  const probe=path.join(directory,'.nordx-write-check-'+randomUUID());
  await writeFile(probe,'',{flag:'wx',mode:0o600});await unlink(probe);
 }catch(error){throw new Error(`Upload storage is not writable at ${directory}. Match UPLOAD_DIR to the persistent volume mount and ensure UID 1000 can write there. (${error.code||'storage error'})`,{cause:error});}
}
