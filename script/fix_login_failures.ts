import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { db } from "../server/db";
import { users, notifications, trainingRecords } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../server/storage";

const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { persistSession: false } }
);

async function main() {
    console.log("Checking all guards to find who cannot login, then fixing them...");
    try {
        const guards = await storage.getGuards();
        console.log(`Found ${guards.length} guards in DB.`);

        let fixedCount = 0;
        for (const guard of guards) {
            if (!guard.phone) continue;

            const expectedEmail = `${guard.phone}@example.com`;
            const expectedPassword = guard.phone.slice(-4) || "0000";

            // Try to sign in
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: expectedEmail,
                password: expectedPassword,
            });

            if (signInError) {
                console.log(`Guard ${guard.name} (${expectedEmail}) failed to login: ${signInError.message}. Fixing...`);

                // 1. Delete existing Auth user just in case
                await supabase.auth.admin.deleteUser(guard.id).catch(() => {});

                // 2. Create new Auth user with correct password (createUser allows 4 chars)
                const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
                    email: expectedEmail,
                    password: expectedPassword,
                    email_confirm: true,
                    user_metadata: { role: guard.role || "guard", name: guard.name }
                });

                if (createError || !newAuthUser.user) {
                    console.error(`  -> Failed to recreate Auth for ${guard.name}:`, createError?.message);
                    continue;
                }

                const newId = newAuthUser.user.id;
                console.log(`  -> Recreated Auth for ${guard.name}. New ID: ${newId}. Migrating DB...`);

                // 3. Migrate DB ID
                try {
                    // Update username to free up space temporarily to prevent unique constraint hit
                    await db.update(users).set({ username: guard.username + "_old_" + guard.id }).where(eq(users.id, guard.id));

                    await db.insert(users).values({
                        id: newId,
                        username: guard.username,
                        password: guard.password, // This is MANAGED_BY_SUPABASE string
                        name: guard.name,
                        phone: guard.phone,
                        role: guard.role,
                        company: guard.company,
                        siteId: guard.siteId,
                        createdAt: guard.createdAt
                    });

                    // Relink child records
                    await db.update(notifications).set({ guardId: newId }).where(eq(notifications.guardId, guard.id));
                    await db.update(trainingRecords).set({ guardId: newId }).where(eq(trainingRecords.guardId, guard.id));

                    // Delete old user
                    await db.delete(users).where(eq(users.id, guard.id));

                    console.log(`  -> Successfully fixed and migrated ${guard.name}!`);
                    fixedCount++;
                } catch (migrateErr: any) {
                    console.error(`  -> Failed to migrate DB for ${guard.name}:`, migrateErr.message);
                }
            } else {
                console.log(`Guard ${guard.name} (${expectedEmail}) logs in perfectly fine.`);
            }
        }
        console.log(`Finished check and fix. Fixed ${fixedCount} accounts.`);
    } catch (err) {
        console.error("Fatal Error:", err);
    }
    process.exit(0);
}

main();
