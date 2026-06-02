import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export default async function createAdmin({ container }: ExecArgs) {
  const email    = process.env.ADMIN_EMAIL    || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "SuperSecret123!";

  const authModule = container.resolve(Modules.AUTH);

  // Register via emailpass provider (bcrypt-hashes password correctly)
  // If identity already exists, this will return success=false with a descriptive error
  const { success, authIdentity, error } = await authModule.register(
    "emailpass",
    { body: { email, password } }
  );

  if (!success) {
    // "Identity already exists" is not a fatal error — user was already created
    if (error && error.toString().toLowerCase().includes("exist")) {
      console.log(`Admin auth identity for ${email} already exists — skipping.`);
      return;
    }
    throw new Error(`Failed to register auth identity: ${error}`);
  }

  if (!authIdentity) {
    throw new Error("Auth identity missing after successful register.");
  }

  // Create the user record and link it to the auth identity
  const userModule = container.resolve(Modules.USER);
  const user = await userModule.createUsers({ email });

  await authModule.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: { user_id: user.id },
  });

  console.log(`Admin user created successfully: ${email}`);
}
