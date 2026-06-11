import { pool } from "../config/database";

async function main() {
  console.log("Running manual database migration...");
  try {
    // Truncate carts to resolve the constraint conflict
    await pool.query("TRUNCATE TABLE cart_items, carts CASCADE;");
    console.log("✅ Truncated carts and cart_items successfully");

    // Create order_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_messages (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        sender_id BIGINT NOT NULL REFERENCES users(id),
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ Created order_messages table successfully in PostgreSQL");
  } catch (err) {
    console.error("❌ Migration error:", err);
  } finally {
    await pool.end();
  }
}

main();
