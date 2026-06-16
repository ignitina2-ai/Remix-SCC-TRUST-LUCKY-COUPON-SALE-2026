import React, { useState } from 'react';
import { ShieldCheck, UserPlus, Mail, UserMinus, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AllowedUser {
  email: string;
  addedAt?: string;
  addedBy?: string;
  disabled?: boolean;
}

interface AdminSettingsProps {
  user: any;
  allowedUsers: AllowedUser[];
  onAddAllowedUser?: (email: string) => Promise<void>;
  onDeleteAllowedUser?: (email: string) => Promise<void>;
  onToggleAllowedUserDisabled?: (email: string, disabled: boolean) => Promise<void>;
  setUserToRevoke: (email: string | null) => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  user,
  allowedUsers,
  onAddAllowedUser,
  onToggleAllowedUserDisabled,
  setUserToRevoke,
  showNotification,
}) => {
  const [newEmail, setNewEmail] = useState('');

  const isAdminUser = user && (
    user.email?.toLowerCase() === 'ignitina2@gmail.com' ||
    user.email?.toLowerCase() === 'ignitina2@gmail.com'
  );

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToValidate = newEmail.trim().toLowerCase();
    if (!emailToValidate) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToValidate)) {
      showNotification('error', 'Please enter a valid email address.');
      return;
    }

    if (emailToValidate === 'ignitina2@gmail.com' || emailToValidate === 'ignitina2@gmail.com') {
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

  if (!isAdminUser) return null;

  return (
    <div id="settings-card-admin" className="md:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
          <ShieldCheck size={20} />
        </div>
        <div className="text-left">
          <h3 className="text-lg font-bold text-slate-900">Secondary Admin & Access Settings</h3>
          <p className="text-slate-500 text-xs font-semibold">Authorize secondary allowed/permitted Google mail IDs to log in and synchronize data</p>
        </div>
      </div>

      <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-4">
        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 text-left">
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
        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider text-left">
          Permitted Secondary Admin Mail IDs ({allowedUsers.length})
        </h4>
        <div className="border border-slate-100 rounded-2xl bg-white overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {/* Always show the root admin */}
          <div className="p-4 flex items-center justify-between bg-blue-50/20">
            <div className="flex items-center gap-3 text-left">
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
            <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0">
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
                <div className="flex items-center gap-3 text-left min-w-0">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase shrink-0", userObj.disabled ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
                    {userObj.email.substring(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-xs font-bold truncate transition-all", userObj.disabled ? "text-slate-400 line-through decoration-slate-300" : "text-slate-900")}>
                      {userObj.email}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate">
                      Added by {userObj.addedBy || 'System Admin'} on {userObj.addedAt ? new Date(userObj.addedAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
  );
};
