import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: process.env.NODE_ENV === 'production'
      ? { ssl: { rejectUnauthorized: false } }   // required for Neon / most cloud Postgres
      : {},
    http: {
      storeCors:  process.env.STORE_CORS!,
      adminCors:  process.env.ADMIN_CORS!,
      authCors:   process.env.AUTH_CORS!,
      jwtSecret:  process.env.JWT_SECRET  || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
  },

  // ─── Modules ─────────────────────────────────────────────────────────────
  // Redis is optional. If REDIS_URL is set we use it; otherwise Medusa falls
  // back to the in-process / database implementations – fine for a single
  // Render instance on the free tier.
  modules: [
    ...(process.env.REDIS_URL
      ? [
          {
            resolve: '@medusajs/cache-redis',
            options: { redisUrl: process.env.REDIS_URL },
          },
          {
            resolve: '@medusajs/event-bus-redis',
            options: { redisUrl: process.env.REDIS_URL },
          },
        ]
      : []),
  ],
})
