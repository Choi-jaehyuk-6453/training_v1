import { createServer } from "http";
import express from "express";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const app = express();
const server = createServer(app);

// Helper to handle initialization once
let initialized = false;

export default async function handler(req: any, res: any) {
    try {
        if (!initialized) {
            if (!process.env.DATABASE_URL) {
                throw new Error("DATABASE_URL is missing in environment variables");
            }

            // Import the bundled server code
            // We use require() to load the CJS bundle from dist-server/index.cjs
            // This bypasses Vercel's issue with bundling TS files from outside api/
            const serverModule = require("../dist-server/index.cjs");
            const { app: serverApp, init } = serverModule;

            // Initialize the server (db connection, middleware, routes)
            await init();

            // Mount the server app's routes to our handler app
            // Or we can just use serverApp(req, res) if we want to bypass this app.
            // But let's mount it to keep vercel body parsing + our app structure.
            app.use(serverApp);

            initialized = true;
        }

        // Forward request to Express
        app(req, res);
    } catch (error: any) {
        console.error("Serverless Function Error:", error);
        res.status(500).json({
            message: "Server Error: " + (error.message || "Unknown Error"),
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        });
    }
}
