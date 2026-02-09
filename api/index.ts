import { createServer } from "http";
import express from "express";
import { registerRoutes } from "../server/routes";

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

            // Vercel handles body parsing, but we might need these for Express
            app.use(express.json());
            app.use(express.urlencoded({ extended: false }));

            await registerRoutes(server, app);
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
