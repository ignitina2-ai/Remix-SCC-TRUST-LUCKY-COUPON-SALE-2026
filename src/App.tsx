/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Menu, X, Cloud, CloudOff, AlertCircle, CheckCircle, Bell, BellRing, Loader2, LogOut } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import CreditManagement from './components/CreditManagement';
import SponsorsList from './components/SponsorsList';
import IncomeExpenseManagement from './components/IncomeExpenseManagement';
import TreasuryHandoverManagement from './components/TreasuryHandoverManagement';
import Settings from './components/Settings';
import LoginPage from './components/LoginPage';
import { SplashComponent } from './components/SplashComponent';
import { useActiveResponsiveLogo } from './lib/logo-resolver';
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

// Firebase core modules and standard handlers
import { 
  auth, 
  db, 
  authGoogleProvider,
  driveGoogleProvider,
  googleProvider, 
  OperationType, 
  handleFirestoreError,
  setCachedAccessToken,
  getCachedAccessToken
} from './lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  getDoc,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import { signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { AllowedUser } from './components/settings/AdminSettings';
import { 
  recordTransactionAndBackupToDrive, 
  saveBackupJsonToDrive, 
  syncAllTransactionsToSheet, 
  getOrCreateDriveFolder, 
  getOrCreateCouponSheet,
  syncViaWebhook,
  DriveSyncConfig,
  DEFAULT_WEBHOOK_URL,
  TARGET_DRIVE_EMAIL,
  FOLDER_NAME,
  SHEET_NAME,
  WORKSPACE_SCOPES
} from './lib/googleDriveSheets';

const STORAGE_KEY = 'coupon_sale_app_data_2026';

const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  reminderEmailTemplate: "Hi {name},\n\nThis is a friendly reminder regarding your outstanding balance of ₹{amount} for the coupons purchased on {date}.\n\nPlease clear the balance at your earliest convenience.\n\nThank you!",
  reminderSMSTemplate: "Hi {name}, reminder for outstanding balance of ₹{amount} for coupons purchased on {date}. Please clear it soon. Thank you!",
  overdueThresholds: [7, 15, 30]
};

