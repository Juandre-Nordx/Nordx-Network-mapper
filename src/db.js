import 'dotenv/config';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
export function createDb() {
 if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required (PostgreSQL).');
 return new pg.Pool({connectionString:process.env.DATABASE_URL, max:10});
}
export async function migrate(db) {
 const client = db.connect ? await db.connect() : db;
 try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(198532)');
  await client.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
  await client.query('COMMIT');
 } catch(e) {await client.query('ROLLBACK'); throw e;} finally {if(client.release) client.release();}
}
