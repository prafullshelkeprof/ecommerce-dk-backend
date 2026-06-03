import { defineMiddlewares } from "@medusajs/medusa";
import cors from "cors";

export default defineMiddlewares({
  routes: [
    {
      // /cloud/auth has no CORS middleware by default — add it manually
      matcher: "/cloud/*",
      middlewares: [
        (req, res, next) => {
          const authCors = process.env.AUTH_CORS || "";
          const origins = authCors.split(",").map((o) => o.trim()).filter(Boolean);
          if (origins.length === 0) return next();
          return cors({ origin: origins, credentials: true })(req, res, next);
        },
      ],
    },
  ],
});
