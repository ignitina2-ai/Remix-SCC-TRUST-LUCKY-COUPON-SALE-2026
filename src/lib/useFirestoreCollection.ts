import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  QueryConstraint,
  DocumentData,
  FirestoreError
} from 'firebase/firestore';
import { db } from './firebase';

export interface FirestoreItem {
  id: string;
  _hasPendingWrites?: boolean;
  [key: string]: any;
}

interface UseFirestoreCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: FirestoreError | null;
  addDocument: (docData: Omit<T, 'id' | '_hasPendingWrites'>) => Promise<string>;
  updateDocument: (id: string, docData: Partial<Omit<T, 'id' | '_hasPendingWrites'>>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

/**
 * A highly-optimized, production-ready React custom hook to manage a Firestore collection.
 * Designed focused on:
 * 1. Fully-enabled offline caching (reads from local IndexedDB cache instantly).
 * 2. Multi-Tab sync using persistentMultipleTabManager to protect connection read quotas.
 * 3. Graceful offline execution state checking using standard _hasPendingWrites flags.
 * 
 * @param collectionName Name of the firestore collection
 * @param queryConstraints Query constraints (e.g., orderBy, limit, where) - SHOULD be stable or static!
 */
export function useFirestoreCollection<T extends FirestoreItem>(
  collectionName: string,
  queryConstraints: QueryConstraint[] = []
): UseFirestoreCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  // We keep a reference to query constraints to prevent infinite effect triggers
  // if queryConstraints values are re-instantiated inline on every render.
  const constraintsRef = useRef<QueryConstraint[]>(queryConstraints);

  useEffect(() => {
    // Check if constraints structurally changed or are different by identity
    // (A simple check; users should ideally stabilize constraints dynamically)
    constraintsRef.current = queryConstraints;
  }, [queryConstraints]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const colRef = collection(db, collectionName);
    const q = query(colRef, ...constraintsRef.current);

    /**
     * onSnapshot serves data from local cache first.
     * When includeMetadataChanges is set to true, Firestore notifies us
     * immediately of local changes, and triggers again when they commit to the cloud.
     */
    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const items: T[] = snapshot.docs.map((docSnap) => {
          return {
            id: docSnap.id,
            ...docSnap.data(),
            // Expose the offline status flag so UI can visualize live synchronization states
            _hasPendingWrites: docSnap.metadata.hasPendingWrites,
          } as unknown as T;
        });

        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`[Firestore offline collection listener error] for ${collectionName}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName]); // Keeps the subscription stable to prevent unrequested re-renders

  // Add document locally and syncs to cloud on internet restoration
  const addDocument = useCallback(async (docData: Omit<T, 'id' | '_hasPendingWrites'>): Promise<string> => {
    try {
      const colRef = collection(db, collectionName);
      // addDoc writes directly to the IndexedDB local cache first (resolving instantly)
      const docRef = await addDoc(colRef, docData as DocumentData);
      return docRef.id;
    } catch (err) {
      console.error(`[Firestore offline add error] for ${collectionName}:`, err);
      throw err;
    }
  }, [collectionName]);

  // Update document locally and syncs to cloud on internet restoration
  const updateDocument = useCallback(
    async (id: string, docData: Partial<Omit<T, 'id' | '_hasPendingWrites'>>): Promise<void> => {
      try {
        const docRef = doc(db, collectionName, id);
        // updateDoc edits optimistic state locally before sending background outbound requests
        await updateDoc(docRef, docData as DocumentData);
      } catch (err) {
        console.error(`[Firestore offline update error] for ${collectionName}:`, err);
        throw err;
      }
    },
    [collectionName]
  );

  // Delete document locally and syncs to cloud on internet restoration
  const deleteDocument = useCallback(async (id: string): Promise<void> => {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error(`[Firestore offline delete error] for ${collectionName}:`, err);
      throw err;
    }
  }, [collectionName]);

  return {
    data,
    loading,
    error,
    addDocument,
    updateDocument,
    deleteDocument
  };
}
