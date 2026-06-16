import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrustLogo } from './TrustLogo';
import { useActiveResponsiveLogo } from '@/lib/logo-resolver';

interface SplashComponentProps {
  onComplete: () => void;
  appData: any;
}

export const SplashComponent: React.FC<SplashComponentProps> = ({ onComplete, appData }) => {
  const [progress, setProgress] = useState(0);
  const { resolvedLogo } = useActiveResponsiveLogo(appData);

  useEffect(() => {
    // Fill progress bar over 2.5s
    const start = Date.now();
    const duration = 2400;
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const percentage = Math.min((elapsed / duration) * 100, 100);
      setProgress(percentage);
      if (elapsed >= duration) {
        clearInterval(timer);
        onComplete();
      }
    }, 30);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div 
      id="splash-screen-container" 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-slate-950 overflow-hidden font-sans select-none"
    >
      {/* Background Animated Bokeh Lights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{
            x: [0, 80, -40, 0],
            y: [0, -90, 60, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl"
        />
        <motion.div 
          animate={{
            x: [0, -60, 90, 0],
            y: [0, 80, -50, 0],
            scale: [1, 0.9, 1.2, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-rose-600/10 blur-3xl"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(2,6,23,0.95))]"></div>
      </div>

      {/* Floating Animated Flash Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30, rotateY: -15 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateY: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -40, transition: { duration: 0.4 } }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        onClick={onComplete}
        className="w-full max-w-sm relative bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-950/40 text-center flex flex-col items-center justify-between cursor-pointer group overflow-hidden"
        style={{ transformPerspective: 1000 }}
      >
        {/* Card Metallic Sweep Reflection Effect */}
        <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shinesweep_1.5s_ease-in-out_infinite] pointer-events-none" />

        <div className="space-y-6 w-full flex flex-col items-center">
          {/* Top Ticket Punch Hole representation for Coupon luxury theme */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-6 bg-slate-950 rounded-b-full border-b border-slate-800/50" />
          
          {/* Logo container with custom ring pulse */}
          <div className="relative mt-2 p-1.5 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700/50 shadow-inner">
            {/* Animated Logo backing ring */}
            <motion.div 
              animate={{ scale: [1, 1.08, 1], rotate: 360 }}
              transition={{
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 40, repeat: Infinity, ease: "linear" }
              }}
              className="absolute -inset-1 rounded-full bg-gradient-to-tr from-blue-500/30 to-amber-500/20 opacity-60 blur-sm"
            />
            
            {/* Render Logo */}
            <motion.div
              initial={{ rotate: -180, scale: 0.4 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 80, damping: 12 }}
              className="relative w-36 h-36 flex items-center justify-center bg-white rounded-full overflow-hidden shadow-xl"
            >
              {resolvedLogo ? (
                <img src={resolvedLogo} alt="St. Casimir" className="w-32 h-32 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <TrustLogo size={144} className="w-full h-full p-1" />
              )}
            </motion.div>
          </div>

          {/* Letterpress Titles */}
          <div className="space-y-2">
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg font-black text-white tracking-wider leading-relaxed underline decoration-amber-600/50 decoration-2 underline-offset-4"
            >
              ST. CASIMIR CHARITABLE TRUST
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-[10px] font-black text-amber-500 tracking-[0.2em] uppercase"
            >
              SCC LUCKY COUPON SALE 2026
            </motion.p>
          </div>
        </div>

        {/* Decorative Golden Barcode lines representing coupons */}
        <div className="my-8 w-full border-t border-dashed border-slate-700/80 relative flex justify-center py-2 opacity-60">
          <div className="absolute -left-8 -top-3 w-6 h-6 bg-slate-950 rounded-r-full border-r border-slate-800" />
          <div className="absolute -right-8 -top-3 w-6 h-6 bg-slate-950 rounded-l-full border-l border-slate-800" />
          <div className="flex gap-1.5 items-center justify-center opacity-30">
            <div className="w-[1.5px] h-6 bg-white" />
            <div className="w-[3px] h-6 bg-white" />
            <div className="w-[1px] h-6 bg-white" />
            <div className="w-[4px] h-6 bg-white" />
            <div className="w-[1.5px] h-6 bg-white" />
            <div className="w-[2px] h-6 bg-white" />
            <div className="w-[5px] h-6 bg-white" />
            <div className="w-[1.5px] h-6 bg-white" />
          </div>
        </div>

        {/* Loading Progress Bar & percentage */}
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold tracking-widest uppercase">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Initializing System
            </span>
            <span className="font-mono text-blue-400 font-semibold">{Math.round(progress)}%</span>
          </div>

          <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden p-[1px] border border-slate-700/30">
            <motion.div 
              className="h-full bg-gradient-to-r from-blue-500 via-amber-400 to-rose-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)]"
              style={{ width: `${progress}%` }}
              layoutId="splash-progress-bar"
            />
          </div>

          <div className="text-[9px] text-slate-500 font-semibold tracking-wider italic">
            Tap anywhere to enter portal instantly
          </div>
        </div>
      </motion.div>
    </div>
  );
};
