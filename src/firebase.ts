import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, browserPopupRedirectResolver, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  console.log("Attempting to sign in with Google...");
  try {
    const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    if (result.user) {
      // Force immediate profile creation/update
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          name: (result.user.displayName || 'User').substring(0, 100),
          role: 'viewer'
        });
      }
    }
    return result;
  } catch (error: any) {
    console.error("Detailed Authentication error:", error);
    if (error.code === 'auth/popup-blocked') {
      alert("Login popup was blocked by your browser. Please look for the 'Pop-up blocked' icon in your address bar and allow pop-ups for this site, then try again.");
      return null;
    }
    if (error.code === 'auth/popup-closed-by-user') {
      console.warn("Popup was closed before authentication could complete. This can happen due to browser security policies in iframes.");
      alert("The login window was closed. If you are seeing this repeatedly, please try opening the app in a new tab using the icon at the top right of the preview.");
      return null;
    }
    throw error;
  }
};

export const logout = () => signOut(auth);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
