import { writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Readers see an old complete record or a new complete record, never half JSON.
// Per-task locking still owns dedup; atomic replacement is not a compare-and-swap.
export async function writePrivateJSON(file, value) {
  const temp=file+'.tmp-'+randomUUID();
  try {await writeFile(temp,JSON.stringify(value),{flag:'wx',mode:0o600});await rename(temp,file);}
  finally {try{await unlink(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
