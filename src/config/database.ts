import { Pool } from "pg";
import { env } from "./env";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const query = (
  text: string,
  params?: any[]
) => pool.query(text, params);

export default pool;