import React, { useRef } from 'react';
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
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
          <Database size={20} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Data Management</h3>
      </div>

      <div className="space-y-4">
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
    </div>
  );
};
