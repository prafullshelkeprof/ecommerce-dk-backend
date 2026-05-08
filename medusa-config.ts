import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Ensure DATABASE_URL always has sslmode=require for cloud Postgres (Neon, Supabase, etc.)
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || ''
  if (process.env.NODE_ENV === 'production' && url && !url.includes('sslmode=')) {
    return url.includes('?') ? `${url}&sslmode=require` : `${url}?sslmode=require`
  }
  return url
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: getDatabaseUrl(),
    databaseDriverOptions: process.env.NODE_ENV === 'production'
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false, // Neon uses self-signed certs
          },
        }
      : {},
    http: {
      storeCors:    process.env.STORE_CORS!,
      adminCors:    process.env.ADMIN_CORS!,
      authCors:     process.env.AUTH_CORS!,
      jwtSecret:    process.env.JWT_SECRET    || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
  },

  // Redis is optional – if REDIS_URL is not set Medusa uses in-memory fallback
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
