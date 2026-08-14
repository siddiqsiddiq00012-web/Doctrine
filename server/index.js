import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { runMigrations } from './db/migrate.js';
import { requireAuth } from './middleware/authMiddleware.js';
import { db } from './db/index.js';
import { progressPhotos } from './db/schema.js';
import { eq, and } from 'drizzle-orm';
import authRoutes from './routes/auth.js';
import historyRoutes from './routes/history.js';
import userRoutes from './routes/user.js';
import summaryRoutes from './routes/summary.js';
import weeklyRoutes from './routes/weekly.js';
import deRoutes from './routes/dataEngineering.js';
import resourcesRoutes from './routes/resources.js';
import dashboardRoutes from './routes/dashboard.js';
import skincareRoutes from './routes/skincare.js';
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

// Secure progress photos static serving with authentication & user ownership check
app.use('/uploads/progress_photos', requireAuth, async (req, res, next) => {
  try {
    const filename = path.basename(req.path);
    if (!filename || filename === '.' || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const relativeUrl = `/uploads/progress_photos/${filename}`;
    const [photo] = await db
      .select()
      .from(progressPhotos)
      .where(and(eq(progressPhotos.userId, req.user.id), eq(progressPhotos.photoUrl, relativeUrl)))
      .limit(1);

    if (!photo) {
      return res.status(403).json({ error: 'Forbidden: You do not own this progress photo' });
    }
    next();
  } catch (err) {
    console.error('[Photo Auth Error]', err);
    res.status(500).json({ error: 'Server error checking photo access' });
  }
});

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
app.use('/api/resources', resourcesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/skincare', skincareRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Doctrine OS Backend Server running on http://localhost:${PORT}`);
});

export default app;
