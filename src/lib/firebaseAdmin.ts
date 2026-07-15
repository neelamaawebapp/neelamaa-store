import * as admin from "firebase-admin";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

const initFirebaseAdmin = () => {
  const apps = admin.getApps();
  if (apps.length > 0) {
    return apps[0]!;
  }

  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountVar) {
    console.warn("FIREBASE_SERVICE_ACCOUNT environment variable is not defined. Using public application fallback if possible.");
    return admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountVar);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON credential:", error);
    throw error;
  }
};

const adminApp = initFirebaseAdmin();
export const messaging = getMessaging(adminApp);
export const firestore = getFirestore(adminApp);

