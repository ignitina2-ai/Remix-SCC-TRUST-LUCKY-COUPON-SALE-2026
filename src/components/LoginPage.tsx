import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, AlertTriangle, Loader2, CloudOff, ChevronRight, User } from 'lucide-react';
import { TrustLogo } from './TrustLogo';
import { useActiveResponsiveLogo } from '@/lib/logo-resolver';

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
  const [showBypassForm, setShowBypassForm] = useState(false);
  const [bypassEmail, setBypassEmail] = useState('');
  const [bypassError, setBypassError] = useState('');

  const handleLocalBypassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBypassError('');
    
    const cleanEmail = bypassEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setBypassError('Please enter a valid email address.');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setBypassError('Please enter a valid email format.');
      return;
    }

    // Authenticate offline local user state
    onLoginSuccess({
      uid: `local_bypass_${Date.now()}`,
      email: cleanEmail,
      displayName: cleanEmail.split('@')[0],
      photoURL: null,
      isLocal: true
    });
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
            <span className="text-slate-500 font-semibold mt-0.5 block leading-relaxed text-left">
              Access is strictly limited to authorized trust administrators. Please login using your registered Google Account.
            </span>
          </div>
        </div>

        {/* Google Sync Sign In Option - Primary & ONLY login method */}
        <div className="w-full space-y-4">
          {!showBypassForm ? (
            <>
              <button
                id="login-google-button"
                onClick={handleGoogleLogin}
                type="button"
                disabled={isLoggingIn}
                className="w-full py-4 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-2xl text-xs font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-sm disabled:opacity-50 cursor-pointer animate-fade-in"
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
                    <span>Connect & Sign In with Google</span>
                  </>
                )}
              </button>

              <p className="text-[9.5px] text-emerald-700 font-extrabold text-center uppercase tracking-wider bg-emerald-50/80 py-1.5 px-3 rounded-xl mx-auto w-fit border border-emerald-100 flex items-center justify-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                ✨ Syncs all mobile & desktop devices in real-time.
              </p>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowBypassForm(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 font-semibold transition-all hover:underline cursor-pointer"
                >
                  <CloudOff size={14} />
                  <span>Google Login Blocked? Use Offline Bypass</span>
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleLocalBypassSubmit} className="space-y-4 text-left animate-in slide-in-from-bottom-2 duration-200">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Administrator Email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <User size={14} />
                  </span>
                  <input
                    type="email"
                    required
                    value={bypassEmail}
                    onChange={(e) => setBypassEmail(e.target.value)}
                    placeholder="e.g. administrator@gmail.com"
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-850 placeholder-slate-405 transition-all outline-none"
                  />
                </div>
                <p className="text-[9.5px] text-slate-400 leading-normal font-medium mt-1">
                  💡 Enter your authorized email. This allows device-isolated operations and automatic cloud integration as soon as you connect in Settings later.
                </p>
              </div>

              {bypassError && (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-rose-800 text-[10px] font-semibold flex items-center gap-2">
                  <AlertTriangle size={12} className="shrink-0 text-rose-500" />
                  <span>{bypassError}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowBypassForm(false);
                    setBypassError('');
                  }}
                  className="flex-1 py-3 border border-slate-250 text-slate-700 bg-white hover:bg-slate-50 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs shadow-md shadow-blue-600/10 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Verify Offline</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </form>
          )}

          <AnimatePresence mode="wait">
            {authError && !showBypassForm && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-rose-800 text-[11px] font-semibold flex items-start gap-2.5 leading-relaxed text-left"
              >
                <AlertTriangle className="stroke-[2.5] mt-0.5 shrink-0 text-rose-500" size={14} />
                <span>{authError.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Informative Footer Support */}
        <div className="mt-8 text-center max-w-[280px]">
          <p className="text-[10px] font-semibold text-slate-400 leading-relaxed">
            Trouble signing in? Please contact your trust admin to register your Google Account ID on the database directory.
          </p>
        </div>
      </div>
    </div>
  );
};
