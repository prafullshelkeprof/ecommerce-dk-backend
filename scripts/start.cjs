/**
 * Smart startup script:
 * 1. Run migrations
 * 2. Seed database on first boot (skips if already seeded)
 * 3. Print publishable API key to logs
 * 4. Start Medusa server
 */
'use strict';

const { execSync } = require('child_process');
const { Client }   = require('pg');

async function main() {
  // ── 1. Migrations ────────────────────────────────────────────────────────
  console.log('\n==> Running migrations...');
  execSync('npx medusa db:migrate', { stdio: 'inherit', cwd: process.cwd() });
  console.log('==> Migrations complete ✓\n');

  // ── 2. Check if already seeded ───────────────────────────────────────────
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let alreadySeeded = false;
  try {
    const res = await client.query(
      "SELECT COUNT(*) FROM api_key WHERE type = 'publishable'"
    );
    alreadySeeded = parseInt(res.rows[0].count, 10) > 0;
  } catch {
    // Table may not exist yet on very first run – seed anyway
    alreadySeeded = false;
  } finally {
    await client.end();
  }

  // ── 3. Seed if needed ────────────────────────────────────────────────────
  if (!alreadySeeded) {
    console.log('==> First boot – seeding database...');
    execSync('npx medusa exec ./src/scripts/seed.ts', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('==> Seed complete ✓\n');
  } else {
    console.log('==> Database already seeded, skipping.\n');
  }

  // ── 4. Print publishable API key ─────────────────────────────────────────
  try {
    const c2 = new Client({ connectionString: process.env.DATABASE_URL });
    await c2.connect();
    const keyRes = await c2.query(
      "SELECT token FROM api_key WHERE type = 'publishable' LIMIT 1"
    );
    await c2.end();
    if (keyRes.rows[0]) {
      console.log('┌─────────────────────────────────────────────────────────┐');
      console.log('│  MEDUSA PUBLISHABLE API KEY (copy to Vercel env vars)   │');
      console.log(`│  ${keyRes.rows[0].token.padEnd(55)}│`);
      console.log('└─────────────────────────────────────────────────────────┘\n');
    }
  } catch (e) {
    console.warn('Could not fetch publishable key:', e.message);
  }

  // ── 5. Start server ───────────────────────────────────────────────────────
  console.log('==> Starting Medusa server...');
  execSync('npx medusa start', { stdio: 'inherit', cwd: process.cwd() });
}

main().catch((err) => {
  console.error('Startup error:', err.message);
  process.exit(1);
});
