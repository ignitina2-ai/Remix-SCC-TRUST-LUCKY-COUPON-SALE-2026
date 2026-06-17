import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Uploads a file to Firebase Cloud Storage.
 * @param file The file to upload.
 * @param path The path in Firebase storage bucket (e.g., 'logos/logo_123.jpg').
 * @returns Promise resolving to the public download URL of the uploaded file.
 */
export function uploadFile(file: File, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      null, // We can scale this with a progress callback later if needed
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

/**
 * Deletes a file from Firebase Storage.
 * @param fileUrl The full HTTP download URL of the file.
 */
export async function deleteFileFromStorage(fileUrl: string): Promise<void> {
  if (!fileUrl || !fileUrl.startsWith('http')) return;
  try {
    const fileRef = ref(storage, fileUrl);
    await deleteObject(fileRef);
  } catch (error) {
    console.warn('Error deleting file from storage:', error);
  }
}

/**
 * Converts a data URL (base64 string) to a standard File object.
 */
export function dataURLtoFile(dataUrl: string, filename: string): File | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const header = parts[0];
    const base64Data = parts[1];
    
    const mimeMatch = header.match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    
    const bstr = atob(base64Data);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (e) {
    console.warn('Failed to parse data URL to file:', e);
    return null;
  }
}

