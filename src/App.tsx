/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Menu, X, Cloud, CloudOff, LogIn, LogOut, AlertCircle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import CreditManagement from './components/CreditManagement';
import SponsorsList from './components/SponsorsList';
import IncomeExpenseManagement from './components/IncomeExpenseManagement';
import SecretaryHandoverManagement from './components/SecretaryHandoverManagement';
import Settings from './components/Settings';
import { AppData, Transaction, Sponsor, IncomeExpense, CreditSettings, SecretaryHandover, PaymentMethod, DEFAULT_PAYMENT_LABELS, CustomPaymentMethod, getDefaultPaymentMethodsList } from './types';
import { cn, cleanUndefined } from './lib/utils';
import { sendNotification, requestNotificationPermission } from './lib/notifications';
import { Bell, BellRing } from 'lucide-react';

// Firebase Integrations
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';

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
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [editingEntry, setEditingEntry] = useState<IncomeExpense | null>(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [appData, setAppData] = useState<AppData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const defaultData: AppData = { 
      transactions: [], 
      sponsors: [], 
      incomeExpenses: [], 
      secretaryHandovers: [],
      logo: '', 
      notificationsEnabled: false,
      creditSettings: DEFAULT_CREDIT_SETTINGS,
      customPaymentLabels: DEFAULT_PAYMENT_LABELS
    };
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...defaultData, 
          ...parsed,
          secretaryHandovers: parsed.secretaryHandovers || [],
          creditSettings: parsed.creditSettings || DEFAULT_CREDIT_SETTINGS,
          customPaymentLabels: parsed.customPaymentLabels || DEFAULT_PAYMENT_LABELS
        };
      } catch (e) {
        console.error("Failed to parse saved data", e);
        return defaultData;
      }
    }
    return defaultData;
  });

  // User state integration
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<{ message: string; code?: string } | null>(null);
  const [allowedUsers, setAllowedUsers] = useState<{ email: string; addedAt?: string; addedBy?: string }[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const isPrimaryAdmin = !!(user && user.email && (
    user.email.toLowerCase() === 'ignitina2@gmail.com' ||
    user.email.toLowerCase() === 'ignitina2@gmail.com'
  ));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const isSuperAdmin = currentUser.email && (
          currentUser.email.toLowerCase() === 'ignitina2@gmail.com' ||
          currentUser.email.toLowerCase() === 'ignitina2@gmail.com'
        );

        if (isSuperAdmin) {
          setUser(currentUser);
          setAuthLoading(false);
        } else {
          setAuthLoading(true);
          const cleanEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
          try {
            const docSnap = await getDoc(doc(db, 'allowedUsers', cleanEmail));
            if (docSnap.exists()) {
              setUser(currentUser);
            } else {
              await signOut(auth);
              setUser(null);
              setAuthError({
                message: `Access Denied: The Google Account (${currentUser.email}) is not on the allowed users directory. Please contact the administrator.`
              });
            }
          } catch (err: any) {
            console.error("Checking allowed users directory failed:", err);
            await signOut(auth);
            setUser(null);
            setAuthError({
              message: `Verification failed. Could not verify login permission, please check your network.`
            });
          } finally {
            setAuthLoading(false);
          }
        }
      } else {
        setUser(null);
        setAuthLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Synchronize localStorage data to Firestore when user logs in (Internet restored/session started)
  useEffect(() => {
    if (!user) return;

    const syncLocalToCloud = async () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      try {
        const parsed = JSON.parse(saved) as AppData;
        let syncedCount = 0;
        
        // 1. Sync any local transactions
        if (parsed.transactions && parsed.transactions.length > 0) {
          for (const tx of parsed.transactions) {
            await setDoc(doc(db, 'transactions', tx.id), cleanUndefined(tx));
            syncedCount++;
          }
        }

        // 2. Sync any local sponsors
        if (parsed.sponsors && parsed.sponsors.length > 0) {
          for (const sp of parsed.sponsors) {
            await setDoc(doc(db, 'sponsors', sp.id), cleanUndefined(sp));
            syncedCount++;
          }
        }

        // 3. Sync any local incomeExpenses
        if (parsed.incomeExpenses && parsed.incomeExpenses.length > 0) {
          for (const ie of parsed.incomeExpenses) {
            await setDoc(doc(db, 'incomeExpenses', ie.id), cleanUndefined(ie));
            syncedCount++;
          }
        }

        // 4. Sync secretaryHandovers
        if (parsed.secretaryHandovers && parsed.secretaryHandovers.length > 0) {
          for (const hv of parsed.secretaryHandovers) {
            await setDoc(doc(db, 'secretaryHandovers', hv.id), cleanUndefined(hv));
            syncedCount++;
          }
        }

        if (syncedCount > 0) {
          // Clear local storage list arrays cleanly since they are successfully synchronized to the Cloud!
          const cleanData: AppData = {
            ...parsed,
            transactions: [],
            sponsors: [],
            incomeExpenses: [],
            secretaryHandovers: []
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanData));
          console.log(`Successfully synced ${syncedCount} offline records from local storage to Firestore!`);
        }
      } catch (e) {
        console.error("Failed to sync offline local storage data to Cloud:", e);
      }
    };

    syncLocalToCloud();
  }, [user]);

  // Subscribe to allowedUsers changes in real-time (Admins only!)
  useEffect(() => {
    if (!user) {
      setAllowedUsers([]);
      return;
    }
    const isSuperAdmin = user.email && (
      user.email.toLowerCase() === 'ignitina2@gmail.com' ||
      user.email.toLowerCase() === 'ignitina2@gmail.com'
    );
    if (!isSuperAdmin) {
      setAllowedUsers([]);
      return;
    }

    const unsubAllowed = onSnapshot(collection(db, 'allowedUsers'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push(d.data());
      });
      setAllowedUsers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'allowedUsers');
    });

    return () => unsubAllowed();
  }, [user]);

  const addAllowedUser = async (email: string) => {
    if (!user) return;
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return;
    try {
      await setDoc(doc(db, 'allowedUsers', cleanEmail), {
        email: cleanEmail,
        addedAt: new Date().toISOString(),
        addedBy: user.email || 'Admin'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `allowedUsers/${cleanEmail}`);
    }
  };

  const deleteAllowedUser = async (email: string) => {
    if (!user) return;
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return;
    try {
      await deleteDoc(doc(db, 'allowedUsers', cleanEmail));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `allowedUsers/${cleanEmail}`);
    }
  };

  // Auto-dismiss auth error after 7 seconds
  useEffect(() => {
    if (authError) {
      if (authError.code === 'auth/unauthorized-domain') return;
      const timer = setTimeout(() => {
        setAuthError(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [authError]);



  // Reset scroll to top on tab change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [activeTab]);

  // Google Login and Logout
  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Google authentication failed:", error);
      const errCode = error?.code || '';
      const errMsg = error?.message || 'Verification failed. Please try again.';
      
      if (errCode === 'auth/popup-closed-by-user') {
        setAuthError({
          code: errCode,
          message: 'The Google sign-in window was closed before completing auth. Please keep the popup window open and select your Google identity.'
        });
      } else if (errCode === 'auth/cancelled-popup-request') {
        setAuthError({
          code: errCode,
          message: 'Sign-in setup started again. Please complete authorization in the popup window.'
        });
      } else if (errCode === 'auth/popup-blocked') {
        setAuthError({
          code: errCode,
          message: 'The sign-in popup was blocked by your browser. Please permit popups or shift to a standard browser tab to connect cloud sync.'
        });
      } else if (errCode === 'auth/unauthorized-domain' || (errMsg && errMsg.includes('auth/unauthorized-domain'))) {
        setAuthError({
          code: 'auth/unauthorized-domain',
          message: `This domain (${window.location.hostname}) is not authorized for Google Sign-In in your Firebase Console. To fix this, please: 1. Go to your Firebase Console. 2. Navigate to Authentication > Settings > Authorized domains. 3. Click 'Add domain' and paste: "${window.location.hostname}"`
        });
      } else {
        setAuthError({
          code: errCode,
          message: errMsg
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Up-sync local state elements to Firestore cloud manually
  const handleSyncLocalToCloud = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    try {
      for (const t of appData.transactions) {
        await setDoc(doc(db, 'transactions', t.id), t);
      }
      for (const s of appData.sponsors) {
        await setDoc(doc(db, 'sponsors', s.id), s);
      }
      for (const e of appData.incomeExpenses || []) {
        await setDoc(doc(db, 'incomeExpenses', e.id), e);
      }
      for (const h of appData.secretaryHandovers || []) {
        await setDoc(doc(db, 'secretaryHandovers', h.id), h);
      }
      
      const settingsObj = {
        id: 'appSettings',
        logo: appData.logo || '',
        notificationsEnabled: !!appData.notificationsEnabled,
        creditSettings: appData.creditSettings || DEFAULT_CREDIT_SETTINGS,
        customPaymentLabels: appData.customPaymentLabels || DEFAULT_PAYMENT_LABELS,
        paymentMethodsList: appData.paymentMethodsList || []
      };
      await setDoc(doc(db, 'settings', 'appSettings'), settingsObj);
      return true;
    } catch (err) {
      console.error("Offline upload migration failed: ", err);
      return false;
    }
  };

  // Firestore Real-Time Subscriptions when logged in
  useEffect(() => {
    if (!user) return;

    // Listen to Transactions
    const unsubTx = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((d) => {
        txs.push(d.data() as Transaction);
      });
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAppData(prev => ({ ...prev, transactions: txs }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    // Listen to Sponsors
    const unsubSponsors = onSnapshot(collection(db, 'sponsors'), (snapshot) => {
      const sps: Sponsor[] = [];
      snapshot.forEach((d) => {
        sps.push(d.data() as Sponsor);
      });
      setAppData(prev => ({ ...prev, sponsors: sps }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sponsors');
    });

    // Listen to Income & Expenses
    const unsubIE = onSnapshot(collection(db, 'incomeExpenses'), (snapshot) => {
      const ies: IncomeExpense[] = [];
      snapshot.forEach((d) => {
        ies.push(d.data() as IncomeExpense);
      });
      ies.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAppData(prev => ({ ...prev, incomeExpenses: ies }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'incomeExpenses');
    });

    // Listen to Secretary Handovers
    const unsubHandovers = onSnapshot(collection(db, 'secretaryHandovers'), (snapshot) => {
      const hvs: SecretaryHandover[] = [];
      snapshot.forEach((d) => {
        hvs.push(d.data() as SecretaryHandover);
      });
      hvs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAppData(prev => ({ ...prev, secretaryHandovers: hvs }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'secretaryHandovers');
    });

    // Listen to settings/appSettings document
    const unsubSettings = onSnapshot(doc(db, 'settings', 'appSettings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAppData(prev => ({
          ...prev,
          logo: data.logo ?? prev.logo,
          notificationsEnabled: data.notificationsEnabled ?? prev.notificationsEnabled,
          creditSettings: data.creditSettings ?? prev.creditSettings,
          customPaymentLabels: data.customPaymentLabels ?? prev.customPaymentLabels,
          paymentMethodsList: data.paymentMethodsList ?? prev.paymentMethodsList
        }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/appSettings');
    });

    return () => {
      unsubTx();
      unsubSponsors();
      unsubIE();
      unsubHandovers();
      unsubSettings();
    };
  }, [user]);

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

  // Save to local storage whenever appData changes (acts as robust hybrid backup cache!)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }, [appData]);

  // Expose setActiveTab to window for dashboard quick actions
  useEffect(() => {
    (window as any).setActiveTab = setActiveTab;
    return () => { delete (window as any).setActiveTab; };
  }, []);

  // Handle window resize for sidebar
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

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: crypto.randomUUID(),
    };
    if (user) {
      try {
        await setDoc(doc(db, 'transactions', newTransaction.id), cleanUndefined(newTransaction));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `transactions/${newTransaction.id}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        transactions: [newTransaction, ...prev.transactions],
      }));
    }

    if (appData.notificationsEnabled) {
      sendNotification('New Transaction Added', {
        body: `${newTransaction.name} - ₹${newTransaction.totalAmount.toLocaleString('en-IN')}`,
      });
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (user) {
      try {
        await updateDoc(doc(db, 'transactions', id), cleanUndefined(updates));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        transactions: prev.transactions.map(t => t.id === id ? { ...t, ...updates } : t),
      }));
    }
  };

  const deleteTransaction = async (ids: string[]) => {
    if (user) {
      try {
        for (const id of ids) {
          await deleteDoc(doc(db, 'transactions', id));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `transactions/${ids.join(',')}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        transactions: prev.transactions.filter(t => !ids.includes(t.id)),
      }));
    }
  };

  const toggleTreasurer = async (id: string) => {
    const currentTx = appData.transactions.find(t => t.id === id);
    if (!currentTx) return;
    const paidToTreasurer = !currentTx.paidToTreasurer;
    const treasurerPaidDate = paidToTreasurer ? new Date().toISOString() : undefined;

    if (user) {
      try {
        await updateDoc(doc(db, 'transactions', id), {
          paidToTreasurer,
          treasurerPaidDate: treasurerPaidDate || null
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        transactions: prev.transactions.map(t => 
          t.id === id 
            ? { 
                ...t, 
                paidToTreasurer,
                treasurerPaidDate
              } 
            : t
        ),
      }));
    }
  };

  const addSponsor = async (sponsor: Omit<Sponsor, 'id'>) => {
    const newSponsor: Sponsor = {
      ...sponsor,
      id: crypto.randomUUID(),
    };
    if (user) {
      try {
        await setDoc(doc(db, 'sponsors', newSponsor.id), cleanUndefined(newSponsor));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `sponsors/${newSponsor.id}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        sponsors: [newSponsor, ...prev.sponsors],
      }));
    }

    if (appData.notificationsEnabled) {
      sendNotification('New Sponsor Added', {
        body: `${newSponsor.name} - ₹${newSponsor.amount.toLocaleString('en-IN')}`,
      });
    }
  };

  const updateSponsor = async (id: string, updates: Partial<Sponsor>) => {
    const oldSponsor = appData.sponsors.find(s => s.id === id);
    if (user) {
      try {
        await updateDoc(doc(db, 'sponsors', id), cleanUndefined(updates));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `sponsors/${id}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        sponsors: prev.sponsors.map(s => s.id === id ? { ...s, ...updates } : s),
      }));
    }

    if (appData.notificationsEnabled && updates.status === 'COLLECTED' && oldSponsor?.status !== 'COLLECTED') {
      sendNotification('Sponsor Payment Collected', {
        body: `${oldSponsor?.name} - ₹${oldSponsor?.amount.toLocaleString('en-IN')}`,
      });
    }
  };

  const deleteSponsor = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'sponsors', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `sponsors/${id}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        sponsors: prev.sponsors.filter(s => s.id !== id),
      }));
    }
  };

  const addIncomeExpense = async (entry: Omit<IncomeExpense, 'id'>) => {
    const newEntry: IncomeExpense = {
      ...entry,
      id: crypto.randomUUID(),
    };
    if (user) {
      try {
        await setDoc(doc(db, 'incomeExpenses', newEntry.id), cleanUndefined(newEntry));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `incomeExpenses/${newEntry.id}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        incomeExpenses: [newEntry, ...(prev.incomeExpenses || [])],
      }));
    }

    if (appData.notificationsEnabled) {
      sendNotification(`New ${newEntry.type.toLowerCase()} Added`, {
        body: `${newEntry.description} - ₹${newEntry.amount.toLocaleString('en-IN')}`,
      });
    }
  };

  const updateIncomeExpense = async (id: string, updates: Partial<IncomeExpense>) => {
    if (user) {
      try {
        await updateDoc(doc(db, 'incomeExpenses', id), cleanUndefined(updates));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `incomeExpenses/${id}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        incomeExpenses: (prev.incomeExpenses || []).map(e => e.id === id ? { ...e, ...updates } : e),
      }));
    }
  };

  const deleteIncomeExpense = async (ids: string[]) => {
    if (user) {
      try {
        for (const id of ids) {
          await deleteDoc(doc(db, 'incomeExpenses', id));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `incomeExpenses/${ids.join(',')}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        incomeExpenses: (prev.incomeExpenses || []).filter(e => !ids.includes(e.id)),
      }));
    }
  };

  const addSecretaryHandover = async (handover: Omit<SecretaryHandover, 'id'>) => {
    const newHandover: SecretaryHandover = {
      ...handover,
      id: crypto.randomUUID(),
    };
    if (user) {
      try {
        await setDoc(doc(db, 'secretaryHandovers', newHandover.id), cleanUndefined(newHandover));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `secretaryHandovers/${newHandover.id}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        secretaryHandovers: [newHandover, ...(prev.secretaryHandovers || [])],
      }));
    }

    if (appData.notificationsEnabled) {
      sendNotification('Cash Handed Over', {
        body: `${newHandover.name} - ₹${newHandover.amount.toLocaleString('en-IN')}`,
      });
    }
  };

  const updateSecretaryHandover = async (id: string, updates: Partial<SecretaryHandover>) => {
    if (user) {
      try {
        await updateDoc(doc(db, 'secretaryHandovers', id), cleanUndefined(updates));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `secretaryHandovers/${id}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        secretaryHandovers: (prev.secretaryHandovers || []).map(h => h.id === id ? { ...h, ...updates } : h),
      }));
    }
  };

  const deleteSecretaryHandover = async (ids: string[]) => {
    if (user) {
      try {
        for (const id of ids) {
          await deleteDoc(doc(db, 'secretaryHandovers', id));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `secretaryHandovers/${ids.join(',')}`);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        secretaryHandovers: (prev.secretaryHandovers || []).filter(h => !ids.includes(h.id)),
      }));
    }
  };

  const updateLogo = async (logo: string) => {
    if (user) {
      try {
        await setDoc(doc(db, 'settings', 'appSettings'), { logo }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `settings/appSettings`);
      }
    } else {
      setAppData(prev => ({ ...prev, logo }));
    }
  };

  const updateCreditSettings = async (settings: CreditSettings) => {
    if (user) {
      try {
        await setDoc(doc(db, 'settings', 'appSettings'), { creditSettings: settings }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `settings/appSettings`);
      }
    } else {
      setAppData(prev => ({ ...prev, creditSettings: settings }));
    }
  };

  const updatePaymentLabels = async (labels: Record<PaymentMethod, string>) => {
    if (user) {
      try {
        await setDoc(doc(db, 'settings', 'appSettings'), { customPaymentLabels: labels }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `settings/appSettings`);
      }
    } else {
      setAppData(prev => ({ ...prev, customPaymentLabels: labels }));
    }
  };

  const updatePaymentMethodsList = async (list: CustomPaymentMethod[]) => {
    if (user) {
      try {
        await setDoc(doc(db, 'settings', 'appSettings'), { paymentMethodsList: list }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `settings/appSettings`);
      }
    } else {
      setAppData(prev => ({ ...prev, paymentMethodsList: list }));
    }
  };

  const toggleAllowedUserDisabled = async (email: string, disabled: boolean) => {
    if (!user) return;
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return;
    try {
      await updateDoc(doc(db, 'allowedUsers', cleanEmail), {
        disabled
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `allowedUsers/${cleanEmail}`);
    }
  };

  const toggleNotifications = async (enabled: boolean) => {
    if (user) {
      try {
        await setDoc(doc(db, 'settings', 'appSettings'), { notificationsEnabled: enabled }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `settings/appSettings`);
      }
    } else {
      setAppData(prev => ({ ...prev, notificationsEnabled: enabled }));
    }
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

  const clearData = () => {
    setAppData({ transactions: [], sponsors: [], incomeExpenses: [], secretaryHandovers: [], logo: '', notificationsEnabled: false });
    setActiveTab('dashboard');
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
          />
        );
      case 'sponsors':
        return (
          <SponsorsList 
            sponsors={appData.sponsors} 
            onAddSponsor={addSponsor}
            onUpdateSponsor={updateSponsor}
            onDeleteSponsor={deleteSponsor}
          />
        );
      case 'income-expense':
        return (
          <IncomeExpenseManagement 
            entries={appData.incomeExpenses}
            onAddEntry={addIncomeExpense}
            onUpdateEntry={updateIncomeExpense}
            onDeleteEntry={deleteIncomeExpense}
          />
        );
      case 'secretary-handover':
        return (
          <SecretaryHandoverManagement 
            handovers={appData.secretaryHandovers}
            onAddHandover={addSecretaryHandover}
            onUpdateHandover={updateSecretaryHandover}
            onDeleteHandover={deleteSecretaryHandover}
          />
        );
      case 'settings':
        if (!isPrimaryAdmin) {
          return (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4 max-w-xl mx-auto my-12">
              <div className="bg-rose-50 p-4 rounded-full text-rose-500">
                <AlertCircle size={40} className="stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Access Denied</h3>
              <p className="text-slate-500 text-sm font-semibold max-w-sm leading-relaxed">
                Only the Primary System Administrator has permission to access the Settings, allowed helper directory, and database controls.
              </p>
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95"
              >
                Go to Dashboard
              </button>
            </div>
          );
        }
        return (
          <Settings 
            appData={appData}
            onUpdateLogo={updateLogo}
            onBackup={backupData}
            onRestore={restoreData}
            onClearData={clearData}
            onToggleNotifications={toggleNotifications}
            onUpdatePaymentLabels={updatePaymentLabels}
            onUpdatePaymentMethodsList={updatePaymentMethodsList}
            user={user}
            onGoogleLogin={handleGoogleLogin}
            onGoogleLogout={handleGoogleLogout}
            onSyncLocalToCloud={handleSyncLocalToCloud}
            allowedUsers={allowedUsers}
            onAddAllowedUser={addAllowedUser}
            onDeleteAllowedUser={deleteAllowedUser}
            onToggleAllowedUserDisabled={toggleAllowedUserDisabled}
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        user={user}
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
            className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
          >
            {appData.logo ? (
              <img src={appData.logo} alt="Logo" className="w-6 h-6 object-contain" />
            ) : (
              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-[10px] shrink-0">C</div>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 text-xs tracking-tight uppercase">ST.CASIMIR CHARITABLE TRUST</span>
              <span className="text-[9px] font-semibold text-blue-600 tracking-wider">SCC TRUST LUCKY COUPON SALE 2026</span>
            </div>
          </button>
          
          <div className="flex items-center gap-2">
            {user ? (
              <button
                onClick={handleGoogleLogout}
                title={`Cloud Connected: ${user.displayName || user.email}`}
                className="w-7 h-7 rounded-full border border-emerald-300 overflow-hidden shrink-0 shadow-sm"
              >
                <img src={user.photoURL || "https://picsum.photos/seed/admin/100/100"} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              </button>
            ) : (
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="p-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black tracking-wide shrink-0 transition-all active:scale-95 shadow-sm hover:scale-105 disabled:opacity-50"
              >
                {isLoggingIn ? 'Syncing...' : 'Cloud Sync'}
              </button>
            )}
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
            className="flex items-center gap-4 hover:opacity-80 transition-opacity text-left"
          >
            {appData.logo ? (
              <img src={appData.logo} alt="Logo" className="w-10 h-10 object-contain rounded-lg shadow-sm" />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">C</div>
            )}
            <div className="flex flex-col">
              <h2 className="text-base font-black text-slate-900 tracking-tight">ST.CASIMIR CHARITABLE TRUST</h2>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-0.5">SCC TRUST LUCKY COUPON SALE 2026</p>
            </div>
          </button>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Income & Expense Balance</p>
              <p className="text-lg font-black text-slate-900">
                ₹{(
                  // Income and Expense collections only
                  (appData.incomeExpenses || [])
                    .filter(e => e.type === 'INCOME')
                    .reduce((acc, e) => acc + e.amount, 0) -
                  (appData.incomeExpenses || [])
                    .filter(e => e.type === 'EXPENSE')
                    .reduce((acc, e) => acc + e.amount, 0)
                ).toLocaleString('en-IN')}
              </p>
            </div>

            {user ? (
              <div className="flex items-center gap-3 bg-white border border-slate-100 shadow-sm pl-4 pr-1.5 py-1 rounded-2xl">
                <div className="text-right">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center justify-end gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Cloud Connected
                  </p>
                  <p className="text-[11px] font-bold text-slate-700 max-w-[120px] truncate">{user.displayName || user.email}</p>
                </div>
                <button
                  onClick={handleGoogleLogout}
                  title="Logout Cloud Sync"
                  className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden hover:opacity-80 transition-all shrink-0 relative group shadow-inner"
                >
                  <img src={user.photoURL || "https://picsum.photos/seed/admin/100/100"} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                    <LogOut size={12} className="text-white" />
                  </div>
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black tracking-wide shadow-lg shadow-blue-600/15 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <span className="animate-pulse">Connecting...</span>
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

        {/* Page Content */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto relative">
          {/* Printable formal header */}
          <div className="hidden print:block print-header">
            <div className="flex items-center justify-between border-b pb-2 mb-4 border-slate-900 font-sans">
              <div className="flex items-center gap-3">
                {appData.logo ? (
                  <img src={appData.logo} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
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

      {/* Floating Authentication Error Alert Toast */}
      {authError && (
        <div 
          id="auth-error-toast"
          className="fixed bottom-6 right-6 z-50 max-w-md bg-amber-50 border border-amber-200/80 p-4 rounded-2xl shadow-xl flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-300 font-sans animate-fade-in"
        >
          <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg shrink-0">
            <AlertCircle size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-amber-900 tracking-wider uppercase">Sign-In Notice</h4>
            <p className="text-xs font-semibold text-amber-700 leading-relaxed mt-0.5">{authError.message}</p>
          </div>
          <button 
            onClick={() => setAuthError(null)}
            className="p-1 text-amber-400 hover:text-amber-600 hover:bg-amber-100/50 rounded-lg transition-all shrink-0 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
