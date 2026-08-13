import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { runMigrations } from './db/migrate.js';
import authRoutes from './routes/auth.js';
import historyRoutes from './routes/history.js';
import userRoutes from './routes/user.js';
import summaryRoutes from './routes/summary.js';
import weeklyRoutes from './routes/weekly.js';
import deRoutes from './routes/dataEngineering.js';
import { start10pmSummaryScheduler } from './jobs/summaryScheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directories exist
const avatarsDir = path.resolve(__dirname, '../uploads/avatars');
const progressPhotosDir = path.resolve(__dirname, '../uploads/progress_photos');

if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
if (!fs.existsSync(progressPhotosDir)) {
  fs.mkdirSync(progressPhotosDir, { recursive: true });
}

// Run database migrations on server startup
runMigrations();

// Start 10:00 PM Daily AI Summary background scheduler
start10pmSummaryScheduler();

// Enable CORS for Vite frontend with Credentials support
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

// Serve uploads statically for high-performance avatar and progress photo image retrieval
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Body Parser Configuration (10MB limit for image uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Configure HTTP-Only Signed Session Cookies
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error('FATAL: SESSION_SECRET is missing from environment.');
  process.exit(1);
}

app.use(
  session({
    name: 'doctrine_session',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true if running under HTTPS in production
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days TTL
    },
  })
);

// Mount API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/weekly', weeklyRoutes);
app.use('/api/de', deRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Doctrine OS Backend Server running on http://localhost:${PORT}`);
});

export default app;
