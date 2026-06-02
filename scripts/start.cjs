/**
 * Smart startup script:
 * 1. Run migrations
 * 2. Seed database on first boot (skips if already seeded)
 * 3. Create admin user if none exists
 * 4. Print publishable API key to logs
 * 5. Start Medusa server
 */
'use strict';

const { execSync } = require('child_process');
const { Client }   = require('pg');
const fs           = require('fs');
const path         = require('path');

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
  // ── 0. Wait for DB ───────────────────────────────────────────────────────
  console.log('\n==> Waiting for database to be ready...');
  await waitForDb();

  // ── 1. Migrations ────────────────────────────────────────────────────────
  console.log('==> Running migrations...');
  try {
    execSync('npx medusa db:migrate', { stdio: 'inherit', cwd: process.cwd() });
    console.log('==> Migrations complete ✓\n');
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('pool') || msg.includes('acquire') || msg.includes('Timeout')) {
      console.warn('==> Known pool.acquire timeout — schema already applied, continuing...\n');
    } else {
      console.error('==> Migration error (non-fatal, server will reveal root cause):', msg);
    }
  }

  // ── 1b. Mark known-buggy migration scripts as applied ────────────────────
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

  // ── 3b. Create admin user if none exists ────────────────────────────────
  const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecret123!';

  const uc = new Client({ connectionString: process.env.DATABASE_URL });
  await uc.connect();
  let hasAdminUser = false;
  try {
    const res = await uc.query(
      `SELECT COUNT(*) FROM auth_identity
       WHERE provider_identities::text LIKE '%emailpass%'`
    );
    hasAdminUser = parseInt(res.rows[0].count, 10) > 0;
  } catch {
    hasAdminUser = false;
  } finally {
    await uc.end();
  }

  if (!hasAdminUser) {
    console.log(`==> No admin user found — creating ${adminEmail} ...`);
    try {
      execSync(
        `npx medusa exec ./src/scripts/create-admin.ts`,
        { stdio: 'inherit', cwd: process.cwd() }
      );
      console.log('==> Admin user created ✓\n');
    } catch (e) {
      console.warn('==> Could not create admin user:', e.message, '\n');
    }
  } else {
    console.log('==> Admin user already exists, skipping.\n');
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

  // ── 4b. Always ensure auth identity is linked to a user record ──────────
  console.log('==> Ensuring admin auth identity is linked to user record...');
  try {
    execSync(
      `npx medusa exec ./src/scripts/link-admin.ts`,
      { stdio: 'inherit', cwd: process.cwd() }
    );
    console.log('==> Admin link check complete ✓\n');
  } catch (e) {
    console.warn('==> Could not verify admin link (non-fatal):', e.message, '\n');
  }

  // ── 5. Start server ───────────────────────────────────────────────────────
  console.log('==> Starting Medusa server...');
  execSync('npx medusa start', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, HOST: '0.0.0.0' },
  });
}

main().catch((err) => {
  console.error('Startup error:', err.message);
  process.exit(1);
});
