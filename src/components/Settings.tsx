import React, { useRef, useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Upload, 
  Download, 
  Trash2, 
  Image as ImageIcon,
  Database,
  ShieldAlert,
  Save,
  RefreshCw,
  FileJson,
  Bell,
  BellOff,
  CheckCircle2,
  AlertCircle,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  Sparkles,
  UserPlus,
  UserMinus,
  ShieldCheck,
  Lock,
  Mail,
  AlertTriangle,
  X
} from 'lucide-react';
import { AppData, PaymentMethod, DEFAULT_PAYMENT_LABELS, CustomPaymentMethod, getDefaultPaymentMethodsList } from '@/types';
import { cn } from '@/lib/utils';
import { requestNotificationPermission } from '@/lib/notifications';
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
  // Firebase Sync & Auth Integration
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [hasConfirmedBackup, setHasConfirmedBackup] = useState(false);
  const [downloadedBeforeClear, setDownloadedBeforeClear] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [userToRevoke, setUserToRevoke] = useState<string | null>(null);

  const [newMethodLabel, setNewMethodLabel] = useState('');

  const methodsList = appData.paymentMethodsList && appData.paymentMethodsList.length > 0
    ? appData.paymentMethodsList
    : getDefaultPaymentMethodsList(appData.customPaymentLabels);

  const handleAddPaymentMethod = () => {
    if (!newMethodLabel.trim()) return;
    const newId = `CUSTOM_${Date.now()}`;
    const newMethodObj: CustomPaymentMethod = {
      id: newId,
      label: newMethodLabel.trim(),
      isDisabled: false,
      isSystem: false
    };
    const updatedList = [...methodsList, newMethodObj];
    onUpdatePaymentMethodsList?.(updatedList);
    const updatedLabels = {
      ...(appData.customPaymentLabels || DEFAULT_PAYMENT_LABELS),
      [newId]: newMethodLabel.trim()
    };
    onUpdatePaymentLabels(updatedLabels);
    setNewMethodLabel('');
  };

  const handleRenamePaymentMethod = (id: string, newLabel: string) => {
    const updatedList = methodsList.map(m => m.id === id ? { ...m, label: newLabel } : m);
    onUpdatePaymentMethodsList?.(updatedList);
    const updatedLabels = {
      ...(appData.customPaymentLabels || DEFAULT_PAYMENT_LABELS),
      [id]: newLabel
    };
    onUpdatePaymentLabels(updatedLabels);
  };

  const handleTogglePaymentMethod = (id: string) => {
    const updatedList = methodsList.map(m => m.id === id ? { ...m, isDisabled: !m.isDisabled } : m);
    onUpdatePaymentMethodsList?.(updatedList);
  };

  const handleDeletePaymentMethod = (id: string) => {
    const updatedList = methodsList.filter(m => m.id !== id);
    onUpdatePaymentMethodsList?.(updatedList);
    if (appData.customPaymentLabels) {
      const updatedLabels = { ...appData.customPaymentLabels };
      delete updatedLabels[id];
      onUpdatePaymentLabels(updatedLabels);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const isAdminUser = user && (
    user.email?.toLowerCase() === 'ignitina2@gmail.com' ||
    user.email?.toLowerCase() === 'ignitina2@mail.com'
  );

  const isPrimaryAdmin = user && user.email?.toLowerCase() === 'ignitina2@gmail.com';

  if (!isPrimaryAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-100 shadow-xl p-8 space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-600 shadow-inner border border-rose-100/50">
          <Lock size={26} className="text-rose-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Restricted Settings</h1>
          <p className="text-slate-500 text-xs font-semibold leading-relaxed">
            Application configurations, dynamic payment options, and database sync controls are restricted strictly to the Primary Administrator.
          </p>
        </div>

        {user ? (
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 space-y-4">
            <div className="flex items-center gap-3 justify-center">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-white shadow-sm shrink-0">
                <img src={user.photoURL || 'https://picsum.photos/seed/admin/100/100'} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-bold text-xs text-slate-900 truncate">{user.displayName || 'Secondary User'}</p>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider truncate uppercase">{user.email}</p>
              </div>
            </div>
            
            <div className="bg-rose-50/80 border border-rose-100 rounded-xl p-3 text-[11px] text-rose-700 font-bold flex items-center justify-center gap-1.5 leading-tight">
              <AlertCircle size={14} className="shrink-0 text-rose-600" />
              <span>Access Denied: Only ignitina2@gmail.com is permitted.</span>
            </div>

            <button
              onClick={onGoogleLogout}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200/50 active:scale-95"
            >
              Log Out and Switch Account
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="bg-blue-50/50 border border-blue-100/60 rounded-xl p-3.5 text-[11px] text-blue-800 font-semibold flex items-start gap-2.5 leading-normal text-left">
              <span className="text-sm shrink-0 leading-none">ℹ️</span>
              <p>You are currently logged out. Please sign in with the Google Account of the primary administrator to manage settings.</p>
            </div>
            <button
              onClick={onGoogleLogin}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/10 transition-all cursor-pointer active:scale-[0.98]"
            >
              <LogIn size={15} />
              Sign in as Primary Admin
            </button>
          </div>
        )}
      </div>
    );
  }

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToValidate = newEmail.trim().toLowerCase();
    if (!emailToValidate) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToValidate)) {
      showNotification('error', 'Please enter a valid email address.');
      return;
    }

    if (emailToValidate === 'ignitina2@gmail.com' || emailToValidate === 'ignitina2@mail.com') {
      showNotification('error', 'The super administrator is permanently auto-allowed.');
      return;
    }

    if (allowedUsers.some(u => u.email.toLowerCase() === emailToValidate)) {
      showNotification('error', 'This email is already in the allowed users list.');
      return;
    }

    try {
      if (onAddAllowedUser) {
        await onAddAllowedUser(emailToValidate);
        setNewEmail('');
        showNotification('success', `Access successfully granted to ${emailToValidate}.`);
      }
    } catch (err) {
      showNotification('error', 'Failed to save to cloud directory.');
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Settings & Backup</h1>
        <p className="text-slate-500 mt-1 font-medium">Manage your application data and preferences</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Logo Management */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
              <ImageIcon size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">App Logo</h3>
          </div>
          
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 transition-all hover:bg-slate-100">
            {appData.logo ? (
              <div className="relative group">
                <img src={appData.logo} alt="App Logo" className="w-32 h-32 object-contain rounded-xl shadow-md" />
                <button 
                  onClick={() => onUpdateLogo('')}
                  className="absolute -top-2 -right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-slate-300 shadow-sm">
                  <Upload size={24} />
                </div>
                <p className="text-slate-500 text-sm font-medium">No logo uploaded yet</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleLogoUpload} 
              accept="image/*" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 bg-white border border-slate-200 text-slate-700 px-6 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
            >
              {appData.logo ? 'Change Logo' : 'Upload Logo'}
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center font-medium">Recommended size: 512x512px. Max 1MB.</p>
        </div>

        {/* Backup & Restore */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
              <Database size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Data Management</h3>
          </div>

          <div className="space-y-4">
            <button 
              onClick={onBackup}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                  <Download size={20} />
                </div>
                <div className="text-left">
                  <p className="text-slate-900 font-bold text-sm">Backup Data</p>
                  <p className="text-slate-500 text-xs font-medium">Download all records as JSON</p>
                </div>
              </div>
              <FileJson size={20} className="text-slate-300" />
            </button>

            <button 
              onClick={() => restoreInputRef.current?.click()}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-lg shadow-sm text-emerald-600 group-hover:scale-110 transition-transform">
                  <RefreshCw size={20} />
                </div>
                <div className="text-left">
                  <p className="text-slate-900 font-bold text-sm">Restore Data</p>
                  <p className="text-slate-500 text-xs font-medium">Upload a previous backup file</p>
                </div>
              </div>
              <Upload size={20} className="text-slate-300" />
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
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-2 rounded-lg shadow-sm transition-transform group-hover:scale-110",
                  appData.notificationsEnabled ? "bg-amber-50 text-amber-600" : "bg-slate-200 text-slate-400"
                )}>
                  {appData.notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
                </div>
                <div className="text-left">
                  <p className="text-slate-900 font-bold text-sm">Push Notifications</p>
                  <p className="text-slate-500 text-xs font-medium">
                    {appData.notificationsEnabled ? 'Enabled for alerts' : 'Disabled'}
                  </p>
                </div>
              </div>
              <div className={cn(
                "w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out",
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

        {/* Payment Methods & Modes Manager */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
              <SettingsIcon size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Payment Methods Manager</h3>
          </div>
          <p className="text-slate-500 text-xs font-semibold leading-relaxed">
            Configure system and custom payment options. You can add more payment modes, modify display labels, disable inactive modes, or delete custom items.
          </p>

          {/* Add Custom Payment Mode Form */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-left">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Add Custom Payment Mode</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMethodLabel}
                onChange={(e) => setNewMethodLabel(e.target.value)}
                placeholder="e.g. Airtel Money, Amazon Pay"
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold"
              />
              <button
                onClick={handleAddPaymentMethod}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-extrabold hover:bg-blue-700 transition-all cursor-pointer shadow-sm shrink-0"
              >
                Add Mode
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-left">All Configured Modes</h4>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
              {methodsList.map((method) => (
                <div key={method.id} className={cn("p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white", method.isDisabled && "bg-slate-50/40")}>
                  <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0", method.id === 'CASH' ? 'bg-emerald-50 text-emerald-600' : method.id === 'CREDIT' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600')}>
                      {method.id === 'CASH' ? '₵' : method.id === 'CREDIT' ? '💳' : '📱'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {method.isSystem ? 'System' : 'Custom'}
                        </span>
                        {method.isDisabled && (
                          <span className="text-[8px] font-extrabold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Disabled
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={method.label}
                        onChange={(e) => handleRenamePaymentMethod(method.id, e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-slate-850"
                        placeholder="Display Name"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {/* Disable Toggle Switch for non-CASH system and custom modes */}
                    {method.id !== 'CASH' && (
                      <button
                        onClick={() => handleTogglePaymentMethod(method.id)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          method.isDisabled ? "bg-slate-200" : "bg-blue-600"
                        )}
                        title={method.isDisabled ? "Click to Enable" : "Click to Disable"}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            method.isDisabled ? "translate-x-0" : "translate-x-4"
                          )}
                        />
                      </button>
                    )}

                    {/* Delete for Custom payment modes */}
                    {!method.isSystem && (
                      <button
                        onClick={() => handleDeletePaymentMethod(method.id)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                        title="Delete custom mode"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Google Cloud Integration */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                user ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
              )}>
                {user ? <Cloud size={20} /> : <CloudOff size={20} />}
              </div>
              <h3 className="text-lg font-bold text-slate-900">Google Cloud Sync</h3>
            </div>
            
            <p className="text-slate-500 text-xs font-semibold leading-relaxed">
              Activate zero-lag, continuous secure cloud sync with Firestore. Automatically syncs transactions, sponsors, income & expenses, and custom preferences in real-time.
            </p>

            {user ? (
              <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-white shadow-sm shrink-0">
                    <img src={user.photoURL || 'https://picsum.photos/seed/admin/100/100'} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate">{user.displayName || 'Authorized User'}</p>
                    <p className="text-[10px] text-slate-400 font-bold tracking-wider truncate uppercase">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Secure Session
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/50 flex gap-3 text-amber-800 text-xs font-semibold leading-relaxed">
                <div>⚠️</div>
                <p>You are currently operating in offline-only local state. Transactions will only save to this device's cache until synced.</p>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4">
            {user ? (
              <>
                <button
                  disabled={syncingCloud}
                  onClick={async () => {
                    setSyncingCloud(true);
                    const ok = await onSyncLocalToCloud();
                    setSyncingCloud(false);
                    if (ok) {
                      showNotification('success', 'Local data synced with Google Cloud Firestore!');
                    } else {
                      showNotification('error', 'Cloud sync failed. Check rules or try again.');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/10 transition-all cursor-pointer active:scale-[0.98]"
                >
                  {syncingCloud ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Syncing database...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Sync Offline Data to Cloud
                    </>
                  )}
                </button>
                <button
                  onClick={onGoogleLogout}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-[0.98]"
                >
                  <LogOut size={14} />
                  Disconnect Cloud Session
                </button>
              </>
            ) : (
              <button
                onClick={onGoogleLogin}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/10 transition-all cursor-pointer active:scale-[0.98]"
              >
                <LogIn size={16} />
                Connect with Google
              </button>
            )}
          </div>
        </div>

        {/* Admin Control Center: Allowed Users */}
        {isAdminUser && (
          <div className="md:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Secondary Admin & Access Settings</h3>
                <p className="text-slate-500 text-xs font-semibold">Authorize secondary allowed/permitted Google mail IDs to log in and synchronize data</p>
              </div>
            </div>

            <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-4">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus size={14} />
                Authorize Permitted Secondary Admin Mail ID
              </h4>
              <form onSubmit={handleAddEmail} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter secondary admin Google email address... (e.g. partner@gmail.com)"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md shadow-blue-600/10 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <UserPlus size={14} />
                  Permit Mail ID
                </button>
              </form>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Permitted Secondary Admin Mail IDs ({allowedUsers.length})
              </h4>
              <div className="border border-slate-100 rounded-2xl bg-white overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {/* Always show the root admin */}
                <div className="p-4 flex items-center justify-between bg-blue-50/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-black">
                      SA
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        ignitina2@gmail.com
                        <span className="bg-blue-100 text-blue-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Primary Admin
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Root System Owner</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                    <ShieldCheck size={11} />
                    Permanent Bypass
                  </span>
                </div>

                {allowedUsers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
                    No secondary emails authorized. Only owner (ignitina2) currently permitted.
                  </div>
                ) : (
                  allowedUsers.map((userObj) => (
                    <div key={userObj.email} className={cn("p-4 flex items-center justify-between hover:bg-slate-50 transition-colors", userObj.disabled && "bg-slate-50/50")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase", userObj.disabled ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
                          {userObj.email.substring(0, 2)}
                        </div>
                        <div className="text-left">
                          <p className={cn("text-xs font-bold transition-all", userObj.disabled ? "text-slate-400 line-through decoration-slate-300" : "text-slate-900")}>
                            {userObj.email}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            Added by {userObj.addedBy || 'System Admin'} on {userObj.addedAt ? new Date(userObj.addedAt).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Disable Toggle Switch */}
                        <button
                          onClick={() => onToggleAllowedUserDisabled?.(userObj.email, !userObj.disabled)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            userObj.disabled ? "bg-slate-200" : "bg-blue-600"
                          )}
                          title={userObj.disabled ? "Enable user" : "Disable user"}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              userObj.disabled ? "translate-x-0" : "translate-x-4"
                            )}
                          />
                        </button>
                        <button
                          onClick={() => setUserToRevoke(userObj.email)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                          title="Revoke/Delete User"
                        >
                          <UserMinus size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        <div className="md:col-span-2 bg-rose-50 p-8 rounded-3xl border border-rose-100 space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-rose-100 p-2 rounded-lg text-rose-600">
              <ShieldAlert size={20} />
            </div>
            <h3 className="text-lg font-bold text-rose-900">Danger Zone</h3>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-rose-900 font-bold">Clear All Application Data</p>
              <p className="text-rose-700 text-sm font-medium">This action is permanent and cannot be undone. Please backup your data first.</p>
            </div>
            <button 
              onClick={() => setShowClearConfirm(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition-all active:scale-95 whitespace-nowrap"
            >
              <Trash2 size={20} />
              Clear Data
            </button>
          </div>
        </div>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className={cn(
          "fixed bottom-8 right-8 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 z-50",
          notification.type === 'success' ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        )}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="font-bold text-sm">{notification.message}</p>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100/80">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600">
                  <AlertTriangle size={24} />
                </div>
                <button 
                  onClick={() => {
                    setShowClearConfirm(false);
                    setHasConfirmedBackup(false);
                    setDownloadedBeforeClear(false);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">Clear All Data</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Are you absolutely sure you want to clear all application data? This action is permanent and cannot be undone.
              </p>

              {/* Required Backup Prompt */}
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-left space-y-3 mb-4">
                <p className="text-amber-900 font-extrabold text-xs">⚠️ Please backup your data before clearing:</p>
                <button
                  type="button"
                  onClick={() => {
                    onBackup();
                    setDownloadedBeforeClear(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all decoration-0 active:scale-95"
                >
                  <Download size={14} />
                  Download Backup Now
                </button>
                {downloadedBeforeClear && (
                  <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    ✓ Backup downloaded! Save it safely.
                  </p>
                )}
              </div>

              {/* Option to indicate download before clear */}
              <label className="flex items-start gap-2.5 cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={hasConfirmedBackup}
                  onChange={(e) => setHasConfirmedBackup(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-xs text-slate-500 font-bold select-none leading-tight">
                  I have downloaded/backed up my data and want to proceed with clearing all records.
                </span>
              </label>
            </div>
            
            <div className="p-6 bg-slate-50 flex gap-3">
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                  setHasConfirmedBackup(false);
                  setDownloadedBeforeClear(false);
                }}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all active:scale-95 text-xs text-center"
              >
                Cancel
              </button>
              <button
                disabled={!hasConfirmedBackup}
                onClick={() => {
                  onClearData();
                  setShowClearConfirm(false);
                  setHasConfirmedBackup(false);
                  setDownloadedBeforeClear(false);
                  showNotification('success', 'All data cleared successfully.');
                }}
                className={cn(
                  "flex-1 px-4 py-3 text-white font-bold rounded-2xl transition-all text-xs active:scale-95 shadow-lg",
                  hasConfirmedBackup 
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 cursor-pointer" 
                    : "bg-slate-300 text-slate-400 shadow-none cursor-not-allowed"
                )}
              >
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!userToRevoke}
        onClose={() => setUserToRevoke(null)}
        onConfirm={async () => {
          if (userToRevoke && onDeleteAllowedUser) {
            try {
              await onDeleteAllowedUser(userToRevoke);
              showNotification('success', `Access successfully revoked for ${userToRevoke}.`);
            } catch (err) {
              showNotification('error', `Failed to revoke access.`);
            }
          }
          setUserToRevoke(null);
        }}
        title="Revoke Account Location"
        message={`Are you positive you wish to revoke cloud access credentials for ${userToRevoke}? They will be immediately signed out and restricted from database synchronization.`}
        confirmText="Revoke Access"
        variant="danger"
      />
    </div>
  );
};

export default Settings;
