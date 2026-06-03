import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "../config/database";
import * as schema from "./schema";

/** Drizzle ORM client — use `db` in all services */
export const db = drizzle(pool, { schema });
