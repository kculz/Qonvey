// prisma.config.ts
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'), // This looks for DATABASE_URL in your system/.env
  },
});
