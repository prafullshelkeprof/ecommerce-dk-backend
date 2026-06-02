import { defineMiddlewares } from "@medusajs/medusa";
import cors from "cors";

const AUTH_CORS = process.env.AUTH_CORS || "";

export default defineMiddlewares({
  routes: [
    {
      // /cloud/auth has no CORS middleware by default — add it manually
      matcher: "/cloud/*",
      middlewares: [
        cors({
          origin: AUTH_CORS.split(",").map((o) => o.trim()).filter(Boolean),
          credentials: true,
        }),
      ],
    },
  ],
});
