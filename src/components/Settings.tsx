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
import { DangerSettings } from './settings/DangerSettings';
import ConfirmationModal from './ConfirmationModal';

interface AllowedUser {
  email: string;
  addedAt?: string;
  addedBy?: string;
  disabled?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
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
  onUpdateAllowedUserPermission?: (email: string, field: 'canAdd' | 'canEdit' | 'canDelete', value: boolean) => Promise<void>;
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

  const isPrimaryAdmin = !!(user && user.email && (
    user.email.toLowerCase() === 'ignitina2@gmail.com' ||
    user.email.toLowerCase() === 'ignitina2@mail.com'
  ));

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

      {/* SECTION 2: SYSTEM DATA MAINTENANCE */}
      <div className="space-y-4">
        <div className="text-left border-b border-slate-100 pb-2">
          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">Section 02</span>
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
        />
      )}
    </div>
  );
};

export default Settings;
