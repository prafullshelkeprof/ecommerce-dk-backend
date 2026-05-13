// Strip sslmode and channel_binding from the URL so pg-connection-string doesn't
// override SSL config with verify-full semantics. SSL is handled via databaseDriverOptions.
function buildDatabaseUrl(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/[?&]sslmode=[^&]*/g, '')
    .replace(/[?&]channel_binding=[^&]*/g, '')
    .replace(/\?&/, '?')
    .replace(/\?$/, '');
}

export default {
  projectConfig: {
    databaseUrl: buildDatabaseUrl(process.env.DATABASE_URL),
    redisUrl: process.env.REDIS_URL,
    databaseDriverOptions: {
      connection: {
        ssl: {
          rejectUnauthorized: false,
        },
      },
    },
    http: {
      storeCors: process.env.STORE_CORS || "",
      adminCors: process.env.ADMIN_CORS || "",
      authCors: process.env.AUTH_CORS || "",
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
      port: parseInt(process.env.PORT || "9000"),
    },
  },

  modules: {
    locking: {
      resolve: "@medusajs/locking",
    },
    api_key: {
      resolve: "@medusajs/api-key",
    },
  },
};
