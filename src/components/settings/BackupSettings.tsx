import React, { useRef, useState } from 'react';
import { Database, Download, RefreshCw, Upload, Bell, BellOff } from 'lucide-react';
import { AppData } from '@/types';
import { cn } from '@/lib/utils';
import { requestNotificationPermission } from '@/lib/notifications';

interface BackupSettingsProps {
  appData: AppData;
  onBackup: () => void;
  onRestore: (data: AppData) => void;
  onToggleNotifications: (enabled: boolean) => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const BackupSettings: React.FC<BackupSettingsProps> = ({
  appData,
  onBackup,
  onRestore,
  onToggleNotifications,
  showNotification,
}) => {
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.transactions && data.sponsors) {
            onRestore(data);
            showNotification('success', 'Data restored successfully!');
          } else {
            showNotification('error', 'Invalid backup file format.');
          }
        } catch (err) {
          showNotification('error', 'Error parsing backup file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleToggleNotifications = async () => {
    if (!appData.notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        onToggleNotifications(true);
        showNotification('success', 'Notifications enabled!');
      } else {
        showNotification('error', 'Notification permission denied. Please enable it in your browser settings.');
      }
    } else {
      onToggleNotifications(false);
    }
  };

  return (
    <div id="settings-card-backup" className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-left">
          <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
            <Database size={20} />
          </div>
          <div className="font-sans">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase leading-tight">Data Backups & Local Maintenance</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Secure local backups & push alerts</p>
          </div>
        </div>

        {/* Toggle switch */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">
            {isExpanded ? "Setup open" : "Setup hidden"}
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer shadow-inner",
              isExpanded ? "bg-emerald-600" : "bg-slate-300"
            )}
            title={isExpanded ? "Collapse Data Settings" : "Expand Data Settings"}
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
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Local Archives & Notifications</h4>
            <div className="font-mono text-[9px] text-slate-500 font-bold flex flex-wrap gap-1.5">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border",
                appData.notificationsEnabled 
                  ? "bg-amber-50 text-amber-700 border-amber-100/50" 
                  : "bg-slate-100 text-slate-600 border-slate-200/40"
              )}>
                Alerts: {appData.notificationsEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
          <span className="self-end sm:self-center text-[9px] text-slate-500 font-black uppercase tracking-wider bg-slate-200/50 border border-slate-200/20 px-3 py-1.5 rounded-xl">
            Backup System Synced
          </span>
        </div>
      ) : (
        /* Expanded setup */
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <button 
            onClick={onBackup}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all group cursor-pointer text-left"
          >
            <div className="flex items-center gap-4">
              <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                <Download size={20} />
              </div>
              <div>
                <p className="text-slate-900 font-bold text-sm">Backup Data</p>
                <p className="text-slate-500 text-xs font-medium">Download all records as JSON</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => restoreInputRef.current?.click()}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all group cursor-pointer text-left"
          >
            <div className="flex items-center gap-4">
              <div className="bg-white p-2 rounded-lg shadow-sm text-emerald-600 group-hover:scale-110 transition-transform">
                <RefreshCw size={20} />
              </div>
              <div>
                <p className="text-slate-900 font-bold text-sm">Restore Data</p>
                <p className="text-slate-500 text-xs font-medium">Upload a previous backup file</p>
              </div>
            </div>
          </button>
          <input 
            type="file" 
            ref={restoreInputRef} 
            onChange={handleRestore} 
            accept=".json" 
            className="hidden" 
          />

          <button 
            onClick={handleToggleNotifications}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all group cursor-pointer text-left"
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-2 rounded-lg shadow-sm transition-transform group-hover:scale-110",
                appData.notificationsEnabled ? "bg-amber-50 text-amber-600" : "bg-slate-200 text-slate-400"
              )}>
                {appData.notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
              </div>
              <div>
                <p className="text-slate-900 font-bold text-sm">Push Notifications</p>
                <p className="text-slate-500 text-xs font-medium">
                  {appData.notificationsEnabled ? 'Enabled for alerts' : 'Disabled'}
                </p>
              </div>
            </div>
            <div className={cn(
              "w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0",
              appData.notificationsEnabled ? "bg-amber-500" : "bg-slate-300"
            )}>
              <div className={cn(
                "w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out",
                appData.notificationsEnabled ? "translate-x-6" : "translate-x-0"
              )} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
