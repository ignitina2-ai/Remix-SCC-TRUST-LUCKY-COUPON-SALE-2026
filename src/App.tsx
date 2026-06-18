/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Menu, X, Cloud, CloudOff, AlertCircle, CheckCircle, Bell, BellRing } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import CreditManagement from './components/CreditManagement';
import SponsorsList from './components/SponsorsList';
import IncomeExpenseManagement from './components/IncomeExpenseManagement';
import SecretaryHandoverManagement from './components/SecretaryHandoverManagement';
import Settings from './components/Settings';
import { SplashComponent } from './components/SplashComponent';
import { 
  AppData, 
  Transaction, 
  Sponsor, 
  IncomeExpense, 
  CreditSettings, 
  SecretaryHandover, 
  PaymentMethod, 
  DEFAULT_PAYMENT_LABELS, 
  CustomPaymentMethod, 
  getDefaultPaymentMethodsList 
} from './types';
import { cn } from './lib/utils';
import { sendNotification, requestNotificationPermission } from './lib/notifications';

const STORAGE_KEY = 'coupon_sale_app_data_2026';

const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  reminderEmailTemplate: "Hi {name},\n\nThis is a friendly reminder regarding your outstanding balance of ₹{amount} for the coupons purchased on {date}.\n\nPlease clear the balance at your earliest convenience.\n\nThank you!",
  reminderSMSTemplate: "Hi {name}, reminder for outstanding balance of ₹{amount} for coupons purchased on {date}. Please clear it soon. Thank you!",
  overdueThresholds: [7, 15, 30]
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  // Since we require NO login or authentication, everyone is verified as an active trust admin!
  const [user] = useState<any>({
    email: 'admin@stcasimir.org',
    displayName: 'ST. Casimir Trust Admin',
    photoURL: '',
    isLocal: true,
  });

  const [userPermissions] = useState({
    canAdd: true,
    canEdit: true,
    canDelete: true,
  });

  const isPrimaryAdmin = true; // Complete access to settings, branding, backups

  // Initialize AppData from LocalStorage
  const [appData, setAppData] = useState<AppData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
            sponsors: Array.isArray(parsed.sponsors) ? parsed.sponsors : [],
            incomeExpenses: Array.isArray(parsed.incomeExpenses) ? parsed.incomeExpenses : [],
            secretaryHandovers: Array.isArray(parsed.secretaryHandovers) ? parsed.secretaryHandovers : [],
            logo: typeof parsed.logo === 'string' ? parsed.logo : '',
            logoMobile: typeof parsed.logoMobile === 'string' ? parsed.logoMobile : '',
            logoDesktop: typeof parsed.logoDesktop === 'string' ? parsed.logoDesktop : '',
            notificationsEnabled: !!parsed.notificationsEnabled,
            creditSettings: parsed.creditSettings || DEFAULT_CREDIT_SETTINGS,
            customPaymentLabels: parsed.customPaymentLabels || DEFAULT_PAYMENT_LABELS,
            paymentMethodsList: Array.isArray(parsed.paymentMethodsList) 
              ? parsed.paymentMethodsList 
              : (getDefaultPaymentMethodsList ? getDefaultPaymentMethodsList() : [])
          };
        }
      }
    } catch (e) {
      console.warn("Failed parsing saved coupon sale local storage data:", e);
    }

    return {
      transactions: [],
      sponsors: [],
      incomeExpenses: [],
      secretaryHandovers: [],
      logo: '',
      logoMobile: '',
      logoDesktop: '',
      notificationsEnabled: false,
      creditSettings: DEFAULT_CREDIT_SETTINGS,
      customPaymentLabels: DEFAULT_PAYMENT_LABELS,
      paymentMethodsList: getDefaultPaymentMethodsList ? getDefaultPaymentMethodsList() : []
    };
  });

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const checkNotificationPermission = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        setShowNotificationPrompt(true);
      }
    };
    checkNotificationPermission();
  }, []);

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      toggleNotifications(true);
    }
    setShowNotificationPrompt(false);
  };

  // Keep state updated in premium local storage Hybrid cache whenever it shifts
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }, [appData]);

  // Expose setActiveTab to window for quick actions dashboard trigger lists
  useEffect(() => {
    (window as any).setActiveTab = setActiveTab;
    return () => { delete (window as any).setActiveTab; };
  }, []);

  // Responsive sidebar toggles
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 100% Offline Pure Local State Mutation Handlers
  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: crypto.randomUUID(),
    };
    setAppData(prev => ({
      ...prev,
      transactions: [newTransaction, ...prev.transactions],
    }));

    if (appData.notificationsEnabled) {
      sendNotification('New Transaction Added', {
        body: `${newTransaction.name} - ₹${newTransaction.totalAmount.toLocaleString('en-IN')}`,
      });
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    setAppData(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
  };

  const deleteTransaction = async (ids: string[]) => {
    setAppData(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => !ids.includes(t.id)),
    }));
  };

  const toggleTreasurer = async (id: string) => {
    setAppData(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => {
        if (t.id === id) {
          const paidToTreasurer = !t.paidToTreasurer;
          const treasurerPaidDate = paidToTreasurer ? new Date().toISOString() : undefined;
          return {
            ...t,
            paidToTreasurer,
            treasurerPaidDate
          };
        }
        return t;
      }),
    }));
  };

  const addSponsor = async (sponsor: Omit<Sponsor, 'id'>) => {
    const newSponsor: Sponsor = {
      ...sponsor,
      id: crypto.randomUUID(),
    };
    setAppData(prev => ({
      ...prev,
      sponsors: [newSponsor, ...prev.sponsors],
    }));

    if (appData.notificationsEnabled) {
      sendNotification('New Sponsor Added', {
        body: `${newSponsor.name} - ₹${newSponsor.amount.toLocaleString('en-IN')}`,
      });
    }
  };

  const updateSponsor = async (id: string, updates: Partial<Sponsor>) => {
    const oldSponsor = appData.sponsors.find(s => s.id === id);
    setAppData(prev => ({
      ...prev,
      sponsors: prev.sponsors.map(s => s.id === id ? { ...s, ...updates } : s),
    }));

    if (appData.notificationsEnabled && updates.status === 'COLLECTED' && oldSponsor?.status !== 'COLLECTED') {
      sendNotification('Sponsor Payment Collected', {
        body: `${oldSponsor?.name} - ₹${oldSponsor?.amount.toLocaleString('en-IN')}`,
      });
    }
  };

  const deleteSponsor = async (id: string) => {
    setAppData(prev => ({
      ...prev,
      sponsors: prev.sponsors.filter(s => s.id !== id),
    }));
  };

  const addIncomeExpense = async (entry: Omit<IncomeExpense, 'id'>) => {
    const newEntry: IncomeExpense = {
      ...entry,
      id: crypto.randomUUID(),
    };
    setAppData(prev => ({
      ...prev,
      incomeExpenses: [newEntry, ...(prev.incomeExpenses || [])],
    }));

    if (appData.notificationsEnabled) {
      sendNotification(`New ${newEntry.type.toLowerCase()} Added`, {
        body: `${newEntry.description} - ₹${newEntry.amount.toLocaleString('en-IN')}`,
      });
    }
  };

  const updateIncomeExpense = async (id: string, updates: Partial<IncomeExpense>) => {
    setAppData(prev => ({
      ...prev,
      incomeExpenses: (prev.incomeExpenses || []).map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  };

  const deleteIncomeExpense = async (ids: string[]) => {
    setAppData(prev => ({
      ...prev,
      incomeExpenses: (prev.incomeExpenses || []).filter(e => !ids.includes(e.id)),
    }));
  };

  const addSecretaryHandover = async (handover: Omit<SecretaryHandover, 'id'>) => {
    const newHandover: SecretaryHandover = {
      ...handover,
      id: crypto.randomUUID(),
    };
    setAppData(prev => ({
      ...prev,
      secretaryHandovers: [newHandover, ...(prev.secretaryHandovers || [])],
    }));

    if (appData.notificationsEnabled) {
      sendNotification('Cash Handed Over', {
        body: `${newHandover.name} - ₹${newHandover.amount.toLocaleString('en-IN')}`,
      });
    }
  };

  const updateSecretaryHandover = async (id: string, updates: Partial<SecretaryHandover>) => {
    setAppData(prev => ({
      ...prev,
      secretaryHandovers: (prev.secretaryHandovers || []).map(h => h.id === id ? { ...h, ...updates } : h),
    }));
  };

  const deleteSecretaryHandover = async (ids: string[]) => {
    setAppData(prev => ({
      ...prev,
      secretaryHandovers: (prev.secretaryHandovers || []).filter(h => !ids.includes(h.id)),
    }));
  };

  const updateLogo = async (logo: string) => {
    setAppData(prev => ({ ...prev, logo }));
  };

  const updateLogoMobile = async (logoMobile: string) => {
    setAppData(prev => ({ ...prev, logoMobile }));
  };

  const updateLogoDesktop = async (logoDesktop: string) => {
    setAppData(prev => ({ ...prev, logoDesktop }));
  };

  const updateCreditSettings = async (settings: CreditSettings) => {
    setAppData(prev => ({ ...prev, creditSettings: settings }));
  };

  const updatePaymentLabels = async (labels: Record<PaymentMethod, string>) => {
    setAppData(prev => ({ ...prev, customPaymentLabels: labels }));
  };

  const updatePaymentMethodsList = async (list: CustomPaymentMethod[]) => {
    setAppData(prev => ({ ...prev, paymentMethodsList: list }));
  };

  const toggleNotifications = async (enabled: boolean) => {
    setAppData(prev => ({ ...prev, notificationsEnabled: enabled }));
  };

  const backupData = () => {
    const dataStr = JSON.stringify(appData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `coupon_app_backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const restoreData = (data: AppData) => {
    setAppData(data);
  };

  const clearData = async () => {
    const defaultData: AppData = {
      transactions: [],
      sponsors: [],
      incomeExpenses: [],
      secretaryHandovers: [],
      logo: '',
      logoMobile: '',
      logoDesktop: '',
      notificationsEnabled: false,
      creditSettings: DEFAULT_CREDIT_SETTINGS,
      customPaymentLabels: DEFAULT_PAYMENT_LABELS,
      paymentMethodsList: []
    };
    setAppData(defaultData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
  };

  const renderContent = () => {
    const labels = appData.customPaymentLabels || DEFAULT_PAYMENT_LABELS;
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard 
                 transactions={appData.transactions} 
                 sponsors={appData.sponsors} 
                 incomeExpenses={appData.incomeExpenses} 
                 secretaryHandovers={appData.secretaryHandovers}
                 customPaymentLabels={labels}
                 paymentMethodsList={appData.paymentMethodsList}
                 onDeleteTransaction={deleteTransaction}
                 onToggleTreasurer={toggleTreasurer}
                 onEditTransaction={(t) => {
                   setEditingTransaction(t);
                   setActiveTab('add-transaction');
                 }}
               />;
      case 'add-transaction':
        return (
          <TransactionForm 
            onAddTransaction={addTransaction} 
            editingTransaction={editingTransaction}
            onUpdateTransaction={(id, updates) => {
              updateTransaction(id, updates);
              setEditingTransaction(null);
              setActiveTab('dashboard');
            }}
            onCancelEdit={() => {
              setEditingTransaction(null);
              setActiveTab('dashboard');
            }}
            transactions={appData.transactions}
            onDelete={deleteTransaction}
            onToggleTreasurer={toggleTreasurer}
            onEdit={(t) => {
              setEditingTransaction(t);
              setActiveTab('add-transaction');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            customPaymentLabels={labels}
            paymentMethodsList={appData.paymentMethodsList}
            permissions={userPermissions}
          />
        );
      case 'transactions':
        return (
          <TransactionList 
            transactions={appData.transactions} 
            onDelete={deleteTransaction}
            onToggleTreasurer={toggleTreasurer}
            onEdit={(t) => {
              setEditingTransaction(t);
              setActiveTab('add-transaction');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            customPaymentLabels={labels}
            permissions={userPermissions}
          />
        );
      case 'credit':
        return (
          <CreditManagement 
            transactions={appData.transactions} 
            onUpdateTransaction={updateTransaction}
            onEdit={(t) => {
              setEditingTransaction(t);
              setActiveTab('add-transaction');
            }}
            onDelete={deleteTransaction}
            customPaymentLabels={labels}
            paymentMethodsList={appData.paymentMethodsList}
            permissions={userPermissions}
          />
        );
      case 'sponsors':
        return (
          <SponsorsList 
            sponsors={appData.sponsors} 
            onAddSponsor={addSponsor}
            onUpdateSponsor={updateSponsor}
            onDeleteSponsor={deleteSponsor}
            permissions={userPermissions}
          />
        );
      case 'income-expense':
        return (
          <IncomeExpenseManagement 
            entries={appData.incomeExpenses}
            onAddEntry={addIncomeExpense}
            onUpdateEntry={updateIncomeExpense}
            onDeleteEntry={deleteIncomeExpense}
            permissions={userPermissions}
          />
        );
      case 'secretary-handover':
        return (
          <SecretaryHandoverManagement 
            handovers={appData.secretaryHandovers}
            onAddHandover={addSecretaryHandover}
            onUpdateHandover={updateSecretaryHandover}
            onDeleteHandover={deleteSecretaryHandover}
            transactions={appData.transactions}
            paymentMethodsList={appData.paymentMethodsList}
            customPaymentLabels={labels}
            permissions={userPermissions}
          />
        );
      case 'settings':
        return (
          <Settings 
            appData={appData}
            onUpdateLogo={updateLogo}
            onUpdateLogoMobile={updateLogoMobile}
            onUpdateLogoDesktop={updateLogoDesktop}
            onBackup={backupData}
            onRestore={restoreData}
            onClearData={clearData}
            onToggleNotifications={toggleNotifications}
            onUpdatePaymentLabels={updatePaymentLabels}
            onUpdatePaymentMethodsList={updatePaymentMethodsList}
            user={user}
            allowedUsers={[]}
            activeSessions={[]}
          />
        );
      default:
        return <Dashboard 
                 transactions={appData.transactions} 
                 sponsors={appData.sponsors} 
                 incomeExpenses={appData.incomeExpenses} 
                 secretaryHandovers={appData.secretaryHandovers}
                 customPaymentLabels={labels}
                 paymentMethodsList={appData.paymentMethodsList}
                 onDeleteTransaction={deleteTransaction}
                 onToggleTreasurer={toggleTreasurer}
                 onEditTransaction={(t) => {
                   setEditingTransaction(t);
                   setActiveTab('add-transaction');
                 }}
               />;
    }
  };

  if (showSplash) {
    return (
      <SplashComponent 
        onComplete={() => setShowSplash(false)} 
        appData={appData} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        user={user}
        isPrimaryAdmin={isPrimaryAdmin}
      />

      {/* Main Content */}
      <main className={cn(
        "transition-all duration-300 ease-in-out min-h-screen",
        isSidebarOpen ? "md:ml-64" : "md:ml-20"
      )}>
        {/* Top Header (Mobile Only) */}
        <div className="md:hidden bg-white border-b border-slate-200 p-3 flex items-center justify-between sticky top-0 z-30 font-sans">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left text-slate-950 bg-transparent border-0"
          >
            {appData.logo ? (
              <img src={appData.logo} alt="Logo" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-[10px] shrink-0">C</div>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 text-xs tracking-tight uppercase">ST.CASIMIR CHARITABLE TRUST</span>
              <span className="text-[9px] font-semibold text-blue-600 tracking-wider">SCC TRUST LUCKY COUPON SALE 2026</span>
            </div>
          </button>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>

        {/* Desktop Header (Logo/Title) */}
        <div className="hidden md:flex items-center justify-between px-8 py-6 bg-white/50 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-30 font-sans">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-4 hover:opacity-80 transition-opacity text-left bg-transparent border-0"
          >
            {appData.logo ? (
              <img src={appData.logo} alt="Logo" className="w-10 h-10 object-contain rounded-lg shadow-sm" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">C</div>
            )}
            <div className="flex flex-col">
              <h2 className="text-base font-black text-slate-900 tracking-tight">ST.CASIMIR CHARITABLE TRUST</h2>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-0.5">SCC TRUST LUCKY COUPON SALE 2026</p>
            </div>
          </button>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Income & Expense Balance</p>
              <p className="text-lg font-black text-slate-900">
                ₹{(
                  (appData.incomeExpenses || [])
                    .filter(e => e.type === 'INCOME')
                    .reduce((acc, e) => acc + e.amount, 0) -
                  (appData.incomeExpenses || [])
                    .filter(e => e.type === 'EXPENSE')
                    .reduce((acc, e) => acc + e.amount, 0)
                ).toLocaleString('en-IN')}
              </p>
            </div>

            <div className="flex items-center gap-3 bg-white border border-slate-100 shadow-sm pl-4 pr-1.5 py-1 rounded-2xl">
              <div className="text-right">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center justify-end gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Local Private State
                </p>
                <span className="text-[11px] font-bold text-slate-700 block">{user.displayName}</span>
              </div>
              <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden shrink-0 shadow-inner bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                SC
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto relative animate-fade-in">
          {/* Printable formal header */}
          <div className="hidden print:block print-header">
            <div className="flex items-center justify-between border-b pb-2 mb-4 border-slate-900 font-sans">
              <div className="flex items-center gap-3">
                {appData.logo ? (
                  <img src={appData.logo} alt="Logo" className="w-10 h-10 object-contain rounded-lg" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">C</div>
                )}
                <div className="flex flex-col">
                  <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">ST.CASIMIR CHARITABLE TRUST</h1>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">SCC TRUST LUCKY COUPON SALE 2026</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Report Date</span>
                <span className="text-xs font-black text-slate-800">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {showNotificationPrompt && (
            <div className="mb-6 bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-600/20 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <BellRing className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Enable Push Notifications</h3>
                  <p className="text-blue-100 text-sm font-medium">Get real-time updates for sales and sponsor collections.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={() => setShowNotificationPrompt(false)}
                  className="flex-1 md:flex-none px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm transition-all"
                >
                  Later
                </button>
                <button 
                  onClick={handleRequestPermission}
                  className="flex-1 md:flex-none px-6 py-3 bg-white text-blue-600 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-50 transition-all active:scale-95"
                >
                  Enable Now
                </button>
              </div>
            </div>
          )}
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
