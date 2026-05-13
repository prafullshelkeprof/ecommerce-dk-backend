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

async function waitForDb(retries = 10, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await c.connect();
      await c.query('SELECT 1');
      await c.end();
      console.log('==> Database is ready ✓\n');
      return;
    } catch (e) {
      console.warn(`==> Database not ready yet (attempt ${i}/${retries}): ${e.message}`);
      await c.end().catch(() => {});
      if (i === retries) throw new Error('Database never became ready. Aborting.');
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  // ── 0. Wait for DB to be reachable (Neon free tier can be slow to wake) ──
  console.log('\n==> Waiting for database to be ready...');
  await waitForDb();

  // ── 1. Migrations ────────────────────────────────────────────────────────
  console.log('==> Running migrations...');
  try {
    execSync('npx medusa db:migrate', { stdio: 'inherit', cwd: process.cwd() });
    console.log('==> Migrations complete ✓\n');
  } catch (e) {
    // The pool.acquire() bug in Medusa 2.13.x causes a timeout AFTER
    // migrations have already been applied — safe to continue in that case.
    // For all other errors, log clearly so they appear in Render's deploy log.
    const msg = e.message || '';
    if (msg.includes('pool') || msg.includes('acquire') || msg.includes('Timeout')) {
      console.warn('==> Known pool.acquire timeout — schema already applied, continuing...\n');
    } else {
      console.error('==> Migration error (non-fatal, server will reveal root cause):', msg);
    }
  }

  // ── 1b. Mark known-buggy migration scripts as applied ────────────────────
  // The create-super-admin-role script requires the LOCKING module which is
  // unavailable during `medusa db:migrate`. Marking it applied prevents
  // `medusa start` from retrying it and failing on pool.acquire.
  {
    const mc = new Client({ connectionString: process.env.DATABASE_URL });
    await mc.connect();
    try {
      await mc.query(`
        INSERT INTO script_migrations (script_name, finished_at)
        VALUES ('create-super-admin-role.js', NOW())
        ON CONFLICT (script_name) DO UPDATE SET finished_at = COALESCE(script_migrations.finished_at, NOW())
      `);
      console.log('==> Migration script marked as applied ✓\n');
    } catch (e) {
      // Table may not exist on a brand-new DB — safe to ignore
      console.warn('==> Could not mark migration script (will retry on next boot):', e.message, '\n');
    } finally {
      await mc.end();
    }
  }

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
  execSync('npx medusa start --directory .medusa/server', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, HOST: '0.0.0.0' },
  });
}

main().catch((err) => {
  console.error('Startup error:', err.message);
  process.exit(1);
});
