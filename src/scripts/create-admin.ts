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

  // Use the emailpass provider's register method — this correctly bcrypt-hashes
  // the password before storing, so login works properly.
  const { success, authIdentity, error } = await authModule.register(
    "emailpass",
    { body: { email, password } }
  );

  if (!success || !authIdentity) {
    throw new Error(`Failed to register auth identity: ${error}`);
  }

  // Create the user record and link it to the auth identity
  const user = await userModule.createUsers({ email });

  await authModule.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: { user_id: user.id },
  });

  console.log(`Admin user created: ${email}`);
}
