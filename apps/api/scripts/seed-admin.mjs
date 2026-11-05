import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const email = process.env.REPORTA_ADMIN_EMAIL;
const password = process.env.REPORTA_ADMIN_INITIAL_PASSWORD;

if (!email || !password) {
  console.error("seed-admin: REPORTA_ADMIN_EMAIL and REPORTA_ADMIN_INITIAL_PASSWORD must be set.");
  console.error("Example: REPORTA_ADMIN_EMAIL=admin@example.org REPORTA_ADMIN_INITIAL_PASSWORD='Str0ng-Pass!' node seed-admin.mjs");
  process.exit(1);
}
if (password.length < 12) {
  console.error("seed-admin: initial password must be at least 12 characters.");
  process.exit(1);
}

const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });

if (existing) {
  if (existing.role === "super_admin") {
    console.log(`seed-admin: super admin ${email} already exists — no changes made (idempotent).`);
  } else {
    console.error(`seed-admin: ${email} exists with role '${existing.role}' — refusing to modify. Resolve manually.`);
    process.exit(1);
  }
} else {
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({
    data: {
      email: email.toLowerCase(),
      name: "REPORTA Super Administrator",
      passwordHash,
      role: "super_admin",
      status: "active",
      mustChangePassword: true,
    },
  });
  console.log(`seed-admin: created super admin ${email}. First login requires a password change.`);
  console.log("seed-admin: the initial password is NOT logged. It was supplied via REPORTA_ADMIN_INITIAL_PASSWORD.");
}
await db.$disconnect();
