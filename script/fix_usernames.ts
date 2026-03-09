import 'dotenv/config';
import { db } from "../server/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { DatabaseStorage } from "../server/storage";

const storage = new DatabaseStorage();

async function run() {
    console.log("Starting username fix script...");
    const allUsers = await db.select().from(users).where(eq(users.role, "guard"));

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of allUsers) {
        if (user.username === user.phone || user.username.match(/^[0-9-]+$/)) {
            console.log(`Fixing user ${user.name} (Phone: ${user.phone}). Old username: ${user.username}`);

            let targetUsername = user.name;
            const existing = await storage.getUserByUsername(targetUsername);

            if (existing && existing.id !== user.id) {
                targetUsername = `${user.name}${user.phone?.slice(-4) || ""}`;
                console.log(` -> Conflict found for name ${user.name}. Using ${targetUsername}`);
            }

            try {
                await db.update(users).set({ username: targetUsername }).where(eq(users.id, user.id));
                updatedCount++;
                console.log(` -> Success! Updated to ${targetUsername}`);
            } catch (e) {
                console.log(` -> Failed: ${e}`);
                skippedCount++;
            }
        } else {
            skippedCount++;
        }
    }

    console.log(`\nMigration complete.`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    process.exit(0);
}

run();
