import React from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Users, 
  Settings as SettingsIcon, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  X,
  CreditCard,
  Trophy,
  Banknote,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  user?: any;
  onLogout?: () => void;
  isPrimaryAdmin?: boolean;
  permissions?: {
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
    hideIncomeExpense?: boolean;
    hideSecretaryHandover?: boolean;
  };
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isOpen, 
  setIsOpen, 
  user, 
  onLogout, 
  isPrimaryAdmin = false,
  permissions,
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transaction History', icon: History },
    { id: 'credit', label: 'Credit Management', icon: CreditCard },
    { id: 'income-expense', label: 'Income & Expense', icon: Banknote },
    { id: 'secretary-handover', label: 'Handover to Secretary', icon: Users },
    { id: 'sponsors', label: 'Prize Sponsors', icon: Trophy },
    { id: 'settings', label: 'Settings & Backup', icon: SettingsIcon },
  ].filter((item) => {
    if (item.id === 'income-expense' && permissions?.hideIncomeExpense) {
      return false;
    }
    if (item.id === 'secretary-handover' && permissions?.hideSecretaryHandover) {
      return false;
    }
    if (item.id === 'settings' && !isPrimaryAdmin) {
      return false;
    }
    return true;
  });

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full bg-slate-900 text-white z-50 transition-all duration-300 ease-in-out",
        isOpen ? "w-64" : "w-0 md:w-20 overflow-hidden"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            {isOpen ? (
              <span className="font-bold text-xl tracking-tight">COUPON SALE</span>
            ) : (
              <span className="font-bold text-xl mx-auto">C</span>
            )}
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 hover:bg-slate-800 rounded-md transition-colors"
            >
              {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-2 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 768) setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center p-3 rounded-lg transition-all duration-200",
                  activeTab === item.id 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon size={24} className={cn(isOpen ? "mr-3" : "mx-auto")} />
                {isOpen && <span className="font-medium">{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 space-y-3">
            {onLogout && (
              <button
                onClick={onLogout}
                className={cn(
                  "w-full flex items-center p-2.5 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-200 border border-transparent hover:border-rose-500/20"
                )}
              >
                <LogOut size={20} className={isOpen ? "mr-3 shrink-0" : "mx-auto shrink-0"} />
                {isOpen && <span className="font-semibold text-sm">Sign Out</span>}
              </button>
            )}
            <div className="text-center text-[10px] text-slate-500">
              {isOpen ? "© 2026 Coupon Management, Developed by Ignatious Joshuva" : "v1.0"}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
