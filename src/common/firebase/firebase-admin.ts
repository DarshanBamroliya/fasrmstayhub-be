import * as dotenv from 'dotenv';
dotenv.config();

import * as admin from 'firebase-admin';
import * as path from 'path';

/**
 * Validate required Firebase environment variables
 */
const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

let firebaseAuth: admin.auth.Auth;

try {
  let credential: admin.credential.Credential;

  if (projectId && privateKeyRaw && clientEmail) {
    // Use environment variables if available
    // Warn if key looks truncated but try to proceed (or fail gracefully below)
    if (privateKeyRaw.includes('...rest of key...')) {
      console.warn(
        'WARNING: Firebase Private Key appears to be truncated. Authentication will likely fail.',
      );
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    credential = admin.credential.cert({
      projectId,
      privateKey,
      clientEmail,
    });
  } else {
    // Fallback to service account JSON file
    const serviceAccountPath = path.join(__dirname, '../../config/farmstayhub-firebase-adminsdk.json');
    credential = admin.credential.cert(serviceAccountPath);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential,
    });
  }

  firebaseAuth = admin.auth();
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error.message);
  console.warn('Using mock Firebase Auth to allow application startup.');

  // Mock auth object to prevent crash on import
  firebaseAuth = {
    verifyIdToken: async () => {
      throw new Error('Firebase Auth is not initialized correctly (Check server logs)');
    },
  } as any;
}

export { firebaseAuth };
