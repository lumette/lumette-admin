import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { fileURLToPath } from 'node:url';

config({
  path: fileURLToPath(new URL('../../.env.local', import.meta.url)),
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Use Neon’s direct URL for CLI operations such as migrations. Runtime
  // queries continue to use the pooled DATABASE_URL in schema.prisma.
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
});
