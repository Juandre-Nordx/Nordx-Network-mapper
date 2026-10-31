import {createDb,migrate} from '../src/db.js';
const db=createDb();
try {await migrate(db); console.log('Database migrations complete.');} finally {await db.end();}
