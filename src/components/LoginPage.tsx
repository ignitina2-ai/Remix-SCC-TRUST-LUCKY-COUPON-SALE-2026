import React, { useState } from 'react';
import { LogIn, AlertCircle, ShieldAlert, CheckCircle, Smartphone } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface LoginPageProps {
  onLoginSuccess: () => void;
  isLoggingIn: boolean;
  setIsLoggingIn: (val: boolean) => void;
  loginError: string | null;
  setLoginError: (err: string | null) => void;
}

export default function LoginPage({
  onLoginSuccess,
  isLoggingIn,
  setIsLoggingIn,
  loginError,
  setLoginError,
}: LoginPageProps) {
  const [attemptedEmail, setAttemptedEmail] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    setAttemptedEmail(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error("Login failure:", err);
      // Handle the case where user cancels the popup gracefully
      if (err.code === 'auth/popup-closed-by-user') {
        setLoginError("Login popup was closed. Please try again.");
      } else {
        setLoginError(err.message || "An unexpected error occurred during Google Sign-In.");
      }
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl -z-10"></div>

      <div className="w-full max-w-md bg-slate-950/40 backdrop-blur-md border border-slate-800 p-8 rounded-[2rem] shadow-2xl text-center space-y-8 relative">
        {/* Decorative Badge */}
        <div className="inline-flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 px-3 py-1 rounded-full text-[10px] font-black uppercase text-blue-400 tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          2026 TRUST REGISTRY
        </div>

        {/* Title */}
        <div className="space-y-2">
          {/* Mock Logo Icon if appData.logo is unavailable */}
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-blue-500/20">
            SC
          </div>
          <h2 className="text-xl font-black text-slate-100 tracking-tight uppercase">
            ST. CASIMIR CHARITABLE TRUST
          </h2>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest leading-relaxed">
            Lucky Coupon Sale 2026
          </p>
        </div>

        <div className="h-[1px] bg-gradient-to-r from-transparent via-slate-800 to-transparent"></div>

        <div className="space-y-4">
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            This is a secure, private cloud portal for St. Casimir Parish trust administrators and authorized coupon-selling secretaries. Connect your Google account to synchronize local sales entries.
          </p>
        </div>

        {/* Main interactive login block */}
        <div className="space-y-4">
          {loginError && (
            <div className="bg-rose-950/40 border border-rose-900/50 p-4 rounded-2xl text-left flex items-start gap-3">
              <ShieldAlert className="text-rose-400 shrink-0 mt-0.5" size={16} />
              <div className="space-y-1">
                <p className="text-xs font-black text-rose-300">Access Restricted</p>
                <p className="text-[10px] text-rose-400 leading-relaxed font-semibold">
                  {loginError}. If you are a newly appointed trust helper, please contact the primary administrator (<span className="underline font-bold text-slate-200">ignitina2@gmail.com</span>) to list your email.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full relative flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl text-xs font-bold tracking-wide shadow-lg shadow-blue-600/15 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoggingIn ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Authorising Account...</span>
              </>
            ) : (
              <>
                <LogIn size={16} className="text-blue-200" />
                <span>SIGN IN WITH GOOGLE</span>
              </>
            )}
          </button>
        </div>

        {/* Informative Footer */}
        <div className="pt-4 text-center">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            St. Casimir Charitable Trust Registry v1.0
          </p>
          <p className="text-[9px] text-slate-600 font-bold mt-1">
            Registered Head Office: Goa, India • Secure Firestore Connection Enabled
          </p>
        </div>
      </div>
    </div>
  );
}
