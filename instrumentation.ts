/**
 * Instrumentation file — runs before ANY Medusa module loads.
 * We use it to force SSL on every pg connection for Neon (production).
 */

export function register() {
  if (process.env.NODE_ENV !== 'production') return

  // Disable TLS cert verification globally (Neon uses valid certs but
  // pg-connection-string v2→v3 migration treats sslmode=require as verify-full
  // which breaks on some Node versions)
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  // Patch pg.Client and pg.Pool so every connection has ssl: true
  // even if the URL parser strips it
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pg = require('pg')

    const forceSsl = (config: Record<string, unknown>) => {
      if (!config) return config
      if (!config.ssl) {
        config.ssl = { rejectUnauthorized: false }
      }
      return config
    }

    const OriginalClient = pg.Client
    pg.Client = function (config: Record<string, unknown>) {
      return new OriginalClient(forceSsl({ ...config }))
    }
    Object.setPrototypeOf(pg.Client, OriginalClient)
    pg.Client.prototype = OriginalClient.prototype

    const OriginalPool = pg.Pool
    pg.Pool = function (config: Record<string, unknown>) {
      return new OriginalPool(forceSsl({ ...config }))
    }
    Object.setPrototypeOf(pg.Pool, OriginalPool)
    pg.Pool.prototype = OriginalPool.prototype

    console.log('[instrumentation] pg SSL patch applied ✓')
  } catch (e) {
    console.warn('[instrumentation] pg SSL patch failed:', e)
  }
}
