import React, { useState } from 'react';
import { 
  Cloud, 
  CloudOff, 
  LogIn, 
  LogOut, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { AppData, PaymentMethod, CustomPaymentMethod } from '@/types';
import { cn } from '@/lib/utils';
import { LogoSettings } from './settings/LogoSettings';
import { BackupSettings } from './settings/BackupSettings';
import { PaymentSettings } from './settings/PaymentSettings';
import { AdminSettings } from './settings/AdminSettings';
import { DangerSettings } from './settings/DangerSettings';
import ConfirmationModal from './ConfirmationModal';

interface AllowedUser {
  email: string;
  addedAt?: string;
  addedBy?: string;
  disabled?: boolean;
}

interface SettingsProps {
  appData: AppData;
  onUpdateLogo: (logo: string) => void;
  onBackup: () => void;
  onRestore: (data: AppData) => void;
  onClearData: () => void;
  onToggleNotifications: (enabled: boolean) => void;
  onUpdatePaymentLabels: (labels: Record<PaymentMethod, string>) => void;
  onUpdatePaymentMethodsList?: (list: CustomPaymentMethod[]) => void;
  user: any; // User | null
  onGoogleLogin: () => void;
  onGoogleLogout: () => void;
  onSyncLocalToCloud: () => Promise<boolean>;
  allowedUsers?: AllowedUser[];
  onAddAllowedUser?: (email: string) => Promise<void>;
  onDeleteAllowedUser?: (email: string) => Promise<void>;
  onToggleAllowedUserDisabled?: (email: string, disabled: boolean) => Promise<void>;
}

const Settings: React.FC<SettingsProps> = ({ 
  appData, 
  onUpdateLogo, 
  onBackup, 
  onRestore, 
  onClearData,
  onToggleNotifications,
  onUpdatePaymentLabels,
  onUpdatePaymentMethodsList,
  user,
  onGoogleLogin,
  onGoogleLogout,
  onSyncLocalToCloud,
  allowedUsers = [],
  onAddAllowedUser,
  onDeleteAllowedUser,
  onToggleAllowedUserDisabled
}) => {
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [userToRevoke, setUserToRevoke] = useState<string | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSyncCloud = async () => {
    setSyncingCloud(true);
    try {
      const success = await onSyncLocalToCloud();
      if (success) {
        showNotification('success', 'Local data fully synced to Cloud Storage!');
      } else {
        showNotification('error', 'Synchronization failed. Check internet.');
      }
    } catch (err) {
      showNotification('error', 'Sync encountered an error.');
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleRevokeConfirm = async () => {
    if (userToRevoke && onDeleteAllowedUser) {
      try {
        await onDeleteAllowedUser(userToRevoke);
        showNotification('success', `Revoked access for ${userToRevoke}.`);
      } catch (err) {
        showNotification('error', 'Failed to revoke user.');
      }
    }
    setUserToRevoke(null);
  };

  const isPrimaryAdmin = user && user.email?.toLowerCase() === 'ignitina2@gmail.com';

  return (
    <div id="settings-management-container" className="max-w-4xl mx-auto space-y-8 p-4 font-sans pb-16">
      
      {/* Toast Notification */}
      {notification && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-xs font-bold animate-in fade-in slide-in-from-bottom-2",
          notification.type === 'success' 
            ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
            : "bg-rose-50 text-rose-800 border-rose-100"
        )}>
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Cloud Status / Sync Center Card */}
      <div id="settings-card-cloud" className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 text-left">
          <div className="flex items-center gap-2.5">
            {user ? (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Cloud Server Linked
              </span>
            ) : (
              <span className="text-[10px] bg-slate-700/50 text-slate-300 border border-slate-600/30 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1">
                Offline Mode (Local Storage Only)
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {user ? 'Cloud Sync & Storage Center' : 'Go Cloud and Secure Data'}
          </h2>
          <p className="text-slate-300 text-xs font-semibold max-w-xl leading-relaxed">
            {user 
              ? `Connected, logged in as ${user.displayName || user.email}. All local sales and catalogs are backed up to Google Firestore secure server cloud storage.`
              : 'Link your Google account to secure transaction logs across multiple admins with automatic cloud backups in real time.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center shrink-0">
          {user ? (
            <>
              <button
                onClick={handleSyncCloud}
                disabled={syncingCloud}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-500/10 disabled:opacity-50"
              >
                <Cloud size={15} className={cn(syncingCloud && "animate-bounce")} />
                {syncingCloud ? 'Syncing...' : 'Force Cloud Sync'}
              </button>
              <button
                onClick={onGoogleLogout}
                className="bg-transparent hover:bg-white/10 text-white border border-white/20 text-xs font-extrabold px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut size={15} />
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={onGoogleLogin}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-600/20"
            >
              <LogIn size={15} />
              Connect Google Cloud
            </button>
          )}
        </div>
      </div>

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* App Logo Settings */}
        <LogoSettings appData={appData} onUpdateLogo={onUpdateLogo} user={user} />

        {/* Data Management (Backup, Restore, Notification Toggle) */}
        <BackupSettings 
          appData={appData} 
          onBackup={onBackup} 
          onRestore={onRestore} 
          onToggleNotifications={onToggleNotifications}
          showNotification={showNotification}
        />

        {/* Custom Payment Methods */}
        <PaymentSettings 
          appData={appData} 
          onUpdatePaymentLabels={onUpdatePaymentLabels} 
          onUpdatePaymentMethodsList={onUpdatePaymentMethodsList} 
        />

        {/* Danger Zone */}
        <DangerSettings onClearAll={onClearData} onBackup={onBackup} showNotification={showNotification} />

        {/* Allowed Users Center (Authorized Emails) */}
        {isPrimaryAdmin && (
          <AdminSettings 
            user={user}
            allowedUsers={allowedUsers}
            onAddAllowedUser={onAddAllowedUser}
            onToggleAllowedUserDisabled={onToggleAllowedUserDisabled}
            setUserToRevoke={setUserToRevoke}
            showNotification={showNotification}
          />
        )}
      </div>

      {/* Confirmation Modal for Revoking Users */}
      {userToRevoke && (
        <ConfirmationModal
          isOpen={!!userToRevoke}
          onClose={() => setUserToRevoke(null)}
          onConfirm={handleRevokeConfirm}
          title="Revoke Admin Access"
          message={`Are you sure you want to revoke server database sync permissions for ${userToRevoke}? They will be immediately blocked from logging in.`}
        />
      )}
    </div>
  );
};

export default Settings;
