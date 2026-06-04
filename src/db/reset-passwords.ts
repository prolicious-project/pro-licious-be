import { db } from "./index";
import * as schema from "./schema";
import { pool } from "../config/database";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

async function resetPasswords() {
  console.log("Resetting passwords for all seeded users...");

  const passwordHash = await bcrypt.hash("password123", 10);
  const emails = [
    "john@example.com",
    "vendor@example.com",
    "rider@example.com",
    "admin@example.com",
  ];

  for (const email of emails) {
    const result = await db
      .update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.email, email))
      .returning({ id: schema.users.id, email: schema.users.email, role: schema.users.role });

    if (result.length > 0) {
      console.log(`✅ Reset password for ${result[0].email} (${result[0].role}) [id: ${result[0].id}]`);
    } else {
      console.log(`❌ User not found: ${email} — inserting now...`);
      await db.insert(schema.users).values({
        name: email.split("@")[0],
        email,
        phone: `987654321${emails.indexOf(email)}`,
        passwordHash,
        role: email.includes("vendor") ? "VENDOR" : email.includes("rider") ? "RIDER" : email.includes("admin") ? "ADMIN" : "CUSTOMER",
        status: "ACTIVE",
      }).onConflictDoNothing();
      console.log(`✅ Inserted user: ${email}`);
    }
  }

  console.log("\n✅ All passwords reset to: password123");
  await pool.end();
  process.exit(0);
}

resetPasswords().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
