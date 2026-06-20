import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertCircle,
  Cloud,
  CloudOff,
  LogOut,
  LogIn,
  RefreshCw,
  Sliders,
  Database
} from 'lucide-react';
import { AppData, PaymentMethod, CustomPaymentMethod } from '@/types';
import { cn } from '@/lib/utils';
import { LogoSettings } from './settings/LogoSettings';
import { BackupSettings } from './settings/BackupSettings';
import { PaymentSettings } from './settings/PaymentSettings';
import { AdminSettings, AllowedUser } from './settings/AdminSettings';
import { ActiveSessions } from './settings/ActiveSessions';
import { DangerSettings } from './settings/DangerSettings';
import ConfirmationModal from './ConfirmationModal';

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
  onAddAllowedUser?: (email: string, role: AllowedUser['role'], perms: { canAdd: boolean; canEdit: boolean; canDelete: boolean }) => Promise<void>;
  onDeleteAllowedUser?: (email: string) => Promise<void>;
  onToggleAllowedUserDisabled?: (email: string, currentStatus: AllowedUser['status']) => Promise<void>;
  onUpdateAllowedUserPermission?: (email: string, field: 'canAdd' | 'canEdit' | 'canDelete' | 'canShareReport' | 'hideIncomeExpense' | 'hideSecretaryHandover', value: boolean) => Promise<void>;
  activeSessions?: any[];
  onGoogleLogin?: () => Promise<void>;
  onGoogleLogout?: () => Promise<void>;
  isLoggingIn?: boolean;
  onSyncLocalToCloud?: () => Promise<boolean>;
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
  onUpdateAllowedUserPermission,
  activeSessions = [],
  onGoogleLogin,
  onGoogleLogout,
  isLoggingIn = false,
  onSyncLocalToCloud
}) => {
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [userToRevoke, setUserToRevoke] = useState<string | null>(null);
  const [isFirebaseSyncExpanded, setIsFirebaseSyncExpanded] = useState(false);

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

  return (
    <div id="settings-management-container" className="max-w-4xl mx-auto space-y-10 p-4 font-sans pb-16">
      
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

      {/* Title Header */}
      <div className="text-left space-y-1.5 border-b border-slate-100 pb-4">
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">System Settings & Controls</h1>
        <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">Configure database sync, company branding, customized payment methods and local backup files</p>
      </div>

      {/* SECTION 1: CUSTOMISATION & APP BRANDING */}
      <div className="space-y-4">
        <div className="text-left border-b border-slate-100 pb-2">
          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">Section 01</span>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mt-1.5 flex items-center gap-2">
            <Sliders size={16} className="text-slate-500" />
            App Customisation & Branding
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* App Logo Settings */}
          <LogoSettings 
            appData={appData} 
            onUpdateLogo={onUpdateLogo} 
            onUpdateLogoMobile={onUpdateLogoMobile}
            onUpdateLogoDesktop={onUpdateLogoDesktop}
            user={user} 
          />

          {/* Custom Payment Methods */}
          <PaymentSettings 
            appData={appData} 
            onUpdatePaymentLabels={onUpdatePaymentLabels} 
            onUpdatePaymentMethodsList={onUpdatePaymentMethodsList} 
          />
        </div>
      </div>

      {/* SECTION 2: CLOUD SYNC & TEAM SECURITY */}
      <div className="space-y-4">
        <div className="text-left border-b border-slate-100 pb-2">
          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">Section 02</span>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mt-1.5 flex items-center gap-2">
            <Cloud size={16} className="text-slate-500" />
            Database Synchronisation & Team Security
          </h2>
        </div>

        <div className="space-y-6">
          {/* Google Firebase Sync Section - TOP SIDE */}
          <div id="settings-firebase-sync-section" className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 text-left">
            <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-50 pb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2.5 rounded-2xl shrink-0 border",
                  user && !user.isLocal 
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                    : user && user.isLocal 
                      ? "bg-amber-50 text-amber-600 border-amber-100"
                      : "bg-slate-50 text-slate-400 border-slate-100"
                )}>
                  {user && !user.isLocal ? (
                    <Cloud size={20} className="animate-bounce" style={{ animationDuration: '3s' }} />
                  ) : (
                    <CloudOff size={20} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase leading-tight">Google Firebase Cloud Sync</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Database Synchronisation & Security</p>
                </div>
              </div>

              {/* Expand Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">
                  {isFirebaseSyncExpanded ? "Setup open" : "Setup hidden"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsFirebaseSyncExpanded(!isFirebaseSyncExpanded)}
                  className={cn(
                    "w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer shadow-inner",
                    isFirebaseSyncExpanded ? "bg-blue-600" : "bg-slate-300"
                  )}
                  title={isFirebaseSyncExpanded ? "Collapse Sync Settings" : "Expand Sync Settings"}
                >
                  <div className={cn(
                    "w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-md",
                    isFirebaseSyncExpanded ? "translate-x-6" : "translate-x-0"
                  )} />
                </button>
              </div>
            </div>

            {!isFirebaseSyncExpanded ? (
              /* Collapsed summary layout to save massive amount of space */
              <div className="p-4 bg-slate-50/75 hover:bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors animate-in fade-in duration-300 text-left font-sans">
                <div className="space-y-1.5 w-full sm:w-auto">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Cloud Engine Status</h4>
                  <div className="font-mono text-[9px] text-slate-500 font-bold flex flex-wrap gap-1.5">
                    {user && !user.isLocal ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100/50 px-2.5 py-0.5 rounded-lg">
                        ● Online Sync Active ({user.email})
                      </span>
                    ) : user && user.isLocal ? (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100/55 px-2.5 py-0.5 rounded-lg border-dashed">
                        ⚠️ Local Bypass Mode Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200/40 px-2.5 py-0.5 rounded-lg">
                        ● Offline Mode
                      </span>
                    )}
                  </div>
                </div>
                <span className="self-end sm:self-center text-[9px] text-slate-500 font-black uppercase tracking-wider bg-slate-200/50 border border-slate-200/20 px-3 py-1.5 rounded-xl">
                  Cloud Live
                </span>
              </div>
            ) : (
              /* Expanded setup details */
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                  <p className="text-slate-500 text-xs font-semibold leading-relaxed max-w-xl">
                    Connect your Google Account to automatically synchronize sales entries, prize sponsors, secretary handovers, and system settings securely in Google Cloud Firestore and Cloud Storage.
                  </p>

                  <div className="shrink-0 flex items-center md:justify-end">
                    {user && !user.isLocal ? (
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
                {user && (
                  <div className={cn(
                    "p-5 rounded-2xl text-xs font-medium border space-y-3",
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

                    <div className="pt-3 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800">Different dashboard amounts on mobile/desktop?</p>
                        <p className="text-[10px] text-slate-400 font-bold">If this device has any local/offline data that isn't appearing on other screens, run a force sync to publish them.</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (onSyncLocalToCloud) {
                            const success = await onSyncLocalToCloud();
                            if (success) {
                              showNotification('success', 'Database cloud synchronization succeeded!');
                            } else {
                              showNotification('error', 'Database cloud sync failed. Please check your network connection.');
                            }
                          }
                        }}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 px-3.5 rounded-xl text-[10px] shadow-sm transition-all active:scale-95 flex items-center gap-1.5 border border-blue-100 shrink-0 cursor-pointer justify-center"
                      >
                        <RefreshCw size={13} />
                        <span>Force Database Cloud Sync</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Admin User Management Center */}
          <AdminSettings 
            user={user}
            allowedUsers={allowedUsers}
            onAddAllowedUser={onAddAllowedUser || (async () => {})}
            onToggleAllowedUserDisabled={onToggleAllowedUserDisabled || (async () => {})}
            onUpdateAllowedUserPermission={onUpdateAllowedUserPermission || (async () => {})}
            setUserToRevoke={setUserToRevoke}
            showNotification={showNotification}
          />

          {/* Active Logged-in Sessions List */}
          {user && !user.isLocal && (
            <ActiveSessions 
              activeSessions={activeSessions}
              currentUser={user}
              showNotification={showNotification}
            />
          )}
        </div>
      </div>

      {/* SECTION 3: SYSTEM DATA MAINTENANCE */}
      <div className="space-y-4">
        <div className="text-left border-b border-slate-100 pb-2">
          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">Section 03</span>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mt-1.5 flex items-center gap-2">
            <Database size={16} className="text-slate-500" />
            Data Backups & Local Maintenance
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Data Management (Backup, Restore, Notification Toggle) */}
          <BackupSettings 
            appData={appData} 
            onBackup={onBackup} 
            onRestore={onRestore} 
            onToggleNotifications={onToggleNotifications}
            showNotification={showNotification}
          />

          {/* Danger Zone */}
          <DangerSettings onClearAll={onClearData} onBackup={onBackup} showNotification={showNotification} />
        </div>
      </div>

      {/* Confirmation Modal for Revoking Users */}
      {userToRevoke && (
        <ConfirmationModal
          isOpen={!!userToRevoke}
          onClose={() => setUserToRevoke(null)}
          onConfirm={handleRevokeConfirm}
          title="Revoke Admin Access"
          message={`Are you sure you want to revoke server database sync permissions for ${userToRevoke}? They will be immediately blocked from logging in.`}
          size="xs"
        />
      )}
    </div>
  );
};

export default Settings;
