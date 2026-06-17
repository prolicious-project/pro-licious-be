const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const sql = `
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fssai_license VARCHAR(40);
`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to database');
    await client.query(sql);
    console.log('Vendor migration applied');
    const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='vendors' AND table_schema='public' ORDER BY ordinal_position");
    console.log('Vendors columns:', res.rows.map((row) => row.column_name));
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();


