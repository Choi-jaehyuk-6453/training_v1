import "dotenv/config";
import { storage } from "../server/storage";

async function simulateLoginLookup(username: string, password: string) {
    console.log(`\nSimulating login for Username: "${username}", Password: "${password}"...`);
    let targetUser = null;

    // Simulate the exact logic in routes.ts
    const usersByName = await storage.getUsersByName(username);

    if (usersByName.length > 0) {
        targetUser = usersByName.find((u) => u.phone && u.phone.slice(-4) === password);

        if (!targetUser) {
            console.log("-> No exact match by password found, falling back to the first user...");
            targetUser = usersByName[0];
        } else {
            console.log("-> Exact match found by comparing password to phone number's last 4 digits!");
        }
    } else {
        console.log("-> No user found by name, falling back to username search...");
        targetUser = await storage.getUserByUsername(username);
    }

    if (!targetUser || !targetUser.phone) {
        console.log("Result: Login Failed (User not found).");
        return;
    }

    const email = `${targetUser.phone}@example.com`;
    console.log(`Result: Success! Resolved target email: ${email}`);
    console.log(`         Resolved user complete info:`, {
        name: targetUser.name,
        username: targetUser.username,
        phone: targetUser.phone,
        siteId: targetUser.siteId
    });
}

async function main() {
    try {
        const args = process.argv.slice(2);
        if (args.length >= 2) {
            await simulateLoginLookup(args[0], args[1]);
        } else {
            await simulateLoginLookup("이범석", "6171");
            await simulateLoginLookup("이범석", "0197");
            await simulateLoginLookup("김영길", "6240");
            await simulateLoginLookup("김영길", "1927");
            await simulateLoginLookup("없는이름", "0000");
        }
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}

main();
