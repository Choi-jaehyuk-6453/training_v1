import "dotenv/config";
import { storage } from "../server/storage";

async function main() {
    console.log("Checking specific users...");
    try {
        const guards = await storage.getGuards();
        const targets = guards.filter(g => g.name === '김영길' || g.name === '이범석');
        const sites = await storage.getSites();
        const siteTokens = sites.filter(s => s.name.includes('민락청구')).map(s => ({ id: s.id, name: s.name }));
        console.log("Sites:", siteTokens);

        console.log("Found targets:", targets.map(u => {
            const siteName = siteTokens.find(s => s.id === u.siteId)?.name || u.siteId;
            return { name: u.name, username: u.username, phone: u.phone, siteId: u.siteId, siteName };
        }));
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}
main();
