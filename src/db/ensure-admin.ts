/**
 * Run once: npx ts-node src/db/ensure-admin.ts
 * Upserts admin@example.com with role SUPER_ADMIN and password "password123"
 */
import { db } from "./index";
import { users } from "./schema";
import { pool } from "../config/database";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

async function ensureAdmin() {
  const email = "admin@example.com";
  const password = "password123";
  const passwordHash = await bcrypt.hash(password, 10);

  const [existing] = await db.select().from(users).where(eq(users.email, email));

  if (existing) {
    // Update role and passwordHash to ensure correctness
    await db
      .update(users)
      .set({ role: "SUPER_ADMIN", passwordHash, status: "ACTIVE" })
      .where(eq(users.email, email));
    console.log(`✅ Admin user updated: ${email} / ${password}`);
  } else {
    await db.insert(users).values({
      name: "Admin Super",
      phone: "9876543213",
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    console.log(`✅ Admin user created: ${email} / ${password}`);
  }

  await pool.end();
  process.exit(0);
}

ensureAdmin().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
