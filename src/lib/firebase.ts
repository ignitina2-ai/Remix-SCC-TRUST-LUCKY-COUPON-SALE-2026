import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json'; // Located in the root workspace folder

const app = initializeApp(firebaseConfig);

let db: Firestore;

try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    ignoreUndefinedProperties: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch (e: any) {
  console.warn("Firebase persistentLocalCache initialization failed, falling back to basic/default cache:", e);
  try {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    }, firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    console.warn("Second firebase initialization attempt failed, utilizing basic getFirestore:", err);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export { db };
export const auth = getAuth();
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOffline = errMsg.toLowerCase().includes('offline') || 
                    errMsg.toLowerCase().includes('unavailable') || 
                    errMsg.toLowerCase().includes('network') ||
                    (error && typeof error === 'object' && (error as any).code === 'unavailable');

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isOffline) {
    console.warn('Firestore Offline/Network Warning: ', JSON.stringify(errInfo));
    return; // Don't throw for offline/network/unavailable issues to keep app responsive
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
