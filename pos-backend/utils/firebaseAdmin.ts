import admin from "firebase-admin";
import config from "../config/config";

let _app: admin.app.App | null = null;

export function getFirebaseAdmin(): admin.app.App {
  if (_app) return _app;

  _app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   config.firebaseProjectId,
      clientEmail: config.firebaseClientEmail,
      // Private key is stored with literal \n in env — replace to actual newlines
      privateKey:  config.firebasePrivateKey.replace(/\\n/g, "\n"),
    }),
  });

  return _app;
}

/** Verify a Firebase ID token and return the decoded token. */
export async function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  getFirebaseAdmin();
  return admin.auth().verifyIdToken(idToken);
}
