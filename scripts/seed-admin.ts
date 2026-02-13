import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "caesarniseko@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "the1898Niseko";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Caesar";

async function seed() {
  console.log(`Seeding admin user: ${ADMIN_EMAIL}`);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existing) {
    console.log("Admin user already exists, skipping.");
    process.exit(0);
  }

  const passwordHash = await hash(ADMIN_PASSWORD, 12);

  const [admin] = await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      role: "admin",
    })
    .returning();

  console.log(`Admin user created: ${admin.id}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
