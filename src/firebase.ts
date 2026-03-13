import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      // Silently handle popup closure by user
      return null;
    }
    console.error("Authentication error:", error);
    throw error;
  }
};
export const logout = () => signOut(auth);

// Test connection
async function testConnection() {
  try {
    // We use getDocFromServer to force a network request
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    const err = error as any;
    // 'permission-denied' is actually a GOOD sign - it means we reached the server!
    if (err.code === 'permission-denied') {
      console.log("Firestore connection successful (verified via permission check).");
      return;
    }
    
    if (err.message?.includes('the client is offline') || err.code === 'unavailable') {
      console.error("Firestore connection failed: The client is offline or the backend is unreachable. Please check your Firebase configuration and internet connection.");
    } else {
      console.warn("Firestore connection test returned an unexpected error:", err.code, err.message);
    }
  }
}
testConnection();
