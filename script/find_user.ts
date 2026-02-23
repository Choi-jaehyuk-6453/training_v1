import "dotenv/config";
import { db } from "../server/db";
import { users } from "@shared/schema";
import { eq, like } from "drizzle-orm";

async function main() {
    console.log("Searching for 한정수...");
    try {
        const foundUsers = await db.select().from(users).where(like(users.name, "%한정수%"));
        console.log("Found:", foundUsers.length);
        foundUsers.forEach(u => {
            console.log(`- Username: ${u.username}, Name: ${u.name}, Phone: ${u.phone}, ID: ${u.id}, CreatedAt: ${u.createdAt}`);
        });

        const byUsername = await db.select().from(users).where(like(users.username, "%한정수%"));
        console.log("Found by username:", byUsername.length);
        byUsername.forEach(u => {
            console.log(`- Username: ${u.username}, Name: ${u.name}, Phone: ${u.phone}, ID: ${u.id}, CreatedAt: ${u.createdAt}`);
        });

    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}

main();
