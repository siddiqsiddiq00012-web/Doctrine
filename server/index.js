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
import { users, dailySummaries, progressPhotos } from './db/schema.js';
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
import { generateDailySummary } from './services/aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

// Ensure uploads directories exist (non-fatal on read-only serverless filesystems)
if (!isVercel) {
  try {
    const avatarsDir = path.resolve(__dirname, '../uploads/avatars');
    const progressPhotosDir = path.resolve(__dirname, '../uploads/progress_photos');
    if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
    if (!fs.existsSync(progressPhotosDir)) fs.mkdirSync(progressPhotosDir, { recursive: true });
  } catch (e) {
    console.warn('[Storage Warning] Local upload folder creation skipped:', e.message);
  }

  // Run database migrations and start local 60s background scheduler on startup
  runMigrations();
  start10pmSummaryScheduler();
}

// Enable CORS for Vite frontend with Credentials support
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow local development origin, process.env.APP_URL, or same-origin serverless calls
      if (!origin || origin === 'http://localhost:5173' || origin === process.env.APP_URL || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
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
const sessionSecret = process.env.SESSION_SECRET || 'doctrine_dev_session_secret_change_in_production_12345';
const isProduction = process.env.NODE_ENV === 'production' || isVercel;

app.use(
  session({
    name: 'doctrine_session',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction, // HTTPS in production / Vercel
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days TTL
    },
  })
);

// SECURE 10:00 PM SUMMARY VERCEL CRON ENDPOINT
app.all('/api/jobs/summary-cron', async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1' || (cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (isProduction && !isVercelCron) {
    return res.status(401).json({ error: 'Unauthorized cron request' });
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const activeUsers = await db.select().from(users).where(eq(users.isActive, true));
    let processedCount = 0;

    for (const u of activeUsers) {
      const [existing] = await db
        .select()
        .from(dailySummaries)
        .where(and(eq(dailySummaries.userId, u.id), eq(dailySummaries.date, todayStr)))
        .limit(1);

      if (!existing) {
        await generateDailySummary(u.id, todayStr, false);
        processedCount++;
      }
    }

    res.json({ success: true, processed: processedCount, date: todayStr });
  } catch (err) {
    console.error('[Summary Cron Error]', err);
    res.status(500).json({ error: 'Cron execution failed', details: err.message });
  }
});

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
  res.json({ status: 'OK', timestamp: new Date().toISOString(), environment: isVercel ? 'vercel-serverless' : 'standalone-node' });
});

// Start standalone HTTP listener ONLY in local development
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`Doctrine OS Backend Server running on http://localhost:${PORT}`);
  });
}

export default app;
