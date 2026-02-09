
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seedAdmin() {
    const username = "관리자";
    const password = "admin123";
    // Supabase often requires valid email formats (ASCII).
    // We will map "관리자" to "admin@example.com" in the login page.
    const email = "admin@example.com";

    console.log(`Seeding admin user: ${username} (${email})`);

    try {
        // 1. Create in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { role: "admin", name: username }
        });

        let userId = authData.user?.id;

        if (authError) {
            console.log("Supabase Auth create error (might already exist):", authError.message);
            // Try to get existing user
            const { data: existingUser } = await supabase.auth.admin.listUsers();
            const match = existingUser.users.find(u => u.email === email);
            if (match) {
                console.log("Found existing Supabase user ID:", match.id);
                userId = match.id;
                // Optional: Update password to ensure it matches
                await supabase.auth.admin.updateUserById(userId, { password: password });
            } else {
                throw new Error("Could not create or find Supabase user");
            }
        }

        if (!userId) throw new Error("No User ID resolved");

        // 2. Create in Local DB
        const [existing] = await db.select().from(users).where(eq(users.username, username));
        if (existing) {
            console.log("User already exists in local DB. Updating...");
            await db.update(users).set({
                id: userId, // Ensure IDs match
                role: "admin",
                name: username,
                company: "mirae_abm", // Default
                password: "MANAGED_BY_SUPABASE"
            }).where(eq(users.username, username));
        } else {
            console.log("Creating user in local DB...");
            await db.insert(users).values({
                id: userId,
                username: username,
                password: "MANAGED_BY_SUPABASE",
                name: username,
                role: "admin",
                company: "mirae_abm",
            });
        }

        console.log("Admin user seeded successfully!");
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

seedAdmin();
