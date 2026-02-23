import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { db } from "../server/db";
import { users, notifications, trainingRecords } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../server/storage";

const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    {
        auth: {
            persistSession: false,
        },
    }
);

async function main() {
    console.log("Starting Auth Sync (Duplicate-and-Replace strategy)...");
    try {
        const guards = await storage.getGuards();
        console.log(`Checking ${guards.length} guards...`);

        let allAuthUsers: any[] = [];
        let page = 1;
        while (true) {
            const { data: { users: authUsers }, error: fetchError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
            if (fetchError) throw fetchError;
            if (authUsers.length === 0) break;
            allAuthUsers.push(...authUsers);
            if (authUsers.length < 1000) break;
            page++;
        }

        const emailsInAuth = new Set(allAuthUsers.map(u => u.email));

        // We already created Auth users in the previous failed run for some guards,
        // so we need to map those existing Auth users to our local users that have OLD ids.
        const authUsersByEmail = new Map(allAuthUsers.map(u => [u.email, u]));

        for (const guard of guards) {
            if (!guard.phone) continue;

            const expectedEmail = `${guard.phone}@example.com`;
            let authUserId = null;

            if (!emailsInAuth.has(expectedEmail)) {
                console.log(`User ${guard.name} (${expectedEmail}) is missing from Auth. Creating...`);
                const password = guard.phone.slice(-4) || "0000";

                const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                    email: expectedEmail,
                    password: password,
                    email_confirm: true,
                    user_metadata: { role: guard.role || "guard", name: guard.name }
                });

                if (authError || !authUser.user) {
                    console.error(`Failed to create Auth for ${guard.name}:`, authError?.message);
                    continue;
                }
                authUserId = authUser.user.id;
            } else {
                // Auth user exists (maybe created in last run) but local DB still has old ID
                const existingAuth = authUsersByEmail.get(expectedEmail);
                if (existingAuth && guard.id !== existingAuth.id) {
                    authUserId = existingAuth.id;
                }
            }

            if (authUserId && guard.id !== authUserId) {
                try {
                    console.log(`Migrating ${guard.name} from ${guard.id} to ${authUserId}`);

                    // Rename old user to bypass unique username constraint
                    await db.update(users).set({ username: guard.username + "_old_" + guard.id }).where(eq(users.id, guard.id));

                    // Duplicate user
                    await db.insert(users).values({
                        id: authUserId,
                        username: guard.username,
                        password: guard.password,
                        name: guard.name,
                        phone: guard.phone,
                        role: guard.role,
                        company: guard.company,
                        siteId: guard.siteId,
                        createdAt: guard.createdAt
                    });

                    // Re-link child records
                    await db.update(notifications).set({ guardId: authUserId }).where(eq(notifications.guardId, guard.id));
                    await db.update(trainingRecords).set({ guardId: authUserId }).where(eq(trainingRecords.guardId, guard.id));

                    // Delete old user
                    await db.delete(users).where(eq(users.id, guard.id));

                    console.log(`Success: Migrated ${guard.name}`);
                } catch (updateErr: any) {
                    console.error(`Error migrating ${guard.name}:`, updateErr.message);
                }
            }
        }
        console.log("Sync complete.");
    } catch (err) {
        console.error("Fatal Error:", err);
    }
    process.exit(0);
}

main();
