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
    console.log("Starting to fix all guards' auth accounts...");
    try {
        const guards = await storage.getGuards();
        console.log(`Found ${guards.length} guards in DB.`);

        for (const guard of guards) {
            if (!guard.phone) continue;

            const expectedEmail = `${guard.phone}@example.com`;
            const expectedPassword = guard.phone.slice(-4) || "0000";

            // Update or create Auth user for each guard
            const { data: authUser, error: authError } = await supabase.auth.admin.updateUserById(
                guard.id,
                {
                    email: expectedEmail,
                    email_confirm: true
                }
            );

            if (authError) {
                // If the user doesn't exist in Supabase Auth but exists in DB (rare, but possible due to bugs)
                if (authError.message.includes("User not found")) {
                    console.log(`User ${guard.name} missing in Auth. Creating...`);
                    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                        email: expectedEmail,
                        password: expectedPassword,
                        email_confirm: true,
                        user_metadata: { role: guard.role || "guard", name: guard.name }
                    });

                    if (createError) {
                        console.error(`  -> Failed to create Auth for ${guard.name}:`, createError.message);
                    } else if (newUser.user) {
                        // DB id doesn't match new Auth id. Wait, we shouldn't do ID migration here unless needed.
                        // If we just recreate it, we have to migrate the ID.
                        console.log(`  -> Created new Auth for ${guard.name} (New Auth ID: ${newUser.user.id}). Requires DB migration!`);
                        // Update DB to new ID
                        try {
                            const oldId = guard.id;
                            const newId = newUser.user.id;
                            
                            // To bypass primary key conflicts, we might need a cascading update, 
                            // but Postgres doesn't cascade update PKs easily if not set up.
                            // However, we can just do the duplicate check here.
                            console.log(`Please run sync_auth_users_final.ts if ID migrations are needed.`);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                } else {
                    console.error(`Failed to update Auth for ${guard.name} (${guard.id}):`, authError.message);
                }
            } else {
                console.log(`Successfully synced existing Auth for ${guard.name} (${expectedEmail})`);
            }
        }
        console.log("Finished fixing guards' auth accounts.");
    } catch (err) {
        console.error("Fatal Error:", err);
    }
    process.exit(0);
}

main();
