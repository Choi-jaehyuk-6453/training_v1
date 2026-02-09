import "dotenv/config";
import { db } from "../server/db";
import { trainingMaterials } from "@shared/schema";

async function main() {
    console.log("=== Training Materials Debug ===\n");

    const materials = await db.select().from(trainingMaterials);

    materials.forEach((m, idx) => {
        console.log(`\n--- Material ${idx + 1}: ${m.title} ---`);
        console.log(`ID: ${m.id}`);
        console.log(`Type: ${m.type}`);
        console.log(`\ncardImages type: ${typeof m.cardImages}`);
        console.log(`cardImages value: ${JSON.stringify(m.cardImages)?.substring(0, 200)}`);
        console.log(`\naudioUrls type: ${typeof m.audioUrls}`);
        console.log(`audioUrls value: ${JSON.stringify(m.audioUrls)?.substring(0, 200)}`);
        console.log(`\nquizzes type: ${typeof m.quizzes}`);
        console.log(`quizzes value: ${JSON.stringify(m.quizzes)?.substring(0, 300)}`);

        // Test parsing
        try {
            const cardImages = Array.isArray(m.cardImages) ? m.cardImages :
                typeof m.cardImages === 'string' ? JSON.parse(m.cardImages) : [];
            console.log(`\nParsed cardImages count: ${cardImages.length}`);
        } catch (e) {
            console.log(`\nFailed to parse cardImages: ${e}`);
        }

        try {
            const audioUrls = Array.isArray(m.audioUrls) ? m.audioUrls :
                typeof m.audioUrls === 'string' ? JSON.parse(m.audioUrls) : [];
            console.log(`Parsed audioUrls count: ${audioUrls.length}`);
        } catch (e) {
            console.log(`Failed to parse audioUrls: ${e}`);
        }

        try {
            const quizzes = Array.isArray(m.quizzes) ? m.quizzes :
                typeof m.quizzes === 'string' ? JSON.parse(m.quizzes) : [];
            console.log(`Parsed quizzes count: ${quizzes.length}`);
            if (quizzes.length > 0) {
                console.log(`First quiz: ${JSON.stringify(quizzes[0])}`);
            }
        } catch (e) {
            console.log(`Failed to parse quizzes: ${e}`);
        }
    });

    process.exit(0);
}

main();
