import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

/**
 * Ensures the admin auth identity has app_metadata.user_id pointing to a
 * real user record. Run this if login works but /admin/users/me returns 401.
 */
export default async function linkAdmin({ container }: ExecArgs) {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";

  const authModule = container.resolve(Modules.AUTH);
  const userModule = container.resolve(Modules.USER);

  // Find the auth identity for this email
  const identities = await authModule.listAuthIdentities({});
  const identity = identities.find((i: any) =>
    i.provider_identities?.some(
      (p: any) => p.provider === "emailpass" && p.entity_id === email
    )
  );

  if (!identity) {
    throw new Error(`No auth identity found for ${email}. Run create-admin first.`);
  }

  console.log(`Found auth identity: ${identity.id}`);
  console.log(`Current app_metadata:`, JSON.stringify(identity.app_metadata));

  // Check if already linked
  if (identity.app_metadata?.user_id) {
    console.log(`Already linked to user_id: ${identity.app_metadata.user_id} — verifying user record exists...`);
    const users = await userModule.listUsers({ id: identity.app_metadata.user_id });
    if (users.length > 0) {
      console.log(`User record exists. Setup is correct — no action needed.`);
      return;
    }
    console.log(`User record missing for that id — will recreate.`);
  }

  // Find or create user record
  let user: any;
  const existing = await userModule.listUsers({ email });
  if (existing.length > 0) {
    user = existing[0];
    console.log(`Found existing user record: ${user.id}`);
  } else {
    user = await userModule.createUsers({ email });
    console.log(`Created user record: ${user.id}`);
  }

  // Link auth identity → user
  await authModule.updateAuthIdentities({
    id: identity.id,
    app_metadata: { user_id: user.id },
  });

  console.log(`Successfully linked auth identity ${identity.id} → user ${user.id}`);
}
