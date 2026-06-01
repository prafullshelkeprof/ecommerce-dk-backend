import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export default async function createAdmin({ container }: ExecArgs) {
  const email    = process.env.ADMIN_EMAIL    || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "SuperSecret123!";

  const userModule = container.resolve(Modules.USER);
  const authModule = container.resolve(Modules.AUTH);

  // Check if user already exists
  const existing = await userModule.listUsers({ email });
  if (existing.length > 0) {
    console.log(`Admin user ${email} already exists — skipping.`);
    return;
  }

  // Create the user record
  const user = await userModule.createUsers({ email });
  console.log(`Created user: ${user.id}`);

  // Create the emailpass auth identity linked to this user
  await authModule.createAuthIdentities({
    provider_identities: [
      {
        provider: "emailpass",
        entity_id: email,
        provider_metadata: { password },
      },
    ],
    app_metadata: { user_id: user.id },
  });

  console.log(`Admin user ready: ${email}`);
}
