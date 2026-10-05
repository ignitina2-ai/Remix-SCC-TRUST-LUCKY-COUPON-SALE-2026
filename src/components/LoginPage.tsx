import React, { useState } from 'react';
import { LogIn, AlertCircle, ShieldAlert, CheckCircle, Smartphone, ExternalLink, Copy, Check } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
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
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error("Login failure:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        // user closed popup intentionally
      } else if (err.code === 'auth/popup-blocked') {
        setLoginError("Popup was blocked by your browser. Please allow popups for this site and click Sign In again.");
      } else if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        setLoginError("Firebase: Error (auth/unauthorized-domain): This domain is not authorized in Firebase Console.");
      } else if (
        err.code === 'auth/access_denied' || 
        (err.message && (
          err.message.includes('access_denied') || 
          err.message.includes('verification process') || 
          err.message.includes('developer-approved testers')
        ))
      ) {
        setLoginError("Google Error 403 (access_denied): The app is in Testing mode. Only approved Test Users can log in. Please add stcasimircharitabletrust@gmail.com to Test Users in Google Cloud Console, or sign in using ignitina2@gmail.com.");
      } else {
        setLoginError(err.message || "An unexpected error occurred during Google Sign-In.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const rawHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentHostname = rawHostname.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const isVercel = currentHostname.includes('vercel.app') || currentHostname === 'scc-trust-lucky-coupon-sale-2026.vercel.app';
  const vercelDomainClean = "scc-trust-lucky-coupon-sale-2026.vercel.app";
  const vercelOrigin = `https://${currentHostname || vercelDomainClean}`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => {
      setCopiedText(null);
    }, 2000);
  };

  const isUnauthorizedDomain = loginError && (
    loginError.includes('auth/unauthorized-domain') || 
    loginError.includes('unauthorized-domain')
  );

  const isTestUserError = loginError && (
    loginError.includes('access_denied') ||
    loginError.includes('verification process') ||
    loginError.includes('developer-approved testers') ||
    loginError.includes('Testing mode')
  );

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl -z-10"></div>

      <div className="w-full max-w-lg bg-slate-950/60 backdrop-blur-md border border-slate-800 p-6 md:p-8 rounded-[2rem] shadow-2xl text-center space-y-6 relative">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 px-3 py-1 rounded-full text-[10px] font-black uppercase text-blue-400 tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          2026 TRUST COUPON SALE REGISTRY
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <div className="mx-auto w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-blue-500/20">
            SC
          </div>
          <h2 className="text-xl font-black text-slate-100 tracking-tight uppercase">
            ST. CASIMIR CHARITABLE TRUST
          </h2>
          <p className="text-xs font-bold text-blue-500 uppercase tracking-widest leading-relaxed">
            Lucky Coupon Sale 2026
          </p>
        </div>

        <div className="h-[1px] bg-gradient-to-r from-transparent via-slate-800 to-transparent"></div>

        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
          Official cloud sales ledger for St. Casimir Parish trust administrators and authorized coupon distribution secretaries.
        </p>

        {/* Action Button */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full relative flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl text-xs font-bold tracking-wide shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoggingIn ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <LogIn size={16} className="text-blue-200" />
                <span>SIGN IN WITH GOOGLE</span>
              </>
            )}
          </button>

          {loginError && (
            <div className="bg-rose-950/40 border border-rose-900/50 p-4 rounded-2xl text-left flex items-start gap-3">
              <ShieldAlert className="text-rose-400 shrink-0 mt-0.5" size={16} />
              <div className="space-y-1">
                <p className="text-xs font-black text-rose-300">Sign-in Notice</p>
                <p className="text-[10px] text-rose-400 leading-relaxed font-semibold">
                  {loginError}
                </p>
              </div>
            </div>
          )}

          {/* Vercel & Firebase Console Hostname Guide Card */}
          {(isUnauthorizedDomain || isVercel) && (
            <div className="bg-amber-950/40 border border-amber-500/50 p-4 rounded-2xl text-left space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-amber-300 uppercase tracking-wide">
                    Vercel Hostname Setup Guide (Firebase Console)
                  </p>
                  <p className="text-[10px] text-amber-200/90 leading-relaxed">
                    Firebase Console-ൽ ഹോസ്റ്റ്നെയിം ചേർക്കുമ്പോൾ <strong className="text-white underline">https:// അല്ലെങ്കിൽ അവസാനം / ഇടരുത്</strong>. താഴെ കൊടുത്തിരിക്കുന്ന രീതിയിൽ കൃത്യമായി നൽകുക:
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl space-y-3 border border-slate-800 text-[10px]">
                {/* Step 1: Firebase Console Authorized Domain */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">1. Firebase Authorized Domains:</span>
                    <a 
                      href="https://console.firebase.google.com/u/0/project/gen-lang-client-0728385363/authentication/settings" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 text-[9px]"
                    >
                      <span>Open Firebase Console</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  <p className="text-slate-400 text-[9.5px]">
                    Authentication &gt; Settings &gt; Authorized domains &gt; Add Domain:
                  </p>
                  <div className="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-700">
                    <code className="text-emerald-400 font-mono text-[10px] select-all">
                      {currentHostname || vercelDomainClean}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentHostname || vercelDomainClean)}
                      className="ml-2 text-[9px] bg-slate-800 hover:bg-slate-700 text-blue-300 px-2 py-1 rounded font-bold uppercase transition-all flex items-center gap-1"
                    >
                      {copiedText === (currentHostname || vercelDomainClean) ? (
                        <>
                          <Check size={10} className="text-emerald-400" />
                          <span>COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy size={10} />
                          <span>COPY</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-rose-300/80 text-[9px] font-semibold">
                    ⚠️ പ്രധാനം: 'https://' കൂടാതെ 'scc-trust-lucky-coupon-sale-2026.vercel.app' എന്ന് മാത്രം പേസ്റ്റ് ചെയ്യുക.
                  </p>
                </div>

                {/* Step 2: Google Cloud Console OAuth Web Client */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">2. Google Cloud OAuth Web Client (JS Origin):</span>
                    <a 
                      href="https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0728385363" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 text-[9px]"
                    >
                      <span>Open GCP Credentials</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  <p className="text-slate-400 text-[9.5px]">
                    OAuth 2.0 Web Client &gt; Authorized JavaScript origins:
                  </p>
                  <div className="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-700">
                    <code className="text-emerald-400 font-mono text-[10px] select-all">
                      {vercelOrigin}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(vercelOrigin)}
                      className="ml-2 text-[9px] bg-slate-800 hover:bg-slate-700 text-blue-300 px-2 py-1 rounded font-bold uppercase transition-all flex items-center gap-1"
                    >
                      {copiedText === vercelOrigin ? (
                        <>
                          <Check size={10} className="text-emerald-400" />
                          <span>COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy size={10} />
                          <span>COPY</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test user error resolution */}
          {isTestUserError && (
            <div className="bg-amber-950/50 border border-amber-600/60 p-4 rounded-2xl text-left space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-xs font-black text-amber-300 uppercase">Google Error 403: Add to Test Users</p>
                  <p className="text-[10px] text-amber-200/90 leading-relaxed mt-0.5">
                    ആപ്പ് Google Cloud-ൽ Testing മോഡിലാണ്. ഇതിൽ ലോഗിൻ ചെയ്യാൻ <strong className="text-white">stcasimircharitabletrust@gmail.com</strong> ടെസ്റ്റ് യൂസറായി ആഡ് ചെയ്യുക:
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-2 text-[10px] text-slate-300">
                <a 
                  href="https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0728385363" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-center transition-all cursor-pointer shadow-sm text-xs"
                >
                  🔗 Open Google Cloud OAuth Consent Screen
                </a>
                <p className="text-[9.5px] text-slate-400">
                  താഴെയുള്ള <strong>Test users</strong> &gt; <strong>+ ADD USERS</strong> ക്ലിക്ക് ചെയ്ത് <code className="bg-slate-800 px-1 py-0.5 rounded text-emerald-400 font-mono">stcasimircharitabletrust@gmail.com</code> നൽകി SAVE ചെയ്യുക. അല്ലെങ്കിൽ നേരിട്ട് <strong className="text-white">ignitina2@gmail.com</strong> വെച്ച് ലോഗിൻ ചെയ്യാം.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 text-center border-t border-slate-800/80">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            St. Casimir Charitable Trust Registry v1.0
          </p>
          <p className="text-[9px] text-slate-600 font-bold mt-0.5">
            Design &amp; Developed By Ignatious Joshuva • 24/7 Webhook Synced
          </p>
        </div>
      </div>
    </div>
  );
}