export default function App() {
  const [activeTab, setActiveTab ] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 : false));
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  // Auth and sync statuses
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(() => getCachedAccessToken());
  const [isDriveAutoSyncEnabled, setIsDriveAutoSyncEnabled] = useState(true);
  const [driveSyncConfig, setDriveSyncConfig] = useState<DriveSyncConfig>({
    autoSyncEnabled: true,
    webhookUrl: DEFAULT_WEBHOOK_URL,
  });

  const [userPermissions, setUserPermissions] = useState({
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canShareReport: true,
    hideIncomeExpense: false,
    hideSecretaryHandover: false,
  });

  const isPrimaryAdminEmail = (email?: string | null) => {
    const e = email?.toLowerCase().trim();
    return e === 'ignitina2@gmail.com' || e === 'stcasimircharitabletrust@gmail.com';
  };

  const isPrimaryAdmin = isPrimaryAdminEmail(user?.email);

  // Expose setActiveTab on window for sub-components to trigger tab switches easily
  useEffect(() => {
    (window as any).setActiveTab = (tab: string) => {
      setActiveTab(tab);
    };
    return () => {
      delete (window as any).setActiveTab;
    };
  }, []);

  // State model
  const [appData, setAppData] = useState<AppData>({
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
  });

  const [showSplash, setShowSplash] = useState(true);
  const { resolvedLogo } = useActiveResponsiveLogo(appData);

  const notificationsEnabledRef = React.useRef(appData.notificationsEnabled);
  useEffect(() => {
    notificationsEnabledRef.current = appData.notificationsEnabled;
  }, [appData.notificationsEnabled]);

  // Synchronize browser favicon and PWA touch icons to the active resolved logo
  useEffect(() => {
    if (resolvedLogo) {
      const iconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (iconLink) {
        iconLink.href = resolvedLogo;
      }
      const appleTouchLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
      if (appleTouchLink) {
        appleTouchLink.href = resolvedLogo;
      }
    }
  }, [resolvedLogo]);

  // Helper to register active session in firestore
  const registerActiveSession = async (firebaseUser: any, userEmail: string, userName: string) => {
    try {
      let tabSessionId = sessionStorage.getItem('app_session_id');
      if (!tabSessionId) {
        tabSessionId = `session_${firebaseUser.uid}_${Date.now()}`;
        sessionStorage.setItem('app_session_id', tabSessionId);
      }
      await setDoc(doc(db, 'activeSessions', tabSessionId), {
        id: tabSessionId,
        uid: firebaseUser.uid,
        email: userEmail,
        displayName: userName,
        photoURL: firebaseUser.photoURL || '',
        lastActive: new Date().toISOString(),
        userAgent: navigator.userAgent,
        device: /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'
      }, { merge: true });
    } catch (err) {
      console.warn("Could not register active session:", err);
    }
  };

  // Authenticated state listener
  useEffect(() => {
    let activeSubscriptions: (() => void)[] = [];

    const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
      // Clean up previous snapshots
      activeSubscriptions.forEach((unsub) => unsub());
      activeSubscriptions = [];

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const email = firebaseUser.email?.toLowerCase().trim() || '';

      // Direct access for primary trust administrators
      if (email === 'ignitina2@gmail.com' || email === 'stcasimircharitabletrust@gmail.com') {
        const dName = firebaseUser.displayName || (email === 'stcasimircharitabletrust@gmail.com' ? 'Trust Administrator' : 'Primary Administrator');
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: dName,
          photoURL: firebaseUser.photoURL || '',
          isLocal: false,
        });
        setUserPermissions({
          canAdd: true,
          canEdit: true,
          canDelete: true,
          canShareReport: true,
          hideIncomeExpense: false,
          hideSecretaryHandover: false,
        });
        setLoading(false);
        setupDbSyncs(true);
        registerActiveSession(firebaseUser, email, dName);
        return;
      }

      // Check allowedUsers whitelist registry for helper sub-users
      try {
        const userDocRef = doc(db, 'allowedUsers', email);
        const serverSnapshot = await getDocFromServer(userDocRef).catch(() => null);
        const snapshot = serverSnapshot || await getDoc(userDocRef);

        if (snapshot.exists() && snapshot.data()?.status === 'ACTIVE') {
          const schema = snapshot.data() as AllowedUser;
          const dName = firebaseUser.displayName || schema.role || 'Authorized Helper';
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: dName,
            photoURL: firebaseUser.photoURL || '',
            isLocal: false,
            role: schema.role,
          });
          setUserPermissions({
            canAdd: schema.canAdd !== false,
            canEdit: schema.canEdit !== false,
            canDelete: schema.canDelete === true,
            canShareReport: schema.canShareReport !== false,
            hideIncomeExpense: !!schema.hideIncomeExpense,
            hideSecretaryHandover: !!schema.hideSecretaryHandover,
          });
          setLoading(false);
          setupDbSyncs(false);
          registerActiveSession(firebaseUser, email, dName);
        } else {
          setLoginError(`Google account ${email} is not listed in the authorized registry helpers list. Please contact ignitina2@gmail.com to request access.`);
          await signOut(auth);
          setUser(null);
          setLoading(false);
        }
      } catch (err) {
        console.error("Helper whitelist check failed:", err);
        setLoginError("Could not connect to verify system permissions. Please check your internet connection.");
        await signOut(auth);
        setUser(null);
        setLoading(false);
      }
    });

    // Setup real-time listeners across multi-tabs
    function setupDbSyncs(isAdmin: boolean) {
      // Helper to clear error when sync is success
      const clearErrorOnSuccess = () => {
        setFirestoreError(null);
      };

      // Flags to avoid showing notifications for existing cache/server items on initial loading
      let isInitialTransactions = true;
      let isInitialSponsors = true;
      let isInitialIncomeExpenses = true;
      let isInitialHandovers = true;

      // 1. Transactions Listener
      const unsubTransactions = onSnapshot(collection(db, 'transactions'), (snap) => {
        const list: Transaction[] = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() } as any);
        });

        // Trigger remote-addition alerts for real-time multi-device notifications
        if (!isInitialTransactions && notificationsEnabledRef.current) {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              const docData = change.doc.data() as Transaction;
              const hasPendingWrites = change.doc.metadata.hasPendingWrites;
              if (!hasPendingWrites) {
                sendNotification('New Transaction Added', {
                  body: `${docData.name} - ₹${docData.totalAmount.toLocaleString('en-IN')}`,
                });
              }
            }
          });
        }
        isInitialTransactions = false;

        setAppData(prev => ({ ...prev, transactions: list }));
        clearErrorOnSuccess();
      }, (err) => {
        console.error("Transactions sync error:", err);
        setFirestoreError(`Transactions: ${err.message || String(err)}`);
      });
      activeSubscriptions.push(unsubTransactions);

      // 2. Sponsors Listener
      const unsubSponsors = onSnapshot(collection(db, 'sponsors'), (snap) => {
        const list: Sponsor[] = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() } as any);
        });

        if (!isInitialSponsors && notificationsEnabledRef.current) {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              const docData = change.doc.data() as Sponsor;
              const hasPendingWrites = change.doc.metadata.hasPendingWrites;
              if (!hasPendingWrites) {
                sendNotification('New Sponsor Added', {
                  body: `${docData.name} - ₹${docData.amount.toLocaleString('en-IN')}`,
                });
              }
            }
          });
        }
        isInitialSponsors = false;

        setAppData(prev => ({ ...prev, sponsors: list }));
        clearErrorOnSuccess();
      }, (err) => {
        console.error("Sponsors sync error:", err);
        setFirestoreError(`Sponsors: ${err.message || String(err)}`);
      });
      activeSubscriptions.push(unsubSponsors);

      // 3. Income & Expenses Listener
      const unsubIncomeExpenses = onSnapshot(collection(db, 'incomeExpenses'), (snap) => {
        const list: IncomeExpense[] = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() } as any);
        });

        if (!isInitialIncomeExpenses && notificationsEnabledRef.current) {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              const docData = change.doc.data() as IncomeExpense;
              const hasPendingWrites = change.doc.metadata.hasPendingWrites;
              if (!hasPendingWrites) {
                const typeStr = (docData.type || 'income').toLowerCase();
                const typeProper = typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
                sendNotification(`New ${typeProper} Added`, {
                  body: `${docData.description} - ₹${docData.amount.toLocaleString('en-IN')}`,
                });
              }
            }
          });
        }
        isInitialIncomeExpenses = false;

        setAppData(prev => ({ ...prev, incomeExpenses: list }));
        clearErrorOnSuccess();
      }, (err) => {
        console.error("IncomeExpenses sync error:", err);
        setFirestoreError(`Income/Expenses: ${err.message || String(err)}`);
      });
      activeSubscriptions.push(unsubIncomeExpenses);

      // 4. Secretary Handovers Listener
      const unsubHandovers = onSnapshot(collection(db, 'secretaryHandovers'), (snap) => {
        const list: SecretaryHandover[] = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() } as any);
        });

        if (!isInitialHandovers && notificationsEnabledRef.current) {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              const docData = change.doc.data() as SecretaryHandover;
              const hasPendingWrites = change.doc.metadata.hasPendingWrites;
              if (!hasPendingWrites) {
                sendNotification('Cash Handed Over', {
                  body: `${docData.name} - ₹${docData.amount.toLocaleString('en-IN')}`,
                });
              }
            }
          });
        }
        isInitialHandovers = false;

        setAppData(prev => ({ ...prev, secretaryHandovers: list }));
        clearErrorOnSuccess();
      }, (err) => {
        console.error("SecretaryHandovers sync error:", err);
        setFirestoreError(`Handovers: ${err.message || String(err)}`);
      });
      activeSubscriptions.push(unsubHandovers);

      // 5. Whitelisted Users Admin Listener
      const unsubAllowedUsers = onSnapshot(collection(db, 'allowedUsers'), (snap) => {
        const list: AllowedUser[] = [];
        const curUserEmail = auth.currentUser ? auth.currentUser.email?.toLowerCase().trim() : '';
        let currentUserFound = false;
        let currentUserDoc: AllowedUser | null = null;

        snap.forEach(doc => {
          const u = { email: doc.id, ...doc.data() } as any;
          list.push(u);
          if (u.email?.toLowerCase().trim() === curUserEmail) {
            currentUserFound = true;
            currentUserDoc = u;
          }
        });
        setAllowedUsers(list);

        // Dynamically update logged in helper sub-user permissions if modified in real-time
        if (curUserEmail && !isPrimaryAdminEmail(curUserEmail)) {
          if (currentUserFound && currentUserDoc) {
            if (currentUserDoc.status === 'ACTIVE') {
              setUserPermissions({
                canAdd: currentUserDoc.canAdd !== false,
                canEdit: currentUserDoc.canEdit !== false,
                canDelete: currentUserDoc.canDelete === true,
                canShareReport: currentUserDoc.canShareReport !== false,
                hideIncomeExpense: !!currentUserDoc.hideIncomeExpense,
                hideSecretaryHandover: !!currentUserDoc.hideSecretaryHandover,
              });
            } else {
              setLoginError(`Your assistant account status has been changed to DISABLED. Please contact ignitina2@gmail.com to restore access.`);
              signOut(auth);
              setUser(null);
            }
          } else {
            setLoginError(`Your account has been removed from the authorized whitelist registry. Please contact ignitina2@gmail.com.`);
            signOut(auth);
            setUser(null);
          }
        }

        clearErrorOnSuccess();
      }, (err) => {
        console.error("AllowedUsers sync error:", err);
        setFirestoreError(`Allowed Users: ${err.message || String(err)}`);
      });
      activeSubscriptions.push(unsubAllowedUsers);

      // 5.5 Active Sessions Listener
      const unsubActiveSessions = onSnapshot(collection(db, 'activeSessions'), (snap) => {
        const list: any[] = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        // Sort sessions by latest active first
        list.sort((a, b) => new Date(b.lastActive || 0).getTime() - new Date(a.lastActive || 0).getTime());
        setActiveSessions(list);
        clearErrorOnSuccess();
      }, (err) => {
        console.error("ActiveSessions sync error:", err);
        setFirestoreError(`Active Sessions: ${err.message || String(err)}`);
      });
      activeSubscriptions.push(unsubActiveSessions);

      // 6. Global Branding Settings Listener
      const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setAppData(prev => ({
            ...prev,
            logo: d.logo || '',
            logoMobile: d.logoMobile || '',
            logoDesktop: d.logoDesktop || '',
            notificationsEnabled: !!d.notificationsEnabled,
            creditSettings: d.creditSettings || DEFAULT_CREDIT_SETTINGS,
            customPaymentLabels: d.customPaymentLabels || DEFAULT_PAYMENT_LABELS,
            paymentMethodsList: d.paymentMethodsList || prev.paymentMethodsList
          }));
        }
        clearErrorOnSuccess();
      }, (err) => {
        console.error("Settings sync error:", err);
        setFirestoreError(`Global Settings: ${err.message || String(err)}`);
      });
      activeSubscriptions.push(unsubSettings);

      // 7. Shared Google Drive & Sheets Sync Config Listener
      const unsubDriveConfig = onSnapshot(doc(db, 'settings', 'driveSyncConfig'), (snap) => {
        if (snap.exists()) {
          const d = snap.data() as DriveSyncConfig;
          const merged: DriveSyncConfig = {
            ...d,
            webhookUrl: d.webhookUrl || DEFAULT_WEBHOOK_URL,
          };
          setDriveSyncConfig(merged);
          if (d.activeAccessToken) {
            setDriveAccessToken(d.activeAccessToken);
            setCachedAccessToken(d.activeAccessToken);
          }
          if (d.autoSyncEnabled !== undefined) {
            setIsDriveAutoSyncEnabled(d.autoSyncEnabled);
          }
        } else {
          // Initialize in Firestore with the default webhook URL so all team devices sync automatically
          setDoc(doc(db, 'settings', 'driveSyncConfig'), {
            webhookUrl: DEFAULT_WEBHOOK_URL,
            autoSyncEnabled: true,
            lastSyncedAt: new Date().toISOString(),
            lastSyncStatus: 'success',
            lastSyncMessage: 'Initialized with official Trust webhook'
          }, { merge: true }).catch(console.warn);
        }
      }, (err) => {
        console.warn("Drive config sync notice:", err);
      });
      activeSubscriptions.push(unsubDriveConfig);
    }

    return () => {
      unsubscribeAuth();
      activeSubscriptions.forEach((unsub) => unsub());
    };
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      // Standard auth provider without sensitive scopes.
      // This allows ANY permitted team member or admin to sign in without being blocked by Error 403 (unverified app / test user).
      await signInWithPopup(auth, authGoogleProvider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // quiet
      } else if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        setLoginError("Firebase: Error (auth/unauthorized-domain)");
      } else {
        setLoginError(err.message || 'Verification failure.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleConnectDrive = async () => {
    try {
      setLoginError(null);
      const result = await signInWithPopup(auth, driveGoogleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        const token = credential.accessToken;
        setCachedAccessToken(token);
        setDriveAccessToken(token);

        // Pre-create/verify target Google Drive folder and spreadsheet
        const folder = await getOrCreateDriveFolder(token);
        const sheet = await getOrCreateCouponSheet(token, folder.id);

        const newConfig: Partial<DriveSyncConfig> = {
          activeAccessToken: token,
          tokenUpdatedAt: new Date().toISOString(),
          connectedEmail: result.user.email,
          folderId: folder.id,
          folderLink: folder.webViewLink,
          sheetId: sheet.id,
          sheetLink: sheet.webViewLink,
          autoSyncEnabled: true,
          lastSyncedAt: new Date().toISOString(),
          lastSyncedBy: result.user.email || 'Admin',
          lastSyncStatus: 'success',
          lastSyncMessage: 'Drive & Sheets initialized successfully',
        };

        // Save to shared Firestore settings so ALL permitted team members can sync!
        await setDoc(doc(db, 'settings', 'driveSyncConfig'), cleanUndefined(newConfig), { merge: true });
        setDriveSyncConfig(prev => ({ ...prev, ...newConfig }));
      }
    } catch (err: any) {
      console.error("Drive connection error:", err);
      if (
        err.code === 'auth/access_denied' ||
        (err.message && (
          err.message.includes('access_denied') ||
          err.message.includes('verification process') ||
          err.message.includes('developer-approved testers')
        ))
      ) {
        setLoginError("Google Error 403 (access_denied): The app is in Testing mode. In Google Cloud Console (Project gen-lang-client-0728385363), go to OAuth consent screen > Test users > add ignitina2@gmail.com and save.");
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setLoginError(err.message || 'Failed to connect Google Drive.');
      }
    }
  };

  const handleUpdateDriveSyncConfig = async (partialConfig: Partial<DriveSyncConfig>) => {
    try {
      await setDoc(doc(db, 'settings', 'driveSyncConfig'), cleanUndefined(partialConfig), { merge: true });
      setDriveSyncConfig(prev => ({ ...prev, ...partialConfig }));
    } catch (err) {
      console.error("Failed to update driveSyncConfig:", err);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      // 1. Immediately reset React state so UI displays LoginPage instantly
      setUser(null);
      setCachedAccessToken(null);
      setDriveAccessToken(null);
      setIsSidebarOpen(false);
      setLoginError(null);

      // 2. Remove session ID and remove activeSessions in Firestore without blocking UI
      const tabSessionId = sessionStorage.getItem('app_session_id');
      sessionStorage.removeItem('app_session_id');
      if (tabSessionId) {
        deleteDoc(doc(db, 'activeSessions', tabSessionId)).catch(err => {
          console.warn("Could not delete active session on logout:", err);
        });
      }

      // 3. Complete Firebase Auth sign out
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  // Administration whitelisting controllers
  const handleAddAllowedUser = async (email: string, role: AllowedUser['role'], perms: { canAdd: boolean; canEdit: boolean; canDelete: boolean }) => {
    const emailId = email.toLowerCase().trim();
    try {
      await setDoc(doc(db, 'allowedUsers', emailId), {
        email: emailId,
        role,
        status: 'ACTIVE',
        canAdd: perms.canAdd,
        canEdit: perms.canEdit,
        canDelete: perms.canDelete,
        addedAt: new Date().toISOString(),
        addedBy: user?.email || 'ignitina2@gmail.com'
      });
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleDeleteAllowedUser = async (email: string) => {
    const emailId = email.toLowerCase().trim();
    try {
      await deleteDoc(doc(db, 'allowedUsers', emailId));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleToggleAllowedUserDisabled = async (email: string, currentStatus: AllowedUser['status']) => {
    const emailId = email.toLowerCase().trim();
    const nextStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await updateDoc(doc(db, 'allowedUsers', emailId), {
        status: nextStatus
      });
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleUpdateAllowedUserPermission = async (email: string, field: 'canAdd' | 'canEdit' | 'canDelete' | 'canShareReport' | 'hideIncomeExpense' | 'hideSecretaryHandover', value: boolean) => {
    const emailId = email.toLowerCase().trim();
    try {
      await updateDoc(doc(db, 'allowedUsers', emailId), {
        [field]: value
      });
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleForceSyncLocalToCloud = async (): Promise<boolean> => {
    // Merges local storage settings to Google cloud database when requested
    try {
      const globalDocRef = doc(db, 'settings', 'global');
      await setDoc(globalDocRef, {
        logo: appData.logo || '',
        logoMobile: appData.logoMobile || '',
        logoDesktop: appData.logoDesktop || '',
        notificationsEnabled: appData.notificationsEnabled,
        creditSettings: appData.creditSettings || DEFAULT_CREDIT_SETTINGS,
        customPaymentLabels: appData.customPaymentLabels || DEFAULT_PAYMENT_LABELS,
        paymentMethodsList: appData.paymentMethodsList || []
      }, { merge: true });
      return true;
    } catch (err) {
      console.error("Local sync flush failed:", err);
      return false;
    }
  };

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

  const generateSafeId = (): string => {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
      try {
        return window.crypto.randomUUID();
      } catch (e) {
        // fallback
      }
    }
    // High-entropy unique ID fallback
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      if (i === 8 || i === 12 || i === 16 || i === 20) {
        result += '-';
      }
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const cleanUndefined = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(cleanUndefined);
    }
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        clean[key] = cleanUndefined(obj[key]);
      }
    }
    return clean;
  };

  // Automated live sync to Google Drive & Google Sheet for ANY permitted team member
  const syncTransactionToDriveAndSheet = async (
    action: 'add' | 'update' | 'delete',
    tx: Transaction,
    currentAppData: AppData
  ) => {
    if (!isDriveAutoSyncEnabled && driveSyncConfig.autoSyncEnabled === false) {
      return;
    }

    // 1. Webhook sync (Google Apps Script - 24/7 zero token expiration for ignitina2@gmail.com)
    const webhookUrl = (driveSyncConfig.webhookUrl || DEFAULT_WEBHOOK_URL).trim();
    if (webhookUrl) {
      syncViaWebhook(webhookUrl, {
        action,
        transaction: tx,
        transactions: currentAppData.transactions,
        fullBackup: currentAppData,
      }).then(res => {
        if (res.success) {
          setDoc(doc(db, 'settings', 'driveSyncConfig'), {
            lastSyncedAt: new Date().toISOString(),
            lastSyncedBy: user?.email || 'Authorized Team Member',
            lastSyncStatus: 'success',
            lastSyncMessage: `Transaction ${tx.id || ''} saved to Sheet & Drive JSON Backup`,
          }, { merge: true }).catch(console.warn);
        }
      }).catch(console.warn);
    }

    // 2. Direct Google Drive & Sheet REST API with active OAuth token (local or shared)
    const token = getCachedAccessToken() || driveAccessToken || driveSyncConfig.activeAccessToken;
    if (token) {
      if (action === 'delete') {
        syncAllTransactionsToSheet(token, currentAppData.transactions).catch(console.warn);
        saveBackupJsonToDrive(token, currentAppData).catch(console.warn);
      } else {
        recordTransactionAndBackupToDrive(token, tx, currentAppData).then(res => {
          setDoc(doc(db, 'settings', 'driveSyncConfig'), {
            sheetId: res.sheetResult.sheetId,
            sheetLink: res.sheetResult.webViewLink,
            backupFileId: res.backupResult.fileId,
            lastSyncedAt: new Date().toISOString(),
            lastSyncedBy: user?.email || 'Authorized Team Member',
            lastSyncStatus: 'success',
            lastSyncMessage: `Transaction ${tx.id} ${res.sheetResult.action} in Sheet & JSON backup updated`,
          }, { merge: true }).catch(console.warn);
        }).catch(err => {
          console.warn("Drive auto-sync notice:", err);
        });
      }
    }
  };

  // 100% Secure cloud synchronised operations writing to multi-tab cache
  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    if (!userPermissions.canAdd) {
      setFirestoreError("നിങ്ങൾക്ക് ഡാറ്റ ചേർക്കാൻ (Add) അനുവാദമില്ല! (You do not have permission to add transactions.)");
      return;
    }
    const transactionId = generateSafeId();
    const docData: Transaction = {
      ...transaction,
      id: transactionId,
    };

    try {
      await setDoc(doc(db, 'transactions', transactionId), cleanUndefined(docData));

      // Automated Sync to Google Drive ("LUCKY COUPON SALE 2026") & Google Sheet ("COUPON SALE 2026")
      // Works for ANY team member / ID permitted by Trust Admin Team
      const updatedList = [docData, ...appData.transactions.filter(t => t.id !== transactionId)];
      syncTransactionToDriveAndSheet('add', docData, { ...appData, transactions: updatedList });

      if (appData.notificationsEnabled) {
        sendNotification('New Transaction Added', {
          body: `${docData.name} - ₹${docData.totalAmount.toLocaleString('en-IN')}`,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `transactions/${transactionId}`);
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!userPermissions.canEdit) {
      setFirestoreError("നിങ്ങൾക്ക് ഡാറ്റ എഡിറ്റ് ചെയ്യാൻ അനുവാദമില്ല! (You do not have permission to edit transactions.)");
      return;
    }
    try {
      await updateDoc(doc(db, 'transactions', id), cleanUndefined(updates));

      // Automated Sync to Google Drive & Google Sheet on update for ANY permitted team member
      const existingTx = appData.transactions.find(t => t.id === id);
      if (existingTx) {
        const updatedTx: Transaction = { ...existingTx, ...updates };
        const updatedList = appData.transactions.map(t => t.id === id ? updatedTx : t);
        syncTransactionToDriveAndSheet('update', updatedTx, { ...appData, transactions: updatedList });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${id}`);
    }
  };

  const deleteTransaction = async (ids: string[]) => {
    if (!userPermissions.canDelete) {
      setFirestoreError("നിങ്ങൾക്ക് ഡാറ്റ ഇല്ലാതാക്കാൻ (Delete) അനുവാദമില്ല! (You do not have permission to delete Transactions.)");
      return;
    }
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, 'transactions', id));
      }

      // Automated Sync to Google Drive & Google Sheet on deletion for ANY permitted team member
      const remainingTx = appData.transactions.filter(t => !ids.includes(t.id));
      syncTransactionToDriveAndSheet('delete', { id: ids[0] } as any, { ...appData, transactions: remainingTx });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `transactions/${ids.join(',')}`);
    }
  };

  const toggleTreasurer = async (id: string) => {
    if (!userPermissions.canEdit) {
      setFirestoreError("നിങ്ങൾക്ക് ട്രഷറർ ഫീൽഡ് മാറ്റാൻ അനുവാദമില്ല! (You do not have permission to edit transactions.)");
      return;
    }
    const tx = appData.transactions.find(t => t.id === id);
    if (!tx) return;

    const paidToTreasurer = !tx.paidToTreasurer;
    const treasurerPaidDate = paidToTreasurer ? new Date().toISOString() : null;

    try {
      const updatedTx: Transaction = {
        ...tx,
        paidToTreasurer,
        treasurerPaidDate
      };
      await updateDoc(doc(db, 'transactions', id), cleanUndefined({
        paidToTreasurer,
        treasurerPaidDate
      }));

      // Automated Sync to Google Drive & Google Sheet on treasurer update
      const updatedList = appData.transactions.map(t => t.id === id ? updatedTx : t);
      syncTransactionToDriveAndSheet('update', updatedTx, { ...appData, transactions: updatedList });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${id}`);
    }
  };

  const addSponsor = async (sponsor: Omit<Sponsor, 'id'>) => {
    if (!userPermissions.canAdd) {
      setFirestoreError("നിങ്ങൾക്ക് സ്പോൺസർ ചേർക്കാൻ അനുവാദമില്ല! (You do not have permission to add sponsors.)");
      return;
    }
    const sponsorId = generateSafeId();
    const docData: Sponsor = {
      ...sponsor,
      id: sponsorId,
    };

    try {
      await setDoc(doc(db, 'sponsors', sponsorId), cleanUndefined(docData));

      if (appData.notificationsEnabled) {
        sendNotification('New Sponsor Added', {
          body: `${docData.name} - ₹${docData.amount.toLocaleString('en-IN')}`,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `sponsors/${sponsorId}`);
    }
  };

  const updateSponsor = async (id: string, updates: Partial<Sponsor>) => {
    if (!userPermissions.canEdit) {
      setFirestoreError("നിങ്ങൾക്ക് സ്പോൺസർ എഡിറ്റ് ചെയ്യാൻ അനുവാദമില്ല! (You do not have permission to edit sponsors.)");
      return;
    }
    const oldSponsor = appData.sponsors.find(s => s.id === id);
    try {
      await updateDoc(doc(db, 'sponsors', id), cleanUndefined(updates));

      if (appData.notificationsEnabled && updates.status === 'COLLECTED' && oldSponsor?.status !== 'COLLECTED') {
        sendNotification('Sponsor Payment Collected', {
          body: `${oldSponsor?.name} - ₹${oldSponsor?.amount.toLocaleString('en-IN')}`,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sponsors/${id}`);
    }
  };

  const deleteSponsor = async (id: string) => {
    if (!userPermissions.canDelete) {
      setFirestoreError("നിങ്ങൾക്ക് ഡാറ്റ ഇല്ലാതാക്കാൻ (Delete) അനുവാദമില്ല! (You do not have permission to delete Sponsors.)");
      return;
    }
    try {
      await deleteDoc(doc(db, 'sponsors', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sponsors/${id}`);
    }
  };

  const addIncomeExpense = async (entry: Omit<IncomeExpense, 'id'>) => {
    if (!userPermissions.canAdd) {
      setFirestoreError("നിങ്ങൾക്ക് വരവ് ചിലവ് ചേർക്കാൻ അനുവാദമില്ല! (You do not have permission to add income/expense records.)");
      return;
    }
    const entryId = generateSafeId();
    const docData: IncomeExpense = {
      ...entry,
      id: entryId,
    };

    try {
      await setDoc(doc(db, 'incomeExpenses', entryId), cleanUndefined(docData));

      if (appData.notificationsEnabled) {
        sendNotification(`New ${docData.type.toLowerCase()} Added`, {
          body: `${docData.description} - ₹${docData.amount.toLocaleString('en-IN')}`,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `incomeExpenses/${entryId}`);
    }
  };

  const updateIncomeExpense = async (id: string, updates: Partial<IncomeExpense>) => {
    if (!userPermissions.canEdit) {
      setFirestoreError("നിങ്ങൾക്ക് വരവ് ചിലവ് എഡിറ്റ് ചെയ്യാൻ അനുവാദമില്ല! (You do not have permission to edit income/expense records.)");
      return;
    }
    try {
      await updateDoc(doc(db, 'incomeExpenses', id), cleanUndefined(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incomeExpenses/${id}`);
    }
  };

  const deleteIncomeExpense = async (ids: string[]) => {
    if (!userPermissions.canDelete) {
      setFirestoreError("നിങ്ങൾക്ക് ഡാറ്റ ഇല്ലാതാക്കാൻ (Delete) അനുവാദമില്ല! (You do not have permission to delete Income/Expense records.)");
      return;
    }
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, 'incomeExpenses', id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `incomeExpenses/${ids.join(',')}`);
    }
  };

  const addSecretaryHandover = async (handover: Omit<SecretaryHandover, 'id'>) => {
    if (!userPermissions.canAdd) {
      setFirestoreError("നിങ്ങൾക്ക് ഹാൻഡ്ഓവർ ചേർക്കാൻ അനുവാദമില്ല! (You do not have permission to add secretary handover records.)");
      return;
    }
    const handoverId = generateSafeId();
    const docData: SecretaryHandover = {
      ...handover,
      id: handoverId,
    };

    try {
      await setDoc(doc(db, 'secretaryHandovers', handoverId), cleanUndefined(docData));

      if (appData.notificationsEnabled) {
        sendNotification('Cash Handed Over', {
          body: `${docData.name} - ₹${docData.amount.toLocaleString('en-IN')}`,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `secretaryHandovers/${handoverId}`);
    }
  };

  const updateSecretaryHandover = async (id: string, updates: Partial<SecretaryHandover>) => {
    if (!userPermissions.canEdit) {
      setFirestoreError("നിങ്ങൾക്ക് ഹാൻഡ്ഓവർ എഡിറ്റ് ചെയ്യാൻ അനുവാദമില്ല! (You do not have permission to edit secretary handover records.)");
      return;
    }
    try {
      await updateDoc(doc(db, 'secretaryHandovers', id), cleanUndefined(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `secretaryHandovers/${id}`);
    }
  };

  const deleteSecretaryHandover = async (ids: string[]) => {
    if (!userPermissions.canDelete) {
      setFirestoreError("നിങ്ങൾക്ക് ഡാറ്റ ഇല്ലാതാക്കാൻ (Delete) അനുവാദമില്ല! (You do not have permission to delete Treasury Handover records.)");
      return;
    }
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, 'secretaryHandovers', id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `secretaryHandovers/${ids.join(',')}`);
    }
  };

  const updateLogo = async (logo: string) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { logo }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    }
  };

  const updateLogoMobile = async (logoMobile: string) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { logoMobile }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    }
  };

  const updateLogoDesktop = async (logoDesktop: string) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { logoDesktop }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    }
  };

  const updateCreditSettings = async (settings: CreditSettings) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { creditSettings: settings }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    }
  };

  const updatePaymentLabels = async (labels: Record<PaymentMethod, string>) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { customPaymentLabels: labels }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    }
  };

  const updatePaymentMethodsList = async (list: CustomPaymentMethod[]) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { paymentMethodsList: list }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    }
  };

  const toggleNotifications = async (enabled: boolean) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { notificationsEnabled: enabled }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
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

  const restoreData = async (data: AppData) => {
    try {
      const batch = writeBatch(db);
      
      // Upload transactions in bulk batch
      for (const tx of data.transactions) {
        batch.set(doc(db, 'transactions', tx.id), cleanUndefined(tx));
      }
      // Upload sponsors
      for (const sp of data.sponsors) {
        batch.set(doc(db, 'sponsors', sp.id), cleanUndefined(sp));
      }
      // Upload income expenses
      if (Array.isArray(data.incomeExpenses)) {
        for (const ie of data.incomeExpenses) {
          batch.set(doc(db, 'incomeExpenses', ie.id), cleanUndefined(ie));
        }
      }
      // Upload handovers
      if (Array.isArray(data.secretaryHandovers)) {
        for (const sh of data.secretaryHandovers) {
          batch.set(doc(db, 'secretaryHandovers', sh.id), cleanUndefined(sh));
        }
      }
      
      // Upload branding/settings
      batch.set(doc(db, 'settings', 'global'), {
        logo: data.logo || '',
        logoMobile: data.logoMobile || '',
        logoDesktop: data.logoDesktop || '',
        notificationsEnabled: !!data.notificationsEnabled,
        creditSettings: data.creditSettings || DEFAULT_CREDIT_SETTINGS,
        customPaymentLabels: data.customPaymentLabels || DEFAULT_PAYMENT_LABELS,
        paymentMethodsList: data.paymentMethodsList || []
      }, { merge: true });

      await batch.commit();
    } catch (err) {
      console.error("Bulk restoration failed:", err);
      alert("Failed to sync some imported backup records to Google cloud database.");
    }
  };

  const clearData = async () => {
    try {
      const batch = writeBatch(db);
      for (const tx of appData.transactions) {
        batch.delete(doc(db, 'transactions', tx.id));
      }
      for (const sp of appData.sponsors) {
        batch.delete(doc(db, 'sponsors', sp.id));
      }
      for (const ie of appData.incomeExpenses) {
        batch.delete(doc(db, 'incomeExpenses', ie.id));
      }
      for (const sh of appData.secretaryHandovers) {
        batch.delete(doc(db, 'secretaryHandovers', sh.id));
      }
      await batch.commit();
    } catch (e) {
      console.error(e);
    }
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
                   setTimeout(() => {
                     const element = document.getElementById('dashboard-add-sale-form-container');
                     if (element) {
                       element.scrollIntoView({ behavior: 'smooth' });
                     }
                   }, 100);
                 }}
                 onAddTransaction={addTransaction}
                 editingTransaction={editingTransaction}
                 onUpdateTransaction={(id, updates) => {
                   updateTransaction(id, updates);
                   setEditingTransaction(null);
                 }}
                 onCancelEdit={() => {
                   setEditingTransaction(null);
                 }}
                 permissions={userPermissions}
               />;
      case 'transactions':
        return (
          <TransactionList 
            transactions={appData.transactions} 
            onDelete={deleteTransaction}
            onToggleTreasurer={toggleTreasurer}
            onAddTransaction={addTransaction}
            onEdit={(t) => {
              setEditingTransaction(t);
              setActiveTab('dashboard');
              setTimeout(() => {
                const element = document.getElementById('dashboard-add-sale-form-container');
                if (element) {
                   element.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
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
              setActiveTab('dashboard');
              setTimeout(() => {
                const element = document.getElementById('dashboard-add-sale-form-container');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
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
        if (userPermissions.hideIncomeExpense) {
          return (
            <div className="p-8 text-center max-w-sm mx-auto mt-20 bg-white border border-slate-150 rounded-3xl shadow-lg shadow-slate-100/50 space-y-4 animate-in fade-in-50 slide-in-from-bottom-5 duration-300">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                <AlertCircle size={22} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight font-sans">ലോഗിൻ തടഞ്ഞിരിക്കുന്നു (Access Denied)</h2>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider leading-relaxed">
                  ഈ പേജ് കാണാൻ നിങ്ങൾക്ക് അനുവാദമില്ല.
                  <span className="block mt-1 font-semibold text-xs border border-rose-100 bg-rose-50/30 py-1.5 px-3 rounded-xl normal-case text-rose-700 font-sans">You do not have permission to view the Income & Expense tab. Only your main admin can allow this.</span>
                </p>
              </div>
            </div>
          );
        }
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
        if (userPermissions.hideSecretaryHandover) {
          return (
            <div className="p-8 text-center max-w-sm mx-auto mt-20 bg-white border border-slate-150 rounded-3xl shadow-lg shadow-slate-100/50 space-y-4 animate-in fade-in-50 slide-in-from-bottom-5 duration-300">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                <AlertCircle size={22} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight font-sans">ലോഗിൻ തടഞ്ഞിരിക്കുന്നു (Access Denied)</h2>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider leading-relaxed">
                  ഈ പേജ് കാണാൻ നിങ്ങൾക്ക് അനുവാദമില്ല.
                  <span className="block mt-1 font-semibold text-xs border border-rose-100 bg-rose-50/30 py-1.5 px-3 rounded-xl normal-case text-rose-700 font-sans">You do not have permission to view the Treasury Handover tab. Only your main admin can allow this.</span>
                </p>
              </div>
            </div>
          );
        }
        return (
          <TreasuryHandoverManagement 
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
        if (!isPrimaryAdmin) {
          return (
            <div className="p-8 text-center max-w-sm mx-auto mt-20 bg-white border border-slate-150 rounded-3xl shadow-lg shadow-slate-100/50 space-y-4 animate-in fade-in-50 slide-in-from-bottom-5 duration-300">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                <AlertCircle size={22} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight font-sans">ലോഗിൻ തടഞ്ഞിരിക്കുന്നു (Access Denied)</h2>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider leading-relaxed">
                  സെറ്റിംഗ്സ് കാണാൻ നിങ്ങൾക്ക് അനുവാദമില്ല.
                  <span className="block mt-1 font-semibold text-xs border border-rose-100 bg-rose-50/30 py-1.5 px-3 rounded-xl normal-case text-rose-700 font-sans">Only the primary developer main administrator can access settings and backup controls.</span>
                </p>
              </div>
            </div>
          );
        }
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
            allowedUsers={allowedUsers}
            onAddAllowedUser={handleAddAllowedUser}
            onDeleteAllowedUser={handleDeleteAllowedUser}
            onToggleAllowedUserDisabled={handleToggleAllowedUserDisabled}
            onUpdateAllowedUserPermission={handleUpdateAllowedUserPermission}
            onGoogleLogin={handleGoogleLogin}
            onGoogleLogout={handleGoogleLogout}
            onSyncLocalToCloud={handleForceSyncLocalToCloud}
            activeSessions={activeSessions}
            driveAccessToken={driveAccessToken}
            driveSyncConfig={driveSyncConfig}
            onUpdateDriveSyncConfig={handleUpdateDriveSyncConfig}
            onConnectDrive={handleConnectDrive}
            isDriveAutoSyncEnabled={isDriveAutoSyncEnabled}
            onToggleDriveAutoSync={(enabled) => {
              setIsDriveAutoSyncEnabled(enabled);
              handleUpdateDriveSyncConfig({ autoSyncEnabled: enabled });
            }}
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
                   setTimeout(() => {
                     const element = document.getElementById('dashboard-add-sale-form-container');
                     if (element) {
                       element.scrollIntoView({ behavior: 'smooth' });
                     }
                   }, 100);
                 }}
                 onAddTransaction={addTransaction}
                 editingTransaction={editingTransaction}
                 onUpdateTransaction={(id, updates) => {
                   updateTransaction(id, updates);
                   setEditingTransaction(null);
                 }}
                 onCancelEdit={() => {
                   setEditingTransaction(null);
                 }}
                 permissions={userPermissions}
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

  // Loading state gate
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center font-sans text-white p-8">
        <div className="text-center space-y-6">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
          <div className="space-y-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">Verifying Security Credentials</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Connecting to Firestore server security hub...</p>
          </div>
        </div>
      </div>
    );
  }

  // Security Login Gate block
  if (!user) {
    return (
      <LoginPage 
        onLoginSuccess={() => {}}
        isLoggingIn={isLoggingIn}
        setIsLoggingIn={setIsLoggingIn}
        loginError={loginError}
        setLoginError={setLoginError}
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
        permissions={userPermissions}
        onLogout={handleGoogleLogout}
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
            {resolvedLogo ? (
              <img src={resolvedLogo} alt="Logo" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
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
              onClick={handleGoogleLogout}
              className="px-2.5 py-1 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all flex items-center gap-1 text-[11px] font-bold border border-rose-200 cursor-pointer active:scale-95"
              title="Sign Out of App"
            >
              <LogOut size={13} />
              <span>Logout</span>
            </button>
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
            {resolvedLogo ? (
              <img src={resolvedLogo} alt="Logo" className="w-10 h-10 object-contain rounded-lg shadow-sm" referrerPolicy="no-referrer" />
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
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inc & Exp Balance</p>
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

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 bg-white border border-slate-100 shadow-sm pl-4 pr-1.5 py-1 rounded-2xl">
                <div className="text-right">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center justify-end gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Cloud Synced Team Active
                  </p>
                  <span className="text-[11px] font-bold text-slate-700 block">{user.displayName}</span>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User photo" className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden shrink-0 shadow-inner" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden shrink-0 shadow-inner bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600">
                    {user.displayName.substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <button
                onClick={handleGoogleLogout}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-rose-100 bg-rose-50/50 hover:bg-rose-50 hover:border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                title="Sign Out of App"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto relative animate-fade-in">
          {/* Printable formal header */}
          <div className="hidden print:block print-header">
            <div className="flex items-center justify-between border-b pb-2 mb-4 border-slate-900 font-sans">
              <div className="flex items-center gap-3">
                {resolvedLogo ? (
                  <img src={resolvedLogo} alt="Logo" className="w-10 h-10 object-contain rounded-lg" referrerPolicy="no-referrer" />
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

          {firestoreError && (
            <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-6 text-slate-800 shadow-lg shadow-amber-500/5 flex flex-col md:flex-row items-start justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-white border border-amber-200 rounded-2xl text-amber-600 shrink-0 shadow-sm">
                  <AlertCircle size={22} className="animate-bounce" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-black text-amber-950 uppercase tracking-wider flex items-center gap-2">
                    Firebase Sync Issue <span className="text-[10px] text-amber-700 font-bold lowercase tracking-normal bg-amber-100 px-2 py-0.5 rounded-full">(ഡാറ്റ സിങ്ക് ചെയ്യുന്നില്ല)</span>
                  </h3>
                  <div className="text-xs font-semibold leading-relaxed text-slate-700 space-y-2">
                    <p>
                      The app is currently having trouble talking to the cloud database. We have successfully provisioned your Firestore Database for project <strong className="text-slate-900 font-black">coupon-sale-tracker-2026</strong> and deployed the security rules.
                    </p>
                    <p className="text-amber-800 font-bold">
                      ഇത് പരിഹരിക്കാൻ: 1) ഫയർബേസ് കൺസോളിൽ ഫയർസ്റ്റോർ പൂർണ്ണമായി എനേബിൾ ആണെന്ന് ഉറപ്പാക്കുക. 2) താഴെയുള്ള "Reload Connections" ബട്ടൺ ക്ലിക്ക് ചെയ്യുക.
                    </p>
                    <div className="mt-2 bg-white/70 border border-amber-100 rounded-xl p-3">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Detailed Technical Error Code:</span>
                      <code className="text-[10px] font-mono text-rose-700 break-all">{firestoreError}</code>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto shrink-0 md:self-center">
                <button 
                  onClick={() => {
                    setFirestoreError(null);
                    window.location.reload();
                  }}
                  className="w-full md:w-auto px-5 py-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-amber-600/20 cursor-pointer"
                >
                  Reload Connections
                </button>
              </div>
            </div>
          )}

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
