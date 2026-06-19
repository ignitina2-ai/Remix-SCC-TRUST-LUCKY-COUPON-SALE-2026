import React, { useState } from 'react';
import { Shield, Plus, Trash2, Check, X, ShieldAlert, BadgeCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AllowedUser {
  email: string;
  role: 'Super Admin' | 'Helper Admin' | 'Secretary';
  status: 'ACTIVE' | 'DISABLED';
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  addedAt: string;
  addedBy: string;
}

interface AdminSettingsProps {
  user: { email: string; displayName: string; photoURL?: string } | null;
  allowedUsers: AllowedUser[];
  onAddAllowedUser: (email: string, role: AllowedUser['role'], perms: { canAdd: boolean; canEdit: boolean; canDelete: boolean }) => Promise<void>;
  onToggleAllowedUserDisabled: (email: string, currentStatus: AllowedUser['status']) => Promise<void>;
  onUpdateAllowedUserPermission: (email: string, field: 'canAdd' | 'canEdit' | 'canDelete', val: boolean) => Promise<void>;
  setUserToRevoke: (email: string | null) => void;
  showNotification: (type: 'success' | 'error', text: string) => void;
}

export function AdminSettings({
  user,
  allowedUsers,
  onAddAllowedUser,
  onToggleAllowedUserDisabled,
  onUpdateAllowedUserPermission,
  setUserToRevoke,
  showNotification,
}: AdminSettingsProps) {
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'Super Admin' | 'Helper Admin' | 'Secretary'>('Helper Admin');
  const [perms, setPerms] = useState({ canAdd: true, canEdit: true, canDelete: false });
  const [isAdding, setIsAdding] = useState(false);

  // Since the admin setting page is now allowed for all active authorized users, we set isPrimary to true
  const isPrimary = true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailToRegister = newEmail.trim().toLowerCase();
    if (!emailToRegister) return;
    if (!emailToRegister.includes('@')) {
      showNotification('error', 'Please enter a valid email address.');
      return;
    }

    if (emailToRegister === 'ignitina2@gmail.com') {
      showNotification('error', 'The primary admin is registered implicitly other than manually.');
      return;
    }

    if (allowedUsers.some(u => u.email === emailToRegister)) {
      showNotification('error', 'This email address is already listed in the allowed users registry.');
      return;
    }

    setIsAdding(true);
    try {
      await onAddAllowedUser(emailToRegister, newRole, perms);
      showNotification('success', `Success! Registered "${emailToRegister}" as an administrator.`);
      setNewEmail('');
      setPerms({ canAdd: true, canEdit: true, canDelete: false });
    } catch (err) {
      showNotification('error', 'Failed to register the new admin user. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-left">
          <div className="bg-blue-50 p-2.5 rounded-2xl text-blue-600">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 leading-tight">Trust Admin Team & Permissions</h3>
            <p className="text-slate-500 text-xs font-semibold mt-0.5">Control other user emails allowed to log in and update the coupon database</p>
          </div>
        </div>

        {/* Informative info bubble */}
        <div className="self-start sm:self-center">
          <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
            Main Admin: ignitina2@gmail.com
          </span>
        </div>
      </div>

      {isPrimary ? (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end text-left">
          <div className="md:col-span-4 space-y-1 col-span-1">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Email Address to Allow</label>
            <input
              type="email"
              required
              placeholder="e.g. couponhelper@gmail.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 shadow-sm transition-colors placeholder:text-slate-400"
            />
          </div>

          <div className="md:col-span-3 space-y-1 col-span-1">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Default Role</label>
            <select
              value={newRole}
              onChange={(e) => {
                const roleValue = e.target.value as AllowedUser['role'];
                setNewRole(roleValue);
                if (roleValue === 'Super Admin') {
                  setPerms({ canAdd: true, canEdit: true, canDelete: true });
                } else if (roleValue === 'Helper Admin') {
                  setPerms({ canAdd: true, canEdit: true, canDelete: false });
                } else {
                  setPerms({ canAdd: true, canEdit: false, canDelete: false });
                }
              }}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 shadow-sm transition-colors cursor-pointer"
            >
              <option value="Super Admin">Super Admin (All Access)</option>
              <option value="Helper Admin">Helper Admin (Add & Edit)</option>
              <option value="Secretary">Secretary (Add Only)</option>
            </select>
          </div>

          <div className="md:col-span-3 space-y-1 col-span-1">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">Explicit Actions</label>
            <div className="flex gap-1 items-center h-8.5 select-none">
              <label className="inline-flex items-center gap-1 text-[9px] font-black cursor-pointer bg-white px-2 py-1 rounded-md border border-slate-200 shrink-0">
                <input
                  type="checkbox"
                  checked={perms.canAdd}
                  disabled={newRole === 'Super Admin'}
                  onChange={(e) => setPerms(prev => ({ ...prev, canAdd: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                />
                ADD
              </label>
              <label className="inline-flex items-center gap-1 text-[9px] font-black cursor-pointer bg-white px-2 py-1 rounded-md border border-slate-200 shrink-0">
                <input
                  type="checkbox"
                  checked={perms.canEdit}
                  disabled={newRole === 'Super Admin'}
                  onChange={(e) => setPerms(prev => ({ ...prev, canEdit: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                />
                EDIT
              </label>
              <label className="inline-flex items-center gap-1 text-[9px] font-black cursor-pointer bg-white px-2 py-1 rounded-md border border-slate-200 shrink-0">
                <input
                  type="checkbox"
                  checked={perms.canDelete}
                  disabled={newRole === 'Super Admin'}
                  onChange={(e) => setPerms(prev => ({ ...prev, canDelete: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                />
                DEL
              </label>
            </div>
          </div>

          <div className="md:col-span-2 col-span-1 flex items-center justify-end h-8.5">
            <button
              type="submit"
              disabled={isAdding}
              className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black tracking-wide flex items-center justify-center gap-1 shadow-md shadow-blue-500/5 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus size={12} />
              <span>USER</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl text-left flex items-start gap-3">
          <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={16} />
          <div className="space-y-0.5">
            <p className="text-xs font-black text-amber-900">Permission Management Locked</p>
            <p className="text-[10px] text-amber-700 leading-relaxed font-semibold">
              You are currently logged in as a secondary administrator. Only the primary developer main administrator (<strong className="font-extrabold text-slate-800">ignitina2@gmail.com</strong>) has access authorization to grant, revoke, or modify permissions for other parish registry helpers.
            </p>
          </div>
        </div>
      )}

      {/* Allowed Users List Table */}
      <div className="border border-slate-100 rounded-3xl overflow-hidden bg-slate-50/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 select-none font-bold text-[10px] uppercase tracking-wider">
                <th className="px-6 py-4">Helper Email Address</th>
                <th className="px-6 py-4">Assigned Role</th>
                <th className="px-6 py-4">Login Status</th>
                <th className="px-6 py-4 text-center">Permitted Actions</th>
                {isPrimary && <th className="px-6 py-4 text-center">Revoke Access</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Implicit Primary Admin is always active */}
              <tr className="bg-white hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-extrabold text-slate-950 flex items-center gap-1.5">
                    ignitina2@gmail.com
                    <BadgeCheck size={14} className="text-blue-500" />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="bg-blue-100 text-blue-800 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                    Primary Owner
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    ACTIVE INDEFINITELY
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="inline-flex gap-1">
                    <span className="bg-slate-100 text-slate-700 text-[9px] font-black px-1.5 py-0.5 rounded-lg">ADD</span>
                    <span className="bg-slate-100 text-slate-700 text-[9px] font-black px-1.5 py-0.5 rounded-lg">EDIT</span>
                    <span className="bg-slate-100 text-slate-700 text-[9px] font-black px-1.5 py-0.5 rounded-lg">DEL</span>
                  </div>
                </td>
                {isPrimary && <td className="px-6 py-4 text-center text-slate-400 font-bold text-[10px]">—</td>}
              </tr>

              {allowedUsers.length === 0 ? (
                <tr>
                  <td colSpan={isPrimary ? 5 : 4} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No secondary administrators are registered yet. All logged-in Google users besides the primary owner will be blocked until listed above!
                  </td>
                </tr>
              ) : (
                allowedUsers.map((userObj) => (
                  <tr key={userObj.email} className="bg-white hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{userObj.email}</div>
                      <div className="text-[9px] text-slate-400 font-bold">Added {new Date(userObj.addedAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                        userObj.role === 'Super Admin' 
                          ? "bg-purple-100 text-purple-700" 
                          : userObj.role === 'Helper Admin'
                            ? "bg-slate-100 text-slate-700"
                            : "bg-amber-100 text-amber-700"
                      )}>
                        {userObj.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {isPrimary ? (
                        <button
                          type="button"
                          onClick={() => onToggleAllowedUserDisabled(userObj.email, userObj.status)}
                          className={cn(
                            "cursor-pointer select-none text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1.5 transition-colors",
                            userObj.status === 'ACTIVE'
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-100"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-100"
                          )}
                          title="Click to toggle status"
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full", userObj.status === 'ACTIVE' ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                          {userObj.status}
                        </button>
                      ) : (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                          userObj.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", userObj.status === 'ACTIVE' ? "bg-emerald-500" : "bg-slate-400")} />
                          {userObj.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-center items-center">
                        <button
                          type="button"
                          disabled={!isPrimary || userObj.role === 'Super Admin'}
                          onClick={() => onUpdateAllowedUserPermission(userObj.email, 'canAdd', !userObj.canAdd)}
                          className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded-lg border cursor-pointer select-none transition-colors",
                            userObj.canAdd 
                              ? "bg-blue-50 text-blue-700 border-blue-100" 
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          )}
                        >
                          ADD
                        </button>
                        <button
                          type="button"
                          disabled={!isPrimary || userObj.role === 'Super Admin'}
                          onClick={() => onUpdateAllowedUserPermission(userObj.email, 'canEdit', !userObj.canEdit)}
                          className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded-lg border cursor-pointer select-none transition-colors",
                            userObj.canEdit 
                              ? "bg-blue-50 text-blue-700 border-blue-100" 
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          )}
                        >
                          EDIT
                        </button>
                        <button
                          type="button"
                          disabled={!isPrimary || userObj.role === 'Super Admin'}
                          onClick={() => onUpdateAllowedUserPermission(userObj.email, 'canDelete', !userObj.canDelete)}
                          className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded-lg border cursor-pointer select-none transition-colors",
                            userObj.canDelete 
                              ? "bg-blue-50 text-blue-700 border-blue-100" 
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          )}
                        >
                          DEL
                        </button>
                      </div>
                    </td>
                    {isPrimary && (
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setUserToRevoke(userObj.email)}
                          className="text-slate-400 hover:text-rose-600 transition-colors bg-transparent border-0 cursor-pointer p-1"
                          title="Revoke access immediately"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
