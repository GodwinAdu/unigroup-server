
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import connectToDB from "./libs/mongoose";
import { log } from "./libs/utils/logger";
import config from "./config/config";
import { smsConfig } from "./sms/config";
import { requestLogger } from "./libs/helpers/logger";
import { sanitizeBody, securityHeaders } from "./libs/helpers/security-header";
import { apiRateLimit } from "./libs/helpers/rate-limiter";
import routers from './routers';
import { initializeSocket } from './sockets';
import webhookRoutes from './routes/webhook.routes';

const PORT = config.port || 3001;
const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Initialize Socket.IO
initializeSocket(io);

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(morgan("dev"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// Security middleware
app.use(
    helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
    }),
)

// Custom security headers
app.use(securityHeaders)

// Request logging
app.use(requestLogger)



// Body parsing middleware with size limits
app.use(express.json({ limit: "200mb" }))
app.use(express.urlencoded({ extended: true, limit: "200mb" }))

// Content type validation
// app.use(validateContentType)

// Input sanitization
app.use(sanitizeBody)

// No rate limiting for development
if (process.env.NODE_ENV === 'production') {
    app.use("/api", apiRateLimit)
}


// Make io available to routes
app.set('io', io);

// Webhook routes (before body parsing middleware)
app.use('/api/webhooks', webhookRoutes);

// API Routes
app.use('/api', routers);

app.get("/", (req, res) => {
    res.send("Welcome to the Alumzi Backend API! 🚀");
});

// Global Error Handler: Catches all unhandled errors and sends a generic 500 response.
// This middleware should be placed after all other routes and middleware.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    log.error("❌ ERROR: " + String(err));
    console.error("❌ ERROR:", err);
    res.status(500).json({ message: "Internal Server Error" });
});


// Start Server
const startServer = async () => {
    try {
        await connectToDB(); // Ensure DB is connected first
        //  await smsConfig({text:"Note The value set as sender must exist in the list of user message sender names.", destinations:["0551556650"]})
        server.listen(PORT, () => {
            log.info(`✅ Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to start application:", error);
        process.exit(1); // Exit if server fails to start
    }
};

startServer();