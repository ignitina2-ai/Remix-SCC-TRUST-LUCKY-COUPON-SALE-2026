import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DangerSettingsProps {
  onClearAll: () => void | Promise<void>;
  onBackup?: () => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const DangerSettings: React.FC<DangerSettingsProps> = ({ onClearAll, onBackup, showNotification }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [downloadBackup, setDownloadBackup] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClearAllConfirm = async () => {
    if (confirmInput.trim().toUpperCase() !== 'RESET') {
      showNotification('error', 'Confirmation keyword does not match.');
      return;
    }
    
    if (downloadBackup && onBackup) {
      try {
        onBackup();
      } catch (err) {
        console.error('Pre-reset backup failed:', err);
      }
    }

    try {
      await onClearAll();
      showNotification('success', downloadBackup && onBackup ? 'Backup downloaded & databases fully reset!' : 'All databases fully reset!');
    } catch (err) {
      console.error('Reset failed:', err);
      showNotification('error', 'Failed to fully reset databases.');
    }
    setShowConfirm(false);
    setConfirmInput('');
  };

  return (
    <div id="settings-card-danger" className="bg-white p-8 rounded-3xl border border-rose-100 shadow-sm space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-left">
          <div className="bg-rose-50 p-2 rounded-lg text-rose-600 animate-pulse">
            <ShieldAlert size={20} />
          </div>
          <div className="font-sans">
            <h3 className="text-sm font-black text-rose-700 tracking-tight uppercase leading-tight">Danger Zone</h3>
            <p className="text-[10px] text-rose-450 font-bold uppercase tracking-wider mt-0.5">Sensitive maintenance & database wipes</p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest hidden sm:inline">
            {isExpanded ? "Setup open" : "Setup hidden"}
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer shadow-inner",
              isExpanded ? "bg-rose-600" : "bg-slate-300"
            )}
            title={isExpanded ? "Collapse Danger Zone" : "Expand Danger Zone"}
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
        <div className="p-4 bg-rose-50/20 hover:bg-rose-50/50 border border-rose-100/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors animate-in fade-in duration-300 text-left font-sans">
          <div className="space-y-1.5 w-full sm:w-auto">
            <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider">Destructive Actions Container</h4>
            <div className="font-mono text-[9px] text-rose-600 font-bold">
              <span className="inline-flex items-center gap-1.5 border px-2 py-0.5 rounded-lg bg-rose-50 border-rose-100/50">
                Warning: Resets are permanent
              </span>
            </div>
          </div>
          <span className="self-end sm:self-center text-[9px] text-rose-600 font-black uppercase tracking-wider bg-rose-100/40 border border-rose-100/20 px-3 py-1.5 rounded-xl">
            Locked
          </span>
        </div>
      ) : (
        /* Expanded state content */
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-slate-500 text-xs font-semibold leading-relaxed text-left">
            Resetting the codebase data state is permanent. This wipes all offline transactions, sponsors, handovers, is non-recoverable without JSON backups, and local parameters instantly.
          </p>

          {showConfirm ? (
            <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl space-y-4 text-left/16">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                <div className="text-left">
                  <h4 className="text-rose-900 font-bold text-sm">Are you absolutely sure?</h4>
                  <p className="text-rose-700 text-xs font-medium mt-1">This will permanently clear all your offline local and custom parameters.</p>
                </div>
              </div>
              
              <div className="border-t border-rose-100 pt-3 space-y-2">
                <label id="backup-checkbox-label" className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={downloadBackup}
                    onChange={(e) => setDownloadBackup(e.target.checked)}
                    className="rounded border-rose-200 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-rose-800">
                    Auto-download JSON backup before resetting (Recommended)
                  </span>
                </label>
                {onBackup && (
                  <button
                    type="button"
                    onClick={onBackup}
                    className="text-[10px] font-black text-rose-700 hover:text-rose-800 underline block cursor-pointer text-left pl-6.5"
                  >
                    Download JSON Backup First
                  </button>
                )}
              </div>

              <div className="space-y-2 text-left">
                <label className="block text-[10px] font-bold text-rose-900 uppercase tracking-wider">
                  Type RESET to confirm deletion
                </label>
                <input 
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="RESET"
                  className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-xs font-extrabold text-rose-900 placeholder:text-rose-300"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={handleClearAllConfirm}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-rose-200 animate-pulse"
                >
                  Confirm Resets
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    setConfirmInput('');
                  }}
                  className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-extrabold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:border-rose-200 text-rose-700 font-bold p-4 rounded-2xl transition-all cursor-pointer flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-3">
                <Trash2 size={18} className="group-hover:scale-110 transition-transform text-rose-600" />
                <div>
                  <p className="font-extrabold text-sm">Reset Offline Databases</p>
                  <p className="text-rose-500 text-[10px] font-bold mt-0.5">Flush local transactions, offline catalogs and parameters</p>
                </div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
