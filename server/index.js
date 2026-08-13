import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { runMigrations } from './db/migrate.js';
import authRoutes from './routes/auth.js';
import historyRoutes from './routes/history.js';
import userRoutes from './routes/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Run database migrations on server startup
runMigrations();

// Enable CORS for Vite frontend with Credentials support
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

// Increased Body Parser Limit for Image Data URIs (10MB)
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

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Doctrine OS Backend Server running on http://localhost:${PORT}`);
});

export default app;
