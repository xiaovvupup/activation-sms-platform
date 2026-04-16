import bcrypt from "bcryptjs";
import { AdminRole, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WRAPPING_QUOTES_REGEX = /^[`"'“”‘’]+|[`"'“”‘’]+$/g;

function sanitizeEnvString(value: string | undefined, fallback: string) {
  return (value ?? fallback).trim().replace(WRAPPING_QUOTES_REGEX, "");
}

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().replace(WRAPPING_QUOTES_REGEX, "").toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

const adminEmail = sanitizeEnvString(process.env.ADMIN_SEED_EMAIL, "admin@example.com").toLowerCase();
const adminPassword = sanitizeEnvString(process.env.ADMIN_SEED_PASSWORD, "ChangeMe123!");
const singleAccountMode = parseBooleanEnv(process.env.ADMIN_SINGLE_ACCOUNT_MODE, true);

async function main() {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: AdminRole.super_admin,
      isActive: true
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: AdminRole.super_admin,
      isActive: true,
      name: "System Admin"
    }
  });

  if (singleAccountMode) {
    const result = await prisma.adminUser.updateMany({
      where: {
        email: {
          not: adminEmail
        }
      },
      data: {
        isActive: false
      }
    });
    // eslint-disable-next-line no-console
    console.log(`Admin synced. Deactivated old admins: ${result.count}`);
  } else {
    // eslint-disable-next-line no-console
    console.log("Admin synced. Multi-admin mode enabled, old admins kept active.");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
