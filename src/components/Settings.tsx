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
  Database,
  Palette,
  Users,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { AppData, PaymentMethod, CustomPaymentMethod } from '@/types';
import { cn } from '@/lib/utils';
import { LogoSettings } from './settings/LogoSettings';
import { BackupSettings } from './settings/BackupSettings';
import { PaymentSettings } from './settings/PaymentSettings';
import { AdminSettings, AllowedUser } from './settings/AdminSettings';
import { ActiveSessions } from './settings/ActiveSessions';
import { DangerSettings } from './settings/DangerSettings';
import { DriveSheetsSettings } from './settings/DriveSheetsSettings';
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
  driveAccessToken?: string | null;
  driveSyncConfig?: any;
  onUpdateDriveSyncConfig?: (config: any) => Promise<void>;
  onConnectDrive?: () => Promise<void>;
  isDriveAutoSyncEnabled?: boolean;
  onToggleDriveAutoSync?: (enabled: boolean) => void;
}

type SettingsTab = 'all' | 'branding' | 'cloud' | 'backup';

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
  onSyncLocalToCloud,
  driveAccessToken = null,
  driveSyncConfig,
  onUpdateDriveSyncConfig,
  onConnectDrive = async () => {},
  isDriveAutoSyncEnabled = true,
  onToggleDriveAutoSync = () => {}
}) => {
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [userToRevoke, setUserToRevoke] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('all');
  const [isSyncing, setIsSyncing] = useState(false);

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

  const handleForceSync = async () => {
    if (!onSyncLocalToCloud) return;
    setIsSyncing(true);
    try {
      const success = await onSyncLocalToCloud();
      if (success) {
        showNotification('success', 'Database cloud synchronization succeeded!');
      } else {
        showNotification('error', 'Database cloud sync failed. Please check network connection.');
      }
    } catch (e) {
      showNotification('error', 'Error syncing with cloud.');
    } finally {
      setIsSyncing(false);
    }
  };

  const tabs = [
    { id: 'all' as SettingsTab, label: 'All Settings', icon: Sliders },
    { id: 'branding' as SettingsTab, label: 'Branding & Payments', icon: Palette },
    { id: 'cloud' as SettingsTab, label: 'Cloud Sync & Team', icon: Cloud },
    { id: 'backup' as SettingsTab, label: 'Backup & Security', icon: Database },
  ];

  return (
    <div id="settings-management-container" className="max-w-5xl mx-auto space-y-8 p-4 font-sans pb-20">
      
      {/* Toast Notification */}
      {notification && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold animate-in fade-in slide-in-from-bottom-2",
          notification.type === 'success' 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-rose-50 text-rose-800 border-rose-200"
        )}>
          {notification.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 text-left">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">System Settings</h1>
          <p className="text-slate-500 font-medium text-xs mt-0.5">
            Manage branding, cloud synchronization, team access, payment methods, and backups
          </p>
        </div>

        {/* Quick Connection Indicator in Header */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {user && !user.isLocal ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cloud Sync Online</span>
            </div>
          ) : user && user.isLocal ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Local Bypass Mode</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Simplified Segmented Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                isActive 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <Icon size={15} className={isActive ? "text-blue-600" : "text-slate-400"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: BRANDING & PAYMENT METHODS */}
      {(activeTab === 'all' || activeTab === 'branding') && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="text-left border-b border-slate-100 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Palette size={16} className="text-blue-600" />
              Branding & Payment Methods
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">Logo & payment options</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LogoSettings 
              appData={appData} 
              onUpdateLogo={onUpdateLogo} 
              onUpdateLogoMobile={onUpdateLogoMobile}
              onUpdateLogoDesktop={onUpdateLogoDesktop}
              user={user} 
            />

            <PaymentSettings 
              appData={appData} 
              onUpdatePaymentLabels={onUpdatePaymentLabels} 
              onUpdatePaymentMethodsList={onUpdatePaymentMethodsList} 
            />
          </div>
        </div>
      )}

      {/* SECTION 2: CLOUD SYNCHRONIZATION & TEAM ACCESS */}
      {(activeTab === 'all' || activeTab === 'cloud') && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="text-left border-b border-slate-100 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Cloud size={16} className="text-blue-600" />
              Cloud Database & Team Security
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">Firestore sync & permissions</span>
          </div>

          {/* Simple, Clean Google Firebase Cloud Sync Card */}
          <div id="settings-firebase-sync-section" className="bg-white p-6 md:p-7 rounded-3xl border border-slate-100 shadow-sm space-y-6 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={cn(
                  "p-3 rounded-2xl shrink-0 border",
                  user && !user.isLocal 
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                    : user && user.isLocal 
                      ? "bg-amber-50 text-amber-600 border-amber-100"
                      : "bg-slate-50 text-slate-400 border-slate-100"
                )}>
                  {user && !user.isLocal ? (
                    <Cloud size={22} className="text-emerald-600" />
                  ) : (
                    <CloudOff size={22} />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">Google Firebase Cloud Sync</h3>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">
                    Real-time cloud database synchronization and backup
                  </p>
                </div>
              </div>

              {/* Login / Disconnect Button */}
              <div className="shrink-0 flex items-center">
                {user && !user.isLocal ? (
                  <button
                    onClick={onGoogleLogout}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-sm border border-slate-200"
                  >
                    <LogOut size={14} />
                    <span>Disconnect Google Sync</span>
                  </button>
                ) : (
                  <button
                    onClick={onGoogleLogin}
                    disabled={isLoggingIn}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-sm"
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

            {/* Cloud User Profile & Status Details */}
            {user ? (
              <div className={cn(
                "p-4 rounded-2xl text-xs border space-y-4",
                user.isLocal 
                  ? "bg-amber-50/60 border-amber-200/70 text-amber-950" 
                  : "bg-slate-50/70 border-slate-200/60 text-slate-800"
              )}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || 'Admin')}&background=0284c7&color=fff`} 
                      alt="Profile Avatar" 
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                    />
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{user.displayName || 'Authorized Admin / Helper'}</p>
                      <p className="text-xs text-slate-500">{user.email || 'No email provided'}</p>
                    </div>
                  </div>

                  <span className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold self-start sm:self-center",
                    user.isLocal ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                  )}>
                    {user.isLocal ? "Local Mode" : "Firestore Live Connected"}
                  </span>
                </div>

                {user.isLocal ? (
                  <p className="text-xs text-amber-900 leading-relaxed bg-white p-3 rounded-xl border border-amber-200/80">
                    ⚠️ <strong>You are browsing in Local Bypass Mode.</strong> Your added entries, transactions, and settings updates are currently locked to your browser's private local state. To merge this data and enable multi-user real-time syncing, click the <strong>Sync with Google</strong> button above to link this device.
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
                    <p className="text-xs text-slate-600">
                      If you notice different totals on mobile or another screen, run a force sync to publish local changes.
                    </p>
                    <button
                      onClick={handleForceSync}
                      disabled={isSyncing}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition-all active:scale-95 border border-blue-200/70 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                      <span>{isSyncing ? 'Syncing...' : 'Force Database Sync'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                Connect your Google Account to automatically synchronize sales entries, prize sponsors, treasury handovers, and system settings securely in Google Cloud Firestore.
              </div>
            )}
          </div>

          {/* Google Drive & Google Sheets Live Synchronization */}
          <DriveSheetsSettings 
            appData={appData}
            user={user}
            accessToken={driveAccessToken}
            driveSyncConfig={driveSyncConfig}
            onUpdateDriveSyncConfig={onUpdateDriveSyncConfig}
            onConnectDrive={onConnectDrive}
            isAutoSyncEnabled={isDriveAutoSyncEnabled}
            onToggleAutoSync={onToggleDriveAutoSync}
            showNotification={showNotification}
          />

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
      )}

      {/* SECTION 3: DATA BACKUP & MAINTENANCE */}
      {(activeTab === 'all' || activeTab === 'backup') && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="text-left border-b border-slate-100 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database size={16} className="text-blue-600" />
              Data Backups & System Maintenance
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">Archives & reset options</span>
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
            <DangerSettings 
              onClearAll={onClearData} 
              onBackup={onBackup} 
              showNotification={showNotification} 
            />
          </div>
        </div>
      )}

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
