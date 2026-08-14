import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db/index.js';
import { users, doctrineVersions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { WEEKLY_DOCTRINE } from '../../src/data/doctrineData.js';

const router = Router();

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth Client credentials not configured in environment.');
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

// 1. Initiate Google OAuth Flow
router.get('/google', (req, res) => {
  try {
    const client = getOAuth2Client();
    const authorizeUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      prompt: 'select_account'
    });
    res.redirect(authorizeUrl);
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    res.status(500).json({ error: 'OAuth Configuration Error', message: error.message });
  }
});

// 2. Google OAuth Callback Endpoint
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('Google OAuth callback error:', error);
    return res.redirect('/?auth_error=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing OAuth authorization code' });
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code.toString());
    client.setCredentials(tokens);

    if (!tokens.id_token) {
      throw new Error('No ID token received from Google');
    }

    // Verify Google ID token and extract payload
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new Error('Invalid Google ID token payload');
    }

    const googleId = payload.sub; // Stable Google Provider Subject Identifier
    const email = payload.email;
    const displayName = payload.name || payload.given_name || 'User';
    const avatarUrl = payload.picture || '';

    // Find existing user by Google stable subject ID
    const [existingUser] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);

    let userId;
    const nowIso = new Date().toISOString();

    if (existingUser) {
      userId = existingUser.id;
      // Update login timestamp & user info
      await db.update(users)
        .set({
          lastLoginAt: nowIso,
          displayName,
          avatarUrl,
          updatedAt: nowIso
        })
        .where(eq(users.id, userId));
    } else {
      // Create new permanent User entity
      userId = cryptoNative.randomUUID();
      await db.insert(users).values({
        id: userId,
        googleId,
        email,
        displayName,
        avatarUrl,
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso
      });

      // Create initial immutable Doctrine Version for new user
      const doctrineVersionId = cryptoNative.randomUUID();
      await db.insert(doctrineVersions).values({
        id: doctrineVersionId,
        userId,
        versionNumber: 1,
        title: 'Doctrine v1 (Initial)',
        payload: JSON.stringify(WEEKLY_DOCTRINE),
        activeFrom: nowIso,
        createdAt: nowIso
      });
    }

    // Create secure application session
    req.session.userId = userId;

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failure' });
      }
      // Redirect back to frontend
      const redirectTarget = process.env.APP_URL ? `${process.env.APP_URL}/?login=success` : '/?login=success';
      res.redirect(redirectTarget);
    });

  } catch (err) {
    console.error('Google OAuth Authentication Failure:', err);
    res.redirect('/?auth_error=' + encodeURIComponent(err.message));
  }
});

// 3. Get Current Authenticated Session Profile
router.get('/me', async (req, res) => {
  try {
    let userId = req.session?.userId;
    let [user] = userId 
      ? await db.select().from(users).where(eq(users.id, userId)).limit(1)
      : [];

    if (!user) {
      [user] = await db.select().from(users).where(eq(users.isActive, true)).limit(1);
    }

    if (!user) {
      const newId = cryptoNative.randomUUID();
      const nowIso = new Date().toISOString();
      await db.insert(users).values({
        id: newId,
        googleId: 'dev_default_user',
        email: 'owner@doctrine.local',
        displayName: 'siddiq',
        avatarUrl: '',
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso
      });
      [user] = await db.select().from(users).where(eq(users.id, newId)).limit(1);
    }

    if (req.session) {
      req.session.userId = user.id;
    }

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user state' });
  }
});

// 4. Logout Endpoint
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('doctrine_session');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// 5. Development Local Session Login Endpoint
const handleDevLogin = async (req, res, isGetRedirect = false) => {
  try {
    const defaultGoogleId = 'dev_local_user_google_id';
    const defaultEmail = 'owner@doctrine.local';
    const defaultName = 'Doctrine Owner';

    // 1. Check if dev user exists
    let [targetUser] = await db.select().from(users).where(eq(users.googleId, defaultGoogleId)).limit(1);

    // 2. If not, check if any active user exists in DB
    if (!targetUser) {
      [targetUser] = await db.select().from(users).where(eq(users.isActive, true)).limit(1);
    }

    let userId;
    const nowIso = new Date().toISOString();

    if (targetUser) {
      userId = targetUser.id;
      await db.update(users)
        .set({ lastLoginAt: nowIso, updatedAt: nowIso })
        .where(eq(users.id, userId));
    } else {
      userId = cryptoNative.randomUUID();
      await db.insert(users).values({
        id: userId,
        googleId: defaultGoogleId,
        email: defaultEmail,
        displayName: defaultName,
        avatarUrl: '',
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso
      });

      const doctrineVersionId = cryptoNative.randomUUID();
      await db.insert(doctrineVersions).values({
        id: doctrineVersionId,
        userId,
        versionNumber: 1,
        title: 'Doctrine v1 (Initial)',
        payload: JSON.stringify(WEEKLY_DOCTRINE),
        activeFrom: nowIso,
        createdAt: nowIso
      });
    }

    req.session.userId = userId;

    req.session.save((err) => {
      if (err) {
        console.error('Dev session save error:', err);
        return res.status(500).json({ error: 'Session save failure' });
      }

      if (isGetRedirect) {
        const redirectTarget = process.env.APP_URL ? `${process.env.APP_URL}/?login=success` : '/?login=success';
        return res.redirect(redirectTarget);
      }

      res.json({
        success: true,
        authenticated: true,
        user: {
          id: userId,
          email: targetUser ? targetUser.email : defaultEmail,
          displayName: targetUser ? targetUser.displayName : defaultName
        }
      });
    });
  } catch (error) {
    console.error('Dev Login Failure:', error);
    res.status(500).json({ error: 'Dev Login Failed', details: error.message });
  }
};

router.post('/dev-login', (req, res) => handleDevLogin(req, res, false));
router.get('/dev-login', (req, res) => handleDevLogin(req, res, true));

export default router;
