import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside the Next.js runtime so it doesn't auto-load
// .env.local the way `next dev` does. Load it explicitly.
config({ path: '.env.local' });
config({ path: '.env' });

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
