import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Neon CLI writes local development credentials to the repository root.
// Deployment platforms provide DATABASE_URL through process.env instead.
config({
  path: fileURLToPath(new URL('../../../.env.local', import.meta.url)),
  quiet: true,
});

export const prisma = new PrismaClient();
