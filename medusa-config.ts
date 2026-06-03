import { defineConfig } from "@medusajs/framework/utils";

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

export default defineConfig({
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
    },
  },

  // Admin panel disabled on Render free tier — 512MB RAM is insufficient to
  // run both the API and the admin React bundle at the same time.
  admin: {
    disable: process.env.NODE_ENV === "production",
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
    path: "/app",
  },

  // Only override/extend default modules — all other core modules remain auto-loaded
  modules: [
    {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
        ],
      },
    },
  ],
});
