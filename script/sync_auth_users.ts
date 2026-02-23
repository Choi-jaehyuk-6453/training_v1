import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { db } from "../server/db";
import { users } from "@shared/schema";
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
    console.log("Starting Auth Sync...");
    try {
        const guards = await storage.getGuards();
        console.log(`Checking ${guards.length} guards...`);

        const { data: { users: authUsers }, error: fetchError } = await supabase.auth.admin.listUsers();
        if (fetchError) throw fetchError;

        // Use a loose matching because phone might have dashes.
        // Auth emails are like 010-1234-5678@example.com
        const emailsInAuth = new Set(authUsers.map(u => u.email));

        for (const guard of guards) {
            if (!guard.phone) continue;

            const expectedEmail = `${guard.phone}@example.com`;
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

                // Try to update DB user's ID to match Supabase's new UUID
                try {
                    await db.update(users)
                        .set({ id: authUser.user.id })
                        .where(eq(users.id, guard.id));
                    console.log(`Successfully synced DB and Auth for ${guard.name} (oldId: ${guard.id}, newId: ${authUser.user.id})`);
                } catch (updateErr: any) {
                    console.error(`Error updating DB for ${guard.name}. It might have foreign key constraints:`, updateErr.message);
                }
            }
        }
        console.log("Check complete.");
    } catch (err) {
        console.error("Fatal Error:", err);
    }
    process.exit(0);
}

main();
