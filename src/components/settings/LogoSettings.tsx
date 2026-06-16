import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Upload, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { AppData } from '@/types';
import { uploadFile, deleteFileFromStorage } from '@/lib/storage';

interface LogoSettingsProps {
  appData: AppData;
  onUpdateLogo: (logo: string) => void;
  user: any;
}

export const LogoSettings: React.FC<LogoSettingsProps> = ({ appData, onUpdateLogo, user }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setUploadError("Image file size should be less than 1MB");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    if (user) {
      // 2.5 second timeout safeguard to prevent hanging
      const uploadWithTimeout = (fileObj: File, filePath: string, ms: number): Promise<string> => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error("Storage upload timed out"));
          }, ms);
          
          uploadFile(fileObj, filePath).then(
            (url) => {
              clearTimeout(timer);
              resolve(url);
            },
            (err) => {
              clearTimeout(timer);
              reject(err);
            }
          );
        });
      };

      try {
        // Sanitize name a bit
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniquePath = `logos/logo_${Date.now()}_${safeName}`;
        
        // Delete old storage logo if it was a storage URL to save space
        if (appData.logo && appData.logo.startsWith('http')) {
          await deleteFileFromStorage(appData.logo);
        }

        const downloadUrl = await uploadWithTimeout(file, uniquePath, 2500);
        onUpdateLogo(downloadUrl);
        setIsUploading(false);
      } catch (err: any) {
        console.warn("Failed to upload logo to Firebase Storage or timed out, using local fallback:", err);
        // Fallback to local image reader if storage upload failed or timed out
        readAndSetLocal(file);
      }
    } else {
      readAndSetLocal(file);
    }
  };

  const readAndSetLocal = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdateLogo(reader.result as string);
      setIsUploading(false);
    };
    reader.onerror = () => {
      setUploadError("Failed to convert image to local offline format.");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteLogo = async () => {
    if (appData.logo && appData.logo.startsWith('http')) {
      try {
        await deleteFileFromStorage(appData.logo);
      } catch (err) {
        console.warn("Failed to delete stale logo file:", err);
      }
    }
    onUpdateLogo('');
  };

  return (
    <div id="settings-card-logo" className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
          <ImageIcon size={20} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">App Logo</h3>
      </div>
      
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 transition-all hover:bg-slate-100 relative">
        {isUploading ? (
          <div className="flex flex-col items-center justify-center space-y-4 p-8">
            <div className="relative flex items-center justify-center w-16 h-16">
              <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin absolute" />
              <ImageIcon className="w-6 h-6 text-blue-600 animate-pulse animate-duration-1000" />
            </div>
            <p className="text-blue-600 font-extrabold text-xs uppercase tracking-wider animate-pulse pt-2 text-center">
              Uploading to Cloud Storage...
            </p>
          </div>
        ) : appData.logo ? (
          <div className="relative group">
            <img src={appData.logo} alt="App Logo" className="w-32 h-32 object-contain rounded-xl shadow-md" />
            <button 
              onClick={handleDeleteLogo}
              className="absolute -top-2 -right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-slate-300 shadow-sm">
              <Upload size={24} />
            </div>
            <p className="text-slate-500 text-sm font-medium">No logo uploaded yet</p>
          </div>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleLogoUpload} 
          accept="image/*" 
          className="hidden" 
          disabled={isUploading}
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="mt-6 bg-white border border-slate-200 text-slate-700 px-6 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm cursor-pointer disabled:opacity-50"
        >
          {appData.logo ? 'Change Logo' : 'Upload Logo'}
        </button>

        {uploadError && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
            <AlertCircle size={12} />
            <span>{uploadError}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 text-center font-medium">
        {user ? "Saved securely in Firebase Cloud Storage." : "Saved locally on your browser. Connect Cloud server to enable persistent Cloud Storage."}
      </p>
    </div>
  );
};
