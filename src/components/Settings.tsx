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
  onUpdateLogoMobile?: (logo: string) => void;
  onUpdateLogoDesktop?: (logo: string) => void;
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
  activeSessions?: any[];
}

const Settings: React.FC<SettingsProps> = ({ 
  appData, 
  onUpdateLogo, 
  onUpdateLogoMobile,
  onUpdateLogoDesktop,
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
  onToggleAllowedUserDisabled,
  activeSessions = []
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
              user.isLocal ? (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Local Session Only (Not Synced)
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Cloud Server Linked
                </span>
              )
            ) : (
              <span className="text-[10px] bg-slate-700/50 text-slate-300 border border-slate-600/30 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1">
                Offline Mode (Local Storage Only)
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {user 
              ? (user.isLocal ? 'Device-Isolated Local Mode' : 'Cloud Sync & Storage Center')
              : 'Go Cloud and Secure Data'}
          </h2>
          <p className="text-slate-300 text-xs font-semibold max-w-xl leading-relaxed">
            {user 
              ? (user.isLocal 
                  ? `Logged in as "${user.displayName || user.email}" (Local Bypass). Data is stored locally on this physical browser and DOES NOT sync to other devices. Disconnect and log in with Google to sync in real time across mobile & desktop.`
                  : `Connected, logged in as ${user.displayName || user.email}. All transactions, catalogs, and helper entries are backed up to Google Firestore secure cloud storage and synchronized in real-time.`)
              : 'Link your Google account to secure transaction logs across multiple admins with automatic cloud backups in real time.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center shrink-0">
          {user ? (
            <>
              {(!user.isLocal) ? (
                <button
                  onClick={handleSyncCloud}
                  disabled={syncingCloud}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-500/10 disabled:opacity-50"
                >
                  <Cloud size={15} className={cn(syncingCloud && "animate-bounce")} />
                  {syncingCloud ? 'Syncing...' : 'Force Cloud Sync'}
                </button>
              ) : (
                <button
                  onClick={onGoogleLogin}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  <LogIn size={15} />
                  Connect Google Cloud
                </button>
              )}
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
        <LogoSettings 
          appData={appData} 
          onUpdateLogo={onUpdateLogo} 
          onUpdateLogoMobile={onUpdateLogoMobile}
          onUpdateLogoDesktop={onUpdateLogoDesktop}
          user={user} 
        />

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

        {/* Active Logged-in Users & History */}
        <div id="settings-card-sessions" className="md:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-slate-900">Active Login Sessions</h3>
              <p className="text-slate-500 text-xs font-semibold">Real-time listing of administrators and helpers connected to this trust registry</p>
            </div>
          </div>

          <div className="border border-slate-100 rounded-2xl bg-slate-50/50 overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {activeSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold">
                No active session logs saved in Cloud database.
              </div>
            ) : (
              activeSessions.map((sessionObj) => {
                const isOnline = sessionObj.online === true;
                const formattedTime = sessionObj.lastLoginAt 
                  ? new Date(sessionObj.lastLoginAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })
                  : 'Never';

                const formattedLogout = sessionObj.lastLogoutAt
                  ? new Date(sessionObj.lastLogoutAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })
                  : '';

                return (
                  <div key={sessionObj.email} className={cn("p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors", !isOnline && "opacity-85")}>
                    <div className="flex items-center gap-3 text-left min-w-0">
                      <div className="relative shrink-0">
                        <img 
                          src={sessionObj.photoURL || `https://picsum.photos/seed/${sessionObj.email.replace(/[^a-zA-Z0-9]/g, '_')}/100/100`} 
                          alt="Avatar" 
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        />
                        {isOnline ? (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                        ) : (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-slate-400 border-2 border-white" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {sessionObj.displayName}
                          </p>
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                            sessionObj.role === 'Primary Admin' 
                              ? "bg-blue-100 text-blue-700" 
                              : "bg-emerald-100 text-emerald-700"
                          )}>
                            {sessionObj.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold truncate">
                          {sessionObj.email}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right text-[10px] font-semibold text-slate-500 space-y-0.5 min-w-[140px]">
                      <div className="flex sm:justify-end items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide",
                          isOnline ? "bg-emerald-50 text-emerald-700 border border-emerald-100 animate-pulse" : "bg-slate-100 text-slate-500 border border-slate-200/50"
                        )}>
                          {isOnline ? 'Online Now' : 'Disconnected'}
                        </span>
                        <span className="text-slate-400 text-[9px] bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                          {sessionObj.platform || 'Desktop'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Last Active: <span className="font-bold text-slate-600">{formattedTime}</span>
                      </p>
                      {!isOnline && formattedLogout && (
                        <p className="text-[9px] text-slate-400 font-medium">
                          Logged out: {formattedLogout}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

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
