import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Trash2 } from 'lucide-react';

interface DangerSettingsProps {
  onClearAll: () => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const DangerSettings: React.FC<DangerSettingsProps> = ({ onClearAll, showNotification }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  const handleClearAllConfirm = () => {
    if (confirmInput.trim().toUpperCase() !== 'RESET') {
      showNotification('error', 'Confirmation keyword does not match.');
      return;
    }
    
    onClearAll();
    setShowConfirm(false);
    setConfirmInput('');
    showNotification('success', 'All local state databases fully reset!');
  };

  return (
    <div id="settings-card-danger" className="bg-white p-8 rounded-3xl border border-rose-50 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-rose-50 p-2 rounded-lg text-rose-600 animate-pulse">
          <ShieldAlert size={20} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Danger Zone</h3>
      </div>
      <p className="text-slate-500 text-xs font-semibold leading-relaxed text-left">
        Resetting the codebase data state is permanent. This wipes all offline transactions, sponsors, handovers, is non-recoverable without JSON backups, and local parameters instantly.
      </p>

      {showConfirm ? (
        <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl space-y-4 text-left">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-rose-900 font-bold text-sm">Are you absolutely sure?</h4>
              <p className="text-rose-700 text-xs font-medium mt-1">This will permanently clear all your offline local and custom parameters unless backed up.</p>
            </div>
          </div>
          
          <div className="space-y-2">
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
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-rose-200"
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
            <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
            <div>
              <p className="font-extrabold text-sm">Reset Offline Databases</p>
              <p className="text-rose-500 text-[10px] font-bold mt-0.5">Flush local transactions, offline catalogs and parameters</p>
            </div>
          </div>
        </button>
      )}
    </div>
  );
};
