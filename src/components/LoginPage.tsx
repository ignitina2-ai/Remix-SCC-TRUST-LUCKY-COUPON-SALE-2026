import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, HelpCircle, Shield, AlertTriangle, CheckCircle, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { TrustLogo } from './TrustLogo';
import { useActiveResponsiveLogo } from '@/lib/logo-resolver';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
  handleGoogleLogin: () => Promise<void>;
  isLoggingIn: boolean;
  authError: { message: string; code?: string } | null;
  setAuthError: (err: any) => void;
  appData: any;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  handleGoogleLogin,
  isLoggingIn,
  authError,
  setAuthError,
  appData
}) => {
  const { resolvedLogo } = useActiveResponsiveLogo(appData);
  const [email, setEmail] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [isVerifyingLocal, setIsVerifyingLocal] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Read saved emails to check against
  const getCachedEmails = (): string[] => {
    try {
      const saved = localStorage.getItem('scc_permitted_emails');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to parse cached permitted emails list", e);
    }
    return [];
  };

  const handleLocalEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);
    setAuthError(null);
    
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorLocal('Please enter your Google Email address.');
      return;
    }

    // Built-in email match validator
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorLocal('Please enter a valid format email address.');
      return;
    }

    setIsVerifyingLocal(true);

    try {
      // Primary Admin match or cached matches list
      const isPrimaryAdmin = cleanEmail === 'ignitina2@gmail.com' || cleanEmail === 'ignitina2@mail.com';
      const cachedAllowed = getCachedEmails();
      let isAllowed = isPrimaryAdmin || cachedAllowed.includes(cleanEmail);

      if (!isAllowed) {
        // Query Firestore directly to see if this email exists and is not disabled
        const docSnap = await getDoc(doc(db, 'allowedUsers', cleanEmail));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.disabled !== true) {
            isAllowed = true;
            // Cache it locally so subsequent entries are instant
            try {
              const saved = localStorage.getItem('scc_permitted_emails');
              let list = saved ? JSON.parse(saved) : [];
              if (!Array.isArray(list)) list = [];
              if (!list.includes(cleanEmail)) {
                list.push(cleanEmail);
                localStorage.setItem('scc_permitted_emails', JSON.stringify(list));
              }
            } catch (e) {
              console.error("Failed to cache email locally", e);
            }
          } else if (data && data.disabled === true) {
            setErrorLocal('Access Denied: This account has been disabled by the administrator.');
            setIsVerifyingLocal(false);
            return;
          }
        }
      }

      if (isAllowed) {
        setVerificationSuccess(true);
        setTimeout(() => {
          // Log in with offline session structure
          const mockUser = {
            email: cleanEmail,
            displayName: cleanEmail.split('@')[0],
            photoURL: '',
            uid: `local_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
            isLocal: true
          };
          onLoginSuccess(mockUser);
        }, 800);
      } else {
        setErrorLocal(
          `Unauthorized Email: "${cleanEmail}" is not listed in the permitted users directory. If you are an authorized helper, please connect with Google first or request the admin (ignitina2@gmail.com) to add you.`
        );
      }
    } catch (err: any) {
      console.error("Verifying email against directory failed:", err);
      setErrorLocal("Permission verification failed. Please check your internet connection or try connecting with Google.");
    } finally {
      setIsVerifyingLocal(false);
    }
  };

  return (
    <div 
      id="login-page-screen" 
      className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans select-none relative overflow-hidden"
    >
      {/* Decorative clean ambient background glow */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-rose-100/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white border border-slate-200/80 shadow-2xl rounded-[2.5rem] p-6 md:p-10 relative z-10 flex flex-col items-center">
        {/* Decorative Top header logo & text */}
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1.5 shadow-md relative overflow-hidden">
            {resolvedLogo ? (
              <img src={resolvedLogo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <TrustLogo size={80} className="w-full h-full" />
            )}
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">ST.CASIMIR CHARITABLE TRUST</h1>
            <p className="text-[10px] font-bold text-blue-600 tracking-widest uppercase mt-0.5">SCC TRUST LUCKY COUPON SALE 2026</p>
          </div>
        </div>

        {/* Security Alert Header */}
        <div className="w-full bg-slate-50/80 border border-slate-100 rounded-3xl p-4 mb-6 flex items-start gap-3">
          <Shield className="text-blue-600 mt-0.5 shrink-0" size={16} />
          <div className="text-xs">
            <span className="font-bold text-slate-800 block">Restricted Authorized Portal</span>
            <span className="text-slate-500 font-semibold mt-0.5 block leading-relaxed">
              Access is strictly limited to authorized trust administrators and registered helpers.
            </span>
          </div>
        </div>

        {/* Internal Core form for email authorization */}
        <form onSubmit={handleLocalEmailSubmit} className="w-full space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">
              Permitted Google Email ID
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail size={16} />
              </span>
              <input
                id="login-email-input"
                type="email"
                value={email}
                autoFocus
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorLocal(null);
                }}
                disabled={isVerifyingLocal || verificationSuccess}
                placeholder="helper@gmail.com"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {errorLocal && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-rose-50 border border-rose-100 p-3.5 rounded-2xl text-rose-700 text-xs font-semibold flex items-start gap-2.5 leading-relaxed"
              >
                <AlertTriangle className="stroke-[2.5] mt-0.5 shrink-0 text-rose-500" size={14} />
                <span>{errorLocal}</span>
              </motion.div>
            )}

            {authError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-amber-50 border border-amber-100 p-3.5 rounded-2xl text-amber-800 text-xs font-semibold flex items-start gap-2.5 leading-relaxed"
              >
                <AlertTriangle className="stroke-[2.5] mt-0.5 shrink-0 text-amber-600" size={14} />
                <span>{authError.message}</span>
              </motion.div>
            )}

            {verificationSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl text-emerald-800 text-xs font-black flex items-center gap-2.5"
              >
                <CheckCircle className="text-emerald-500 shrink-0" size={16} />
                <span>Authorized! Redirecting you now...</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            id="login-verify-button"
            type="submit"
            disabled={isVerifyingLocal || verificationSuccess}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-slate-950/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isVerifyingLocal ? (
              <>
                <Loader2 size={14} className="animate-spin text-white" />
                <span>Verifying Access Rights...</span>
              </>
            ) : (
              <>
                <span>Verify & Open App</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Divider lines */}
        <div className="w-full flex items-center justify-between my-6 opacity-40">
          <div className="h-[1px] bg-slate-200 flex-1" />
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3">or</span>
          <div className="h-[1px] bg-slate-200 flex-1" />
        </div>

        {/* Google Sync Sign In Option */}
        <button
          id="login-google-button"
          onClick={handleGoogleLogin}
          type="button"
          disabled={isLoggingIn || verificationSuccess}
          className="w-full py-4 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-2xl text-xs font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-sm disabled:opacity-50 cursor-pointer animate-fade-in"
        >
          {isLoggingIn ? (
            <>
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <span>Connecting Google Cloud...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.5 15 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.9 3C6.4 7.4 9 5.04 12 5.04z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.1-2 3.7-4.9 3.7-8.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.5 14.6c-.2-.7-.4-1.4-.4-2.1s.2-1.4.4-2.1L1.6 7.4C.6 9.3 0 11.6 0 14s.6 4.7 1.6 6.6l3.9-3z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.6-2.4-6.5-5.36l-3.9 3C3.5 20.4 7.4 23 12 23z"
                />
              </svg>
              <span>Connect & Sync with Google</span>
            </>
          )}
        </button>

        {/* Informative Footer Support */}
        <div className="mt-8 text-center max-w-[280px]">
          <p className="text-[10px] font-semibold text-slate-400 leading-relaxed">
            Trouble logging in? Please contact your trust admin to register your Google Account ID on the database directory.
          </p>
        </div>
      </div>
    </div>
  );
};
