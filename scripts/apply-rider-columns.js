const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:9803@localhost:5432/prolicious',
  });

  try {
    await client.connect();

    await client.query(`
      ALTER TABLE riders
        ADD COLUMN IF NOT EXISTS rc_number VARCHAR(30),
        ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20),
        ADD COLUMN IF NOT EXISTS address TEXT;
    `);

    await client.query(`
      ALTER TABLE vendors
        ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS business_address TEXT,
        ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20),
        ADD COLUMN IF NOT EXISTS fssai_license VARCHAR(40);
    `);

    const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name IN ('riders','vendors') ORDER BY table_name, ordinal_position");
    console.log('Applied columns:', JSON.stringify(result.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
