import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as authSchema from "./schema";
import * as appSchema from "./app-schema";

// Pool opens a connection only when a query runs. The auth route checks its
// configuration before accepting requests; the demo homepage needs no database.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema: { ...authSchema, ...appSchema } });
