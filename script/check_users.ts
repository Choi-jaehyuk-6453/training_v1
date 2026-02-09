import "dotenv/config";
import { storage } from "../server/storage";

async function main() {
    console.log("Checking users...");
    try {
        const guards = await storage.getGuards();
        console.log("Found guards:", guards.length);
        guards.forEach(g => {
            console.log(`- Name: ${g.name}, Phone: ${g.phone}, Username: ${g.username}, ID: ${g.id}`);
        });
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}

main();
