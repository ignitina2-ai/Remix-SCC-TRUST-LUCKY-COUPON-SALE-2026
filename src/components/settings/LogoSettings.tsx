import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Upload, Trash2, Loader2, AlertCircle, CheckCircle2, Laptop, Smartphone, Settings } from 'lucide-react';
import { AppData } from '@/types';
import { cn } from '@/lib/utils';
import { uploadFile, deleteFileFromStorage } from '@/lib/storage';

interface LogoSettingsProps {
  appData: AppData;
  onUpdateLogo: (logo: string) => void;
  onUpdateLogoMobile?: (logo: string) => void;
  onUpdateLogoDesktop?: (logo: string) => void;
  user: any;
}

export const LogoSettings: React.FC<LogoSettingsProps> = ({ 
  appData, 
  onUpdateLogo, 
  onUpdateLogoMobile, 
  onUpdateLogoDesktop, 
  user 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const currentLogo = appData.logo || appData.logoDesktop || appData.logoMobile || '';

  // Helper inside component to compress/resize logo before upload/save
  const compressImage = (file: File, maxW = 320, maxH = 320): Promise<{ blob: Blob; base64: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxW || height > maxH) {
            if (width / height > maxW / maxH) {
              height = Math.round((height * maxW) / width);
              width = maxW;
            } else {
              width = Math.round((width * maxH) / height);
              height = maxH;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Export base64
          const base64 = canvas.toDataURL('image/png');
          
          // Convert to Blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve({ blob, base64 });
            } else {
              reject(new Error('Failed to create blob'));
            }
          }, 'image/png');
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      // 1. Instantly compress/resize client-side to maximum of 320x320 pixels 
      const { blob, base64 } = await compressImage(file);

      // If connected to Cloud, upload compressed Blob to Firebase Cloud Storage!
      if (user && !user.isLocal) {
        try {
          const fileExtension = 'png';
          const storagePath = `logos/brand_logo_${Date.now()}.${fileExtension}`;
          
          // Convert blob back to File object for upload compatibility
          const compressedFile = new File([blob], `logo.${fileExtension}`, { type: 'image/png' });
          const downloadUrl = await uploadFile(compressedFile, storagePath);
          
          // Clean up previous logo(s) if they were storage URLs
          const oldLogos = [appData.logo, appData.logoDesktop, appData.logoMobile].filter(Boolean);
          for (const old of oldLogos) {
            if (old && old.includes('firebasestorage')) {
              try {
                await deleteFileFromStorage(old);
              } catch (delErr) {
                console.warn("Could not delete old storage file, ignoring:", delErr);
              }
            }
          }

          onUpdateLogo(downloadUrl);
          if (onUpdateLogoMobile) onUpdateLogoMobile(downloadUrl);
          if (onUpdateLogoDesktop) (onUpdateLogoDesktop as any)(downloadUrl);

          setUploadSuccess("Brand logo uploaded to Firebase Cloud Storage successfully!");
          setIsUploading(false);
        } catch (err: any) {
          console.warn("Cloud storage upload failed, falling back to compressed local base64 inside Firestore setting:", err);
          // Fall back to direct local compressed base64 which is extremely lightweight and 100% reliable inside Firestore
          onUpdateLogo(base64);
          if (onUpdateLogoMobile) onUpdateLogoMobile(base64);
          if (onUpdateLogoDesktop) (onUpdateLogoDesktop as any)(base64);

          setUploadSuccess("Brand logo saved successfully inside Google Firestore database settings!");
          setIsUploading(false);
        }
      } else {
        // Fallback local reader
        onUpdateLogo(base64);
        if (onUpdateLogoMobile) onUpdateLogoMobile(base64);
        if (onUpdateLogoDesktop) (onUpdateLogoDesktop as any)(base64);

        setUploadSuccess("Brand logo loaded and saved successfully!");
        setIsUploading(false);
      }
    } catch (err: any) {
      console.error("Compression / upload error:", err);
      setUploadError("Image conversion and upload failed: " + (err.message || err));
      setIsUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    // Delete old logo files from cloud storage if active
    const oldLogos = [appData.logo, appData.logoDesktop, appData.logoMobile].filter(Boolean);
    for (const old of oldLogos) {
      if (old && old.includes('firebasestorage')) {
        try {
          await deleteFileFromStorage(old);
        } catch (e) {
          console.warn("Could not delete from storage bucket:", e);
        }
      }
    }

    setUploadError(null);
    setUploadSuccess(null);

    onUpdateLogo('');
    if (onUpdateLogoMobile) onUpdateLogoMobile('');
    if (onUpdateLogoDesktop) (onUpdateLogoDesktop as any)('');
  };

  return (
    <div id="settings-card-logo" className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
            <ImageIcon size={20} />
          </div>
          <div className="text-left font-sans">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">App Logo</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Customize splash & header icon</p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">
            {isExpanded ? "Setup open" : "Setup hidden"}
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer shadow-inner",
              isExpanded ? "bg-blue-600" : "bg-slate-300"
            )}
            title={isExpanded ? "Collapse Logo Settings" : "Expand Logo Settings"}
          >
            <div className={cn(
              "w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-md",
              isExpanded ? "translate-x-6" : "translate-x-0"
            )} />
          </button>
        </div>
      </div>

      {!isExpanded ? (
        /* Collapsed summary layout to save massive amount of space */
        <div className="p-4 bg-slate-50/75 hover:bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors animate-in fade-in duration-300 text-left font-sans">
          <div className="space-y-1.5 w-full sm:w-auto">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Brand Logo Status</h4>
            <div className="font-mono text-[9px] text-slate-500 font-bold">
              <span className={cn(
                "inline-flex items-center gap-1.5 border px-2 py-0.5 rounded-lg",
                currentLogo ? "bg-blue-50/50 text-blue-700 border-blue-100" : "bg-white text-slate-400 border-slate-200/50"
              )}>
                <Settings size={11} /> Logo Image: {currentLogo ? "CUSTOM ACTIVE" : "SYSTEM DEFAULT"}
              </span>
            </div>
          </div>
          
          {currentLogo ? (
            <div className="flex items-center gap-2 self-end sm:self-center bg-white border border-slate-200/60 p-1.5 rounded-xl">
              <div className="text-center">
                <img 
                  src={currentLogo} 
                  alt="App Brand Logo" 
                  className="w-10 h-10 object-contain mx-auto border border-slate-100 rounded bg-slate-50 p-0.5" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          ) : (
            <span className="self-end sm:self-center text-[9px] text-slate-500 font-black uppercase tracking-wider bg-slate-200/50 border border-slate-200/20 px-3 py-1.5 rounded-xl">
              Default System Slates
            </span>
          )}
        </div>
      ) : (
        /* Fully expanded layout to modify details */
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 transition-all hover:bg-slate-100 relative">
            {isUploading ? (
              <div className="flex flex-col items-center justify-center space-y-4 p-8">
                <div className="relative flex items-center justify-center w-16 h-16">
                  <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin absolute" />
                  <ImageIcon className="w-6 h-6 text-blue-600 animate-pulse" />
                </div>
                <p className="text-blue-600 font-extrabold text-xs uppercase tracking-wider animate-pulse pt-2 text-center">
                  Uploading to Cloud Storage...
                </p>
              </div>
            ) : currentLogo ? (
              <div className="relative group">
                <img src={currentLogo} alt="App Logo" className="w-32 h-32 object-contain rounded-xl shadow-md" referrerPolicy="no-referrer" />
                <button 
                  onClick={handleDeleteLogo}
                  className="absolute -top-2 -right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg opacity-100 group-hover:opacity-100 transition-all cursor-pointer border-0"
                  title="Remove Logo File"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-slate-300 shadow-sm">
                  <Upload size={24} />
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">No custom logo configured</p>
                <p className="text-[10px] text-slate-400 font-bold max-w-xs mx-auto">
                  If empty, devices will display default layouts or fallback to system launcher icons.
                </p>
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
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="mt-6 bg-white border border-slate-200 text-slate-700 px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all shadow-sm cursor-pointer disabled:opacity-50 uppercase tracking-widest"
            >
              {currentLogo ? 'Change Selected Logo' : 'Upload custom logo'}
            </button>

            {uploadError && (
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 animate-slide-in font-sans">
                <AlertCircle size={12} />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-full border border-emerald-100 animate-slide-in font-sans">
                <CheckCircle2 size={12} />
                <span>{uploadSuccess}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-widest">
        {user ? "Saved securely in Firebase Cloud Storage." : "Saved locally on your browser database."}
      </p>
    </div>
  );
};
