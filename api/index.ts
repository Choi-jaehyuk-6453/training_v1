import { createServer } from "http";
import express from "express";
import { registerRoutes } from "../server/routes";

const app = express();
const server = createServer(app);

// Helper to handle initialization once
let initialized = false;

export default async function handler(req: any, res: any) {
    if (!initialized) {
        // Vercel handles body parsing, but we might need these for Express
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));

        await registerRoutes(server, app);
        initialized = true;
    }

    // Forward request to Express
    app(req, res);
}
