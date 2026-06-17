import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertCircle,
  Cloud,
  CloudOff,
  LogOut,
  LogIn,
  RefreshCw
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
  onClearData: () => void | Promise<void>;
  onToggleNotifications: (enabled: boolean) => void;
  onUpdatePaymentLabels: (labels: Record<PaymentMethod, string>) => void;
  onUpdatePaymentMethodsList?: (list: CustomPaymentMethod[]) => void;
  user: any; // User | null
  allowedUsers?: AllowedUser[];
  onAddAllowedUser?: (email: string) => Promise<void>;
  onDeleteAllowedUser?: (email: string) => Promise<void>;
  onToggleAllowedUserDisabled?: (email: string, disabled: boolean) => Promise<void>;
  activeSessions?: any[];
  onGoogleLogin?: () => Promise<void>;
  onGoogleLogout?: () => Promise<void>;
  isLoggingIn?: boolean;
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
  allowedUsers = [],
  onAddAllowedUser,
  onDeleteAllowedUser,
  onToggleAllowedUserDisabled,
  activeSessions = [],
  onGoogleLogin,
  onGoogleLogout,
  isLoggingIn = false
}) => {
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [userToRevoke, setUserToRevoke] = useState<string | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
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

      {/* Google Firebase Sync Section - TOP SIDE */}
      <div id="settings-firebase-sync-section" className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4 text-left">
            <div className={cn(
              "p-3 rounded-2xl shrink-0 border",
              user && !user.isLocal 
                ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                : user && user.isLocal 
                  ? "bg-amber-50 text-amber-600 border-amber-100"
                  : "bg-slate-50 text-slate-400 border-slate-100"
            )}>
              {user && !user.isLocal ? (
                <Cloud size={24} className="animate-bounce" style={{ animationDuration: '3s' }} />
              ) : (
                <CloudOff size={24} />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Google Firebase Cloud Sync</h3>
                {user && !user.isLocal ? (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Connected & Synced
                  </span>
                ) : user && user.isLocal ? (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Device-Isolated (Local Bypass)
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    Offline / Disconnected
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                Connect your Google Account to automatically synchronize sales entries, prize sponsors, secretary handovers, and system settings securely in Google Cloud Firestore and Cloud Storage.
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center md:justify-end">
            {user ? (
              <button
                onClick={onGoogleLogout}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-sm border border-slate-200/50"
              >
                <LogOut size={14} />
                <span>Disconnect Sync</span>
              </button>
            ) : (
              <button
                onClick={onGoogleLogin}
                disabled={isLoggingIn}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black tracking-wide shadow-lg shadow-blue-600/15 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Connecting Account...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={14} />
                    <span>Sync with Google</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Sync Status Details / Warnings */}
        {user ? (
          <div className={cn(
            "p-5 rounded-2xl text-xs font-medium text-left border space-y-3",
            user.isLocal 
              ? "bg-amber-50/50 border-amber-100/80 text-amber-900" 
              : "bg-emerald-50/30 border-emerald-100/50 text-emerald-950"
          )}>
            <div className="flex items-center gap-3">
              <img 
                src={user.photoURL || `https://picsum.photos/seed/${(user.email || 'helper').replace(/[^a-zA-Z0-9]/g, '_')}/100/100`} 
                alt="Profile Avatar" 
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
              />
              <div>
                <p className="font-extrabold text-slate-800 text-sm">{user.displayName || 'Authorized Admin / Helper'}</p>
                <p className="text-[11px] text-slate-500 font-bold">{user.email || 'No email provided'}</p>
              </div>
            </div>

            {user.isLocal ? (
              <p className="text-[11px] text-amber-800 leading-relaxed font-semibold bg-white p-3 rounded-xl border border-amber-100">
                ⚠️ <strong className="font-bold text-amber-950">You are browsing in Local Bypass Mode.</strong> Your added entries, transactions, and settings updates are currently locked to your browser's private local state. To merge this data and enable multi-user real-time syncing, click the <strong className="font-bold text-amber-950">Sync with Google</strong> button above to link this device.
              </p>
            ) : (
              <p className="text-[11px] text-emerald-800 leading-relaxed font-semibold bg-white p-3 rounded-xl border border-emerald-100 flex items-start gap-2">
                <span className="text-base leading-none">✅</span>
                <span>
                  <strong className="font-bold text-emerald-950">Active cloud database connection running.</strong> Your data is perfectly secure. Every transaction record and picture receipt is continuously synced to Google Cloud Firestore & Cloud Storage.
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-start gap-3 text-left">
            <AlertCircle size={16} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
              If your database goes offline, or you change browsers, local data backups are supported. However, connecting to Firebase Google Cloud Sync guarantees real-time shared multi-device updates and automatic background data replication.
            </p>
          </div>
        )}
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
