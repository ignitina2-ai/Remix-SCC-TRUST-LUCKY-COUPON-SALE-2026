import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads a file to Firebase Cloud Storage and returns its public URL
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  const uploadPromise = (async () => {
    const fileRef = ref(storage, path);
    const snapshot = await uploadBytes(fileRef, file);
    return await getDownloadURL(snapshot.ref);
  })();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Cloud Storage upload timed out after 4 seconds")), 4000)
  );

  try {
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    console.error("Storage upload failed or timed out for path:", path, err);
    throw err;
  }
}

/**
 * Deletes a file from Firebase Cloud Storage using its full download URL or path
 */
export async function deleteFileFromStorage(urlOrPath: string): Promise<void> {
  try {
    // If it's a full direct HTTP storage URL, we can ref it or parse it,
    // firestore / firebase storage 'ref' can parse full gs:// or https:// firebasestorage URLs natively!
    const fileRef = ref(storage, urlOrPath);
    await deleteObject(fileRef);
  } catch (err) {
    console.warn("Storage deletion ignored/failed for path:", urlOrPath, err);
  }
}
