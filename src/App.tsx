/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Cloud, CloudOff, LogIn, LogOut, AlertCircle, CheckCircle } from 'lucide-react';
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
import { LoginPage } from './components/LoginPage';
import { AppData, Transaction, Sponsor, IncomeExpense, CreditSettings, SecretaryHandover, PaymentMethod, DEFAULT_PAYMENT_LABELS, CustomPaymentMethod, getDefaultPaymentMethodsList } from './types';
import { cn, cleanUndefined } from './lib/utils';
import { sendNotification, requestNotificationPermission } from './lib/notifications';
import { Bell, BellRing } from 'lucide-react';

// Firebase Integrations
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, setDoc as firestoreSetDoc, updateDoc as firestoreUpdateDoc, deleteDoc as firestoreDeleteDoc, collection, onSnapshot, getDoc, waitForPendingWrites, onSnapshotsInSync, query, limit } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';
import { uploadFile, dataURLtoFile } from './lib/storage';

const STORAGE_KEY = 'coupon_sale_app_data_2026';

const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  reminderEmailTemplate: "Hi {name},\n\nThis is a friendly reminder regarding your outstanding balance of ₹{amount} for the coupons purchased on {date}.\n\nPlease clear the balance at your earliest convenience.\n\nThank you!",
  reminderSMSTemplate: "Hi {name}, reminder for outstanding balance of ₹{amount} for coupons purchased on {date}. Please clear it soon. Thank you!",
  overdueThresholds: [7, 15, 30]
};

export default function App() {
  const [inFlightWrites, setInFlightWrites] = useState(0);
  const inFlightWritesRef = useRef(inFlightWrites);

  useEffect(() => {
    inFlightWritesRef.current = inFlightWrites;
  }, [inFlightWrites]);

  const setDoc = async (...args: any[]) => {
    setInFlightWrites(c => c + 1);
    try {
      return await (firestoreSetDoc as any)(...args);
    } catch (error) {
      setInFlightWrites(c => Math.max(0, c - 1));
      throw error;
    }
  };

  const updateDoc = async (...args: any[]) => {
    setInFlightWrites(c => c + 1);
    try {
      return await (firestoreUpdateDoc as any)(...args);
    } catch (error) {
      setInFlightWrites(c => Math.max(0, c - 1));
      throw error;
    }
  };

  const deleteDoc = async (...args: any[]) => {
    setInFlightWrites(c => c + 1);
    try {
      return await (firestoreDeleteDoc as any)(...args);
    } catch (error) {
      setInFlightWrites(c => Math.max(0, c - 1));
      throw error;
    }
  };

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

  const [showSplash, setShowSplash] = useState(true);

  // User state integration
  const [user, setUser] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'offline' | 'pending'>('connected');

  useEffect(() => {
    let active = true;

    const checkOnlineOffline = () => {
      if (!navigator.onLine) {
        setSyncStatus('offline');
        return true;
      }
      return false;
    };

    // Keep state current on offline mode
    if (checkOnlineOffline()) {
      const handleOnlineChange = () => {
        if (!active) return;
        if (navigator.onLine) {
          setSyncStatus(inFlightWritesRef.current > 0 ? 'pending' : 'connected');
        } else {
          setSyncStatus('offline');
        }
      };
      
      window.addEventListener('online', handleOnlineChange);
      window.addEventListener('offline', handleOnlineChange);
      
      return () => {
        active = false;
        window.removeEventListener('online', handleOnlineChange);
        window.removeEventListener('offline', handleOnlineChange);
      };
    }

    // Set initial status based on known write state
    setSyncStatus(inFlightWritesRef.current > 0 ? 'pending' : 'connected');

    // 1. Heartbeat query to keep Firestore connection highly active and syncStatus highly responsive
    let unsubscribeHeartbeat: (() => void) | null = null;
    try {
      const dummyQuery = query(collection(db, 'transactions'), limit(1));
      unsubscribeHeartbeat = onSnapshot(dummyQuery, () => {
        // Keeps the connection alive and responsive
      }, (err) => {
        console.debug("Heartbeat snapshot subscription info/error ignored:", err);
      });
    } catch (err) {
      console.debug("Heartbeat query creation ignored:", err);
    }

    // Subscribe to Firestore onSnapshotsInSync callback event
    const unsubscribeSync = onSnapshotsInSync(db, () => {
      if (!active) return;
      console.log("Current localWrites count:", inFlightWritesRef.current);
      if (!navigator.onLine) {
        setSyncStatus('offline');
        return;
      }

      if (inFlightWritesRef.current === 0) {
        setSyncStatus('connected');
      } else {
        // Sync completed! We reset the flag and status
        setInFlightWrites(0);
        setSyncStatus('connected');
      }
    });

    const handleNetworkChange = () => {
      if (!active) return;
      if (!navigator.onLine) {
        setSyncStatus('offline');
      } else {
        setSyncStatus(inFlightWritesRef.current > 0 ? 'pending' : 'connected');
      }
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    return () => {
      active = false;
      if (unsubscribeHeartbeat) unsubscribeHeartbeat();
      unsubscribeSync();
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    };
  }, [inFlightWrites]);

  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<{ message: string; code?: string } | null>(null);
  const [allowedUsers, setAllowedUsers] = useState<{ email: string; addedAt?: string; addedBy?: string; disabled?: boolean; canAdd?: boolean; canEdit?: boolean; canDelete?: boolean; }[]>(() => {
    try {
      const saved = localStorage.getItem('scc_allowed_users_full');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    try {
      const savedEmails = localStorage.getItem('scc_permitted_emails');
      if (savedEmails) {
        const parsed = JSON.parse(savedEmails);
        if (Array.isArray(parsed)) {
          return parsed.map(email => ({ email }));
        }
      }
    } catch (e) {}
    return [];
  });
  const [userPermissions, setUserPermissions] = useState<{
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>({
    canAdd: true,
    canEdit: true,
    canDelete: true,
  });
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const isPrimaryAdmin = !!(user && user.email && (
    user.email.toLowerCase() === 'ignitina2@gmail.com' ||
    user.email.toLowerCase() === 'ignitina2@mail.com'
  ));

  useEffect(() => {
    // Check if there is an offline local user session saved previously
    const savedLocalUser = localStorage.getItem('scc_local_verified_user');
    if (savedLocalUser) {
      try {
        setUser(JSON.parse(savedLocalUser));
      } catch (e) {
        console.error("Failed to restore saved local session", e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const isSuperAdmin = currentUser.email && (
          currentUser.email.toLowerCase() === 'ignitina2@gmail.com' ||
          currentUser.email.toLowerCase() === 'ignitina2@mail.com'
        );

        const cleanEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';

        if (isSuperAdmin) {
          setUser({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || 'Primary Administrator',
            photoURL: currentUser.photoURL,
            isLocal: false
          });
          // Always ensure admin email is cached
          try {
            const saved = localStorage.getItem('scc_permitted_emails');
            let list = saved ? JSON.parse(saved) : [];
            if (!Array.isArray(list)) list = [];
            if (!list.includes(cleanEmail)) {
              list.push(cleanEmail);
              localStorage.setItem('scc_permitted_emails', JSON.stringify(list));
            }
          } catch (e) {}
          setAuthLoading(false);
        } else {
          setAuthLoading(true);
          try {
            const docSnap = await getDoc(doc(db, 'allowedUsers', cleanEmail));
            if (docSnap.exists() && docSnap.data()?.disabled !== true) {
              const userData = docSnap.data();
              setUser({
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || userData?.name || 'Authorized Helper',
                photoURL: currentUser.photoURL,
                isLocal: false
              });
              // Save to local cache of permitted emails for seamless subsequent entries
              try {
                const saved = localStorage.getItem('scc_permitted_emails');
                let list = saved ? JSON.parse(saved) : [];
                if (!Array.isArray(list)) list = [];
                if (!list.includes(cleanEmail)) {
                  list.push(cleanEmail);
                  localStorage.setItem('scc_permitted_emails', JSON.stringify(list));
                }
              } catch (e) {}
            } else {
              await signOut(auth);
              setUser(null);
              const isUserDisabled = docSnap.exists() && docSnap.data()?.disabled === true;
              setAuthError({
                message: isUserDisabled
                  ? `Access Denied: This account (${currentUser.email}) has been disabled by the administrator.`
                  : `Access Denied: The Google Account (${currentUser.email}) is not on the authorized Trust Admins directory. Please contact the administrator.`
              });
            }
          } catch (err: any) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const isOfflineErr = errMsg.toLowerCase().includes('offline') || 
                                 errMsg.toLowerCase().includes('unavailable') || 
                                 errMsg.toLowerCase().includes('network') ||
                                 (err && err.code === 'unavailable');
            
            // Offline tolerance credentials check
            let isOfflineBypassed = false;
            try {
              const saved = localStorage.getItem('scc_permitted_emails');
              let list = saved ? JSON.parse(saved) : [];
              if (Array.isArray(list) && list.includes(cleanEmail)) {
                isOfflineBypassed = true;
              }
            } catch (e) {}

            if (isOfflineBypassed) {
              console.warn("Device/Firestore client currently offline, but user has pre-authorized login cached in credentials registry.", errMsg);
              setUser({
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || 'Authorized Admin / Helper',
                photoURL: currentUser.photoURL,
                isLocal: true
              });
            } else {
              if (isOfflineErr) {
                console.warn("Could not reach Trust directory database due to network connection warning.", errMsg);
              } else {
                console.error("Checking allowed users directory failed with unexpected error:", err);
              }
              await signOut(auth);
              setUser(null);
              setAuthError({
                message: `Verification failed. Could not verify login permission, please check your network connection.`
              });
            }
          } finally {
            setAuthLoading(false);
          }
        }
      } else {
        // Only trigger logout state if not in static offline-login bypass style
        if (!localStorage.getItem('scc_local_verified_user')) {
          setUser(null);
        }
        setAuthLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Synchronize localStorage data to Firestore when user logs in (Internet restored/session started)
  useEffect(() => {
    if (!user) return;

    const syncLocalToCloud = async () => {
      // ONLY perform migration if they were previously in local-bypass mode!
      const isMigrationNeeded = !!localStorage.getItem('scc_local_verified_user');
      if (!isMigrationNeeded) return;

      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        localStorage.removeItem('scc_local_verified_user');
        return;
      }

      try {
        const parsed = JSON.parse(saved) as AppData;
        const promises: Promise<void>[] = [];
        let syncedCount = 0;
        
        // --- 0. Sync and upload base64 images / logos to Firebase Cloud Storage ---
        let logoUrl = parsed.logo || '';
        let logoMobileUrl = parsed.logoMobile || '';
        let logoDesktopUrl = parsed.logoDesktop || '';

        if (parsed.logo && parsed.logo.startsWith('data:')) {
          try {
            const file = dataURLtoFile(parsed.logo, 'logo_synced.png');
            if (file) {
              logoUrl = await uploadFile(file, `logos/logo_synced_${Date.now()}.png`);
            }
          } catch (err) {
            console.warn("Failed to sync primary logo to cloud storage:", err);
          }
        }
        if (parsed.logoMobile && parsed.logoMobile.startsWith('data:')) {
          try {
            const file = dataURLtoFile(parsed.logoMobile, 'logo_mobile_synced.png');
            if (file) {
              logoMobileUrl = await uploadFile(file, `logos/logo_mobile_synced_${Date.now()}.png`);
            }
          } catch (err) {
            console.warn("Failed to sync mobile logo to cloud storage:", err);
          }
        }
        if (parsed.logoDesktop && parsed.logoDesktop.startsWith('data:')) {
          try {
            const file = dataURLtoFile(parsed.logoDesktop, 'logo_desktop_synced.png');
            if (file) {
              logoDesktopUrl = await uploadFile(file, `logos/logo_desktop_synced_${Date.now()}.png`);
            }
          } catch (err) {
            console.warn("Failed to sync desktop logo to cloud storage:", err);
          }
        }

        // Write logo settings to Firestore if updated
        if (logoUrl !== (parsed.logo || '') || logoMobileUrl !== (parsed.logoMobile || '') || logoDesktopUrl !== (parsed.logoDesktop || '')) {
          promises.push(setDoc(doc(db, 'settings', 'appSettings'), {
            logo: logoUrl,
            logoMobile: logoMobileUrl,
            logoDesktop: logoDesktopUrl,
          }, { merge: true }));
        }

        // 1. Sync any local transactions
        if (parsed.transactions && parsed.transactions.length > 0) {
          for (const tx of parsed.transactions) {
            promises.push(setDoc(doc(db, 'transactions', tx.id), cleanUndefined(tx)));
            syncedCount++;
          }
        }

        // 2. Sync any local sponsors
        if (parsed.sponsors && parsed.sponsors.length > 0) {
          for (const sp of parsed.sponsors) {
            promises.push(setDoc(doc(db, 'sponsors', sp.id), cleanUndefined(sp)));
            syncedCount++;
          }
        }

        // 3. Sync and upload receipts of incomeExpenses
        const syncedReceiptsCache: { id: string, url: string }[] = [];
        if (parsed.incomeExpenses && parsed.incomeExpenses.length > 0) {
          for (const ie of parsed.incomeExpenses) {
            let receiptUrl = ie.receiptUrl;
            if (ie.receiptUrl && ie.receiptUrl.startsWith('data:')) {
              try {
                const extension = ie.receiptName ? ie.receiptName.split('.').pop() : 'png';
                const filename = `receipt_${ie.id}.${extension}`;
                const file = dataURLtoFile(ie.receiptUrl, filename);
                if (file) {
                  const uploadedUrl = await uploadFile(file, `receipts/receipt_synced_${ie.id}_${Date.now()}.${extension}`);
                  receiptUrl = uploadedUrl;
                  syncedReceiptsCache.push({ id: ie.id, url: uploadedUrl });
                }
              } catch (err) {
                console.warn(`Failed to sync receipt to cloud storage for entry ${ie.id}:`, err);
              }
            }
            const updatedIe = { ...ie, receiptUrl };
            promises.push(setDoc(doc(db, 'incomeExpenses', ie.id), cleanUndefined(updatedIe)));
            syncedCount++;
          }
        }

        // 4. Sync secretaryHandovers
        if (parsed.secretaryHandovers && parsed.secretaryHandovers.length > 0) {
          for (const hv of parsed.secretaryHandovers) {
            promises.push(setDoc(doc(db, 'secretaryHandovers', hv.id), cleanUndefined(hv)));
            syncedCount++;
          }
        }

        if (promises.length > 0) {
          await Promise.all(promises);
        }

        // Update local app state with the freshly synced Cloud Storage URLs instead of heavy local base64 strings
        setAppData(prev => {
          const updatedEntries = prev.incomeExpenses.map(ie => {
            const cached = syncedReceiptsCache.find(x => x.id === ie.id);
            if (cached) {
              return { ...ie, receiptUrl: cached.url };
            }
            return ie;
          });
          return {
            ...prev,
            logo: logoUrl,
            logoMobile: logoMobileUrl,
            logoDesktop: logoDesktopUrl,
            incomeExpenses: updatedEntries,
          };
        });

        // Clean local/bypass session indicator only after successful synchronization to Firestore in the cloud
        localStorage.removeItem('scc_local_verified_user');
        console.log(`Successfully migrated ${syncedCount} offline/local records to Firestore cloud sync (with Firebase Cloud Storage integration)!`);
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

    const unsubAllowed = onSnapshot(collection(db, 'allowedUsers'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push(d.data());
      });
      setAllowedUsers(list);
      // Sync full allowed users data to localStorage for offline authorization & quick load
      try {
        localStorage.setItem('scc_allowed_users_full', JSON.stringify(list));
        const emails = list.map(u => u.email.toLowerCase().trim()).filter(Boolean);
        localStorage.setItem('scc_permitted_emails', JSON.stringify(emails));
      } catch (e) {
        console.warn("Local caching from snapshots collection failed:", e);
      }
    }, (error) => {
      const errStr = error instanceof Error ? error.message : String(error);
      const isOfflineMsg = errStr.toLowerCase().includes('offline') || 
                           errStr.toLowerCase().includes('unavailable') || 
                           errStr.toLowerCase().includes('network') ||
                           (error && typeof error === 'object' && (error as any).code === 'unavailable');
      if (isOfflineMsg) {
        console.warn("Firestore subscription 'allowedUsers' is using cached values (client offline):", errStr);
      } else {
        console.error("Firestore subscription 'allowedUsers' error:", error);
      }
    });

    return () => unsubAllowed();
  }, [user]);

  // Listen to current logged-in user permissions from allowedUsers collection
  useEffect(() => {
    if (!user) {
      setUserPermissions({ canAdd: true, canEdit: true, canDelete: true });
      return;
    }
    const cleanEmail = user.email ? user.email.toLowerCase().trim() : '';
    if (!cleanEmail) {
      setUserPermissions({ canAdd: true, canEdit: true, canDelete: true });
      return;
    }

    const isSuperAdmin = cleanEmail === 'ignitina2@gmail.com' || cleanEmail === 'ignitina2@mail.com';
    if (isSuperAdmin) {
      setUserPermissions({ canAdd: true, canEdit: true, canDelete: true });
      return;
    }

    const unsubUserPerm = onSnapshot(doc(db, 'allowedUsers', cleanEmail), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.disabled === true) {
          setUserPermissions({ canAdd: false, canEdit: false, canDelete: false });
          signOut(auth).then(() => {
            setUser(null);
            setAuthError({
              message: `Access Revoked: Your account (${cleanEmail}) has been disabled by the administrator.`
            });
          }).catch((e) => console.warn("Failed to sign out disabled user:", e));
        } else {
          setUserPermissions({
            canAdd: data.canAdd !== false,
            canEdit: data.canEdit !== false,
            canDelete: data.canDelete !== false,
          });
        }
      } else {
        // Removed from directory in real-time
        setUserPermissions({ canAdd: false, canEdit: false, canDelete: false });
        signOut(auth).then(() => {
          setUser(null);
          setAuthError({
            message: `Access Revoked: Your account (${cleanEmail}) is no longer authorized on the Trust directory.`
          });
        }).catch((e) => console.warn("Failed to sign out deleted user:", e));
      }
    }, (error) => {
      console.warn("Error listening to user permissions:", error);
    });

    return () => unsubUserPerm();
  }, [user, allowedUsers]);

  // Hook 1: Register active session in Firestore when user changes/logs in
  useEffect(() => {
    if (!user) return;
    
    const registerSession = async () => {
      const cleanEmail = user.email ? user.email.toLowerCase().trim() : '';
      if (!cleanEmail) return;
      
      const safeSessionId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const isSccPrimaryAdmin = cleanEmail === 'ignitina2@gmail.com' || cleanEmail === 'ignitina2@mail.com';
      
      try {
        await setDoc(doc(db, 'userSessions', safeSessionId), {
          email: cleanEmail,
          displayName: user.displayName || user.name || cleanEmail.split('@')[0],
          photoURL: user.photoURL || `https://picsum.photos/seed/${safeSessionId}/100/100`,
          role: isSccPrimaryAdmin ? 'Primary Admin' : 'Authorized Helper',
          lastLoginAt: new Date().toISOString(),
          online: true,
          platform: window.innerWidth < 768 ? 'Mobile App' : 'Desktop Hub'
        }, { merge: true });
      } catch (err) {
        console.warn("Could not register session (might be offline/local bypass):", err);
      }
    };

    registerSession();
  }, [user, allowedUsers]);

  // Hook 2: Subscribe to userSessions in real-time for any logged in user
  useEffect(() => {
    if (!user) {
      setActiveSessions([]);
      return;
    }

    const unsubSessions = onSnapshot(collection(db, 'userSessions'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push(d.data());
      });
      // Sort sessions by lastLoginAt descending so newest logging appears first
      list.sort((a, b) => {
        const dateA = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const dateB = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        return dateB - dateA;
      });
      setActiveSessions(list);
    }, (error) => {
      console.warn("Failed to listen to userSessions:", error);
    });

    return () => unsubSessions();
  }, [user]);

  const addAllowedUser = async (email: string) => {
    if (!user) return;
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return;
    try {
      await setDoc(doc(db, 'allowedUsers', cleanEmail), {
        email: cleanEmail,
        addedAt: new Date().toISOString(),
        addedBy: user.email || 'Admin',
        canAdd: true,
        canEdit: true,
        canDelete: true,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `allowedUsers/${cleanEmail}`);
    }
  };

  const updateAllowedUserPermission = async (email: string, field: 'canAdd' | 'canEdit' | 'canDelete', value: boolean) => {
    if (!user) return;
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return;
    try {
      await updateDoc(doc(db, 'allowedUsers', cleanEmail), {
        [field]: value
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `allowedUsers/${cleanEmail}`);
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
      if (user) {
        const cleanEmail = user.email ? user.email.toLowerCase().trim() : '';
        if (cleanEmail) {
          const safeSessionId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
          // Perform firebase session offline marker as non-blocking background task
          setDoc(doc(db, 'userSessions', safeSessionId), {
            online: false,
            lastLogoutAt: new Date().toISOString()
          }, { merge: true }).catch((e) => {
            console.warn("Could not flag session offline in background:", e);
          });
        }
      }
      localStorage.removeItem('scc_local_verified_user');
      setUser(null);
      setAuthError(null);
      setActiveTab('dashboard');
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Up-sync local state elements to Firestore cloud manually
  const handleSyncLocalToCloud = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    try {
      const promises: Promise<void>[] = [];
      
      for (const t of appData.transactions) {
        promises.push(setDoc(doc(db, 'transactions', t.id), cleanUndefined(t)));
      }
      for (const s of appData.sponsors) {
        promises.push(setDoc(doc(db, 'sponsors', s.id), cleanUndefined(s)));
      }
      for (const e of appData.incomeExpenses || []) {
        promises.push(setDoc(doc(db, 'incomeExpenses', e.id), cleanUndefined(e)));
      }
      for (const h of appData.secretaryHandovers || []) {
        promises.push(setDoc(doc(db, 'secretaryHandovers', h.id), cleanUndefined(h)));
      }
      
      const settingsObj = {
        id: 'appSettings',
        logo: appData.logo || '',
        logoMobile: appData.logoMobile || '',
        logoDesktop: appData.logoDesktop || '',
        notificationsEnabled: !!appData.notificationsEnabled,
        creditSettings: appData.creditSettings || DEFAULT_CREDIT_SETTINGS,
        customPaymentLabels: appData.customPaymentLabels || DEFAULT_PAYMENT_LABELS,
        paymentMethodsList: appData.paymentMethodsList || []
      };
      
      promises.push(setDoc(doc(db, 'settings', 'appSettings'), cleanUndefined(settingsObj)));
      
      if (promises.length > 0) {
        await Promise.all(promises);
      }
      return true;
    } catch (err) {
      console.error("Offline upload migration failed: ", err);
      return false;
    }
  };

  // Firestore Real-Time Subscriptions when logged in
  useEffect(() => {
    if (!user) return;

    let batchPending = false;
    let accumulatedUpdates: Partial<AppData> = {};

    const queueAppDataUpdate = (updates: Partial<AppData>) => {
      accumulatedUpdates = { ...accumulatedUpdates, ...updates };
      if (!batchPending) {
        batchPending = true;
        // 100ms micro-batch window merges simultaneous streams during parallel edits
        setTimeout(() => {
          setAppData(prev => ({
            ...prev,
            ...accumulatedUpdates
          }));
          accumulatedUpdates = {};
          batchPending = false;
        }, 100);
      }
    };

    // Listen to Transactions
    const unsubTx = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((d) => {
        txs.push(d.data() as Transaction);
      });
      txs.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        const valA = isNaN(dateA) ? 0 : dateA;
        const valB = isNaN(dateB) ? 0 : dateB;
        if (valB !== valA) return valB - valA;
        return (b.id || '').localeCompare(a.id || '');
      });

      queueAppDataUpdate({ transactions: txs });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    // Listen to Sponsors
    const unsubSponsors = onSnapshot(collection(db, 'sponsors'), (snapshot) => {
      const sps: Sponsor[] = [];
      snapshot.forEach((d) => {
        sps.push(d.data() as Sponsor);
      });

      queueAppDataUpdate({ sponsors: sps });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sponsors');
    });

    // Listen to Income & Expenses
    const unsubIE = onSnapshot(collection(db, 'incomeExpenses'), (snapshot) => {
      const ies: IncomeExpense[] = [];
      snapshot.forEach((d) => {
        ies.push(d.data() as IncomeExpense);
      });
      ies.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        const valA = isNaN(dateA) ? 0 : dateA;
        const valB = isNaN(dateB) ? 0 : dateB;
        if (valB !== valA) return valB - valA;
        return (b.id || '').localeCompare(a.id || '');
      });

      queueAppDataUpdate({ incomeExpenses: ies });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'incomeExpenses');
    });

    // Listen to Secretary Handovers
    const unsubHandovers = onSnapshot(collection(db, 'secretaryHandovers'), (snapshot) => {
      const hvs: SecretaryHandover[] = [];
      snapshot.forEach((d) => {
        hvs.push(d.data() as SecretaryHandover);
      });
      hvs.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        const valA = isNaN(dateA) ? 0 : dateA;
        const valB = isNaN(dateB) ? 0 : dateB;
        if (valB !== valA) return valB - valA;
        return (b.id || '').localeCompare(a.id || '');
      });

      queueAppDataUpdate({ secretaryHandovers: hvs });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'secretaryHandovers');
    });

    // Listen to settings/appSettings document
    const unsubSettings = onSnapshot(doc(db, 'settings', 'appSettings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const settingsUpdates: Partial<AppData> = {};
        if (data.logo !== undefined) settingsUpdates.logo = data.logo;
        if (data.logoMobile !== undefined) settingsUpdates.logoMobile = data.logoMobile;
        if (data.logoDesktop !== undefined) settingsUpdates.logoDesktop = data.logoDesktop;
        if (data.notificationsEnabled !== undefined) settingsUpdates.notificationsEnabled = data.notificationsEnabled;
        if (data.creditSettings !== undefined) settingsUpdates.creditSettings = data.creditSettings;
        if (data.customPaymentLabels !== undefined) settingsUpdates.customPaymentLabels = data.customPaymentLabels;
        if (data.paymentMethodsList !== undefined) settingsUpdates.paymentMethodsList = data.paymentMethodsList;
        queueAppDataUpdate(settingsUpdates);
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
    if (!userPermissions.canAdd) {
      alert("Permission Denied: Your Primary Admin has restricted you from adding new entries.");
      return;
    }
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
    if (!userPermissions.canEdit) {
      alert("Permission Denied: Your Primary Admin has restricted you from editing entries.");
      return;
    }
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
    if (!userPermissions.canDelete) {
      alert("Permission Denied: Your Primary Admin has restricted you from deleting entries.");
      return;
    }
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
    if (!userPermissions.canEdit) {
      alert("Permission Denied: Your Primary Admin has restricted you from editing entries.");
      return;
    }
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
    if (!userPermissions.canAdd) {
      alert("Permission Denied: Your Primary Admin has restricted you from adding new entries.");
      return;
    }
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
    if (!userPermissions.canEdit) {
      alert("Permission Denied: Your Primary Admin has restricted you from editing entries.");
      return;
    }
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
    if (!userPermissions.canDelete) {
      alert("Permission Denied: Your Primary Admin has restricted you from deleting entries.");
      return;
    }
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
    if (!userPermissions.canAdd) {
      alert("Permission Denied: Your Primary Admin has restricted you from adding new entries.");
      return;
    }
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
    if (!userPermissions.canEdit) {
      alert("Permission Denied: Your Primary Admin has restricted you from editing entries.");
      return;
    }
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
    if (!userPermissions.canDelete) {
      alert("Permission Denied: Your Primary Admin has restricted you from deleting entries.");
      return;
    }
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
    if (!userPermissions.canAdd) {
      alert("Permission Denied: Your Primary Admin has restricted you from adding new entries.");
      return;
    }
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
    if (!userPermissions.canEdit) {
      alert("Permission Denied: Your Primary Admin has restricted you from editing entries.");
      return;
    }
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
    if (!userPermissions.canDelete) {
      alert("Permission Denied: Your Primary Admin has restricted you from deleting entries.");
      return;
    }
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

  const updateLogoMobile = async (logoMobile: string) => {
    if (user) {
      try {
        await setDoc(doc(db, 'settings', 'appSettings'), { logoMobile }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `settings/appSettings`);
      }
    } else {
      setAppData(prev => ({ ...prev, logoMobile }));
    }
  };

  const updateLogoDesktop = async (logoDesktop: string) => {
    if (user) {
      try {
        await setDoc(doc(db, 'settings', 'appSettings'), { logoDesktop }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `settings/appSettings`);
      }
    } else {
      setAppData(prev => ({ ...prev, logoDesktop }));
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

    if (user) {
      const deletePromises: Promise<any>[] = [];
      
      // Transactions
      if (appData.transactions && appData.transactions.length > 0) {
        appData.transactions.forEach(t => {
          deletePromises.push(deleteDoc(doc(db, 'transactions', t.id)));
        });
      }
      
      // Sponsors
      if (appData.sponsors && appData.sponsors.length > 0) {
        appData.sponsors.forEach(s => {
          deletePromises.push(deleteDoc(doc(db, 'sponsors', s.id)));
        });
      }
      
      // IncomeExpenses
      if (appData.incomeExpenses && appData.incomeExpenses.length > 0) {
        appData.incomeExpenses.forEach(ie => {
          deletePromises.push(deleteDoc(doc(db, 'incomeExpenses', ie.id)));
        });
      }
      
      // Secretary Handovers
      if (appData.secretaryHandovers && appData.secretaryHandovers.length > 0) {
        appData.secretaryHandovers.forEach(sh => {
          deletePromises.push(deleteDoc(doc(db, 'secretaryHandovers', sh.id)));
        });
      }
      
      // Keep settings doc reset
      deletePromises.push(setDoc(doc(db, 'settings', 'appSettings'), {
        logo: '',
        logoMobile: '',
        logoDesktop: '',
        notificationsEnabled: false,
        creditSettings: DEFAULT_CREDIT_SETTINGS,
        customPaymentLabels: DEFAULT_PAYMENT_LABELS,
        paymentMethodsList: []
      }));

      try {
        await Promise.all(deletePromises);
      } catch (err) {
        console.error("Failed to clear Cloud Firestore database contents:", err);
      }
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
        if (!isPrimaryAdmin) {
          return (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center max-w-md mx-auto my-12 space-y-4">
              <div className="text-rose-500 bg-rose-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Access Denied</h3>
              <p className="text-slate-500 text-sm">
                Only authorized Trust Administrators have access to Settings & Backup.
              </p>
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
            onAddAllowedUser={addAllowedUser}
            onDeleteAllowedUser={deleteAllowedUser}
            onToggleAllowedUserDisabled={toggleAllowedUserDisabled}
            onUpdateAllowedUserPermission={updateAllowedUserPermission}
            activeSessions={activeSessions}
            onGoogleLogin={handleGoogleLogin}
            onGoogleLogout={handleGoogleLogout}
            isLoggingIn={isLoggingIn}
            onSyncLocalToCloud={handleSyncLocalToCloud}
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

  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={(loggedInUser) => {
          localStorage.setItem('scc_local_verified_user', JSON.stringify(loggedInUser));
          setUser(loggedInUser);
        }}
        handleGoogleLogin={handleGoogleLogin}
        isLoggingIn={isLoggingIn}
        authError={authError}
        setAuthError={setAuthError}
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
        onLogout={handleGoogleLogout}
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
            className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
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
            {/* Global Sync Status for Mobile */}
            <div className={cn(
              "inline-flex items-center justify-center p-1.5 rounded-lg border transition-all duration-300",
              syncStatus === 'connected' && "bg-emerald-50 text-emerald-600 border-emerald-100",
              syncStatus === 'pending' && "bg-amber-50 text-amber-600 border-amber-100 animate-pulse",
              syncStatus === 'offline' && "bg-rose-50 text-rose-600 border-rose-100"
            )} title={syncStatus === 'connected' ? 'Connected to Cloud Firestore' : syncStatus === 'pending' ? 'Changes Sync Pending...' : 'Database Offline Mode'}>
              {syncStatus === 'connected' ? (
                <Cloud size={14} className="text-emerald-500" />
              ) : syncStatus === 'pending' ? (
                <Cloud size={14} className="text-amber-500" />
              ) : (
                <CloudOff size={14} className="text-rose-500" />
              )}
            </div>

            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition-colors px-2 py-0.5 rounded-md flex items-center justify-center shrink-0" title={user.displayName || user.email}>
                  {(() => {
                    const fullName = user.displayName || user.email?.split('@')[0] || '';
                    if (!fullName) return '';
                    const parts = fullName.trim().split(/\s+/);
                    if (parts.length === 1) {
                      return parts[0].substring(0, 2).toUpperCase();
                    }
                    const first = parts[0]?.charAt(0) || '';
                    const last = parts[parts.length - 1]?.charAt(0) || '';
                    return (first + last).toUpperCase();
                  })()}
                </span>
                <button
                  onClick={handleGoogleLogout}
                  title={`Logout (${user.email || 'offline'})`}
                  className="w-7 h-7 rounded-full border border-emerald-300 overflow-hidden shrink-0 shadow-sm relative focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                >
                  <img src={user.photoURL || `https://picsum.photos/seed/${(user.email || 'local').replace(/[^a-zA-Z0-9]/g, '_')}/100/100`} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </button>
              </div>
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
              <img src={appData.logo} alt="Logo" className="w-10 h-10 object-contain rounded-lg shadow-sm" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">C</div>
            )}
            <div className="flex flex-col">
              <h2 className="text-base font-black text-slate-900 tracking-tight">ST.CASIMIR CHARITABLE TRUST</h2>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-0.5">SCC TRUST LUCKY COUPON SALE 2026</p>
            </div>
          </button>
          <div className="flex items-center gap-4">
            {/* Global Sync Status Indicator for Desktop */}
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 border shadow-sm",
              syncStatus === 'connected' && "bg-emerald-50 text-emerald-700 border-emerald-100",
              syncStatus === 'pending' && "bg-amber-50 text-amber-700 border-amber-100 animate-pulse",
              syncStatus === 'offline' && "bg-rose-50 text-rose-700 border-rose-100"
            )}>
              {syncStatus === 'connected' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Cloud size={12} className="text-emerald-600 shrink-0" />
                  <span>Cloud Synced</span>
                </>
              )}
              {syncStatus === 'pending' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                  <Cloud size={12} className="text-amber-600 shrink-0" />
                  <span>Sync Pending</span>
                </>
              )}
              {syncStatus === 'offline' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  <CloudOff size={12} className="text-rose-600 shrink-0" />
                  <span>Offline Mode</span>
                </>
              )}
            </div>

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
                  {user.isLocal ? (
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider flex items-center justify-end gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                      Bypass Sync Active
                    </p>
                  ) : (
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center justify-end gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {isPrimaryAdmin ? 'Primary Admin' : 'Authorized Helper'}
                    </p>
                  )}
                  <p className="text-[11px] font-bold text-slate-700 max-w-[150px] truncate" title={user.displayName || user.email}>
                    {user.displayName || user.email?.split('@')[0] || 'Helper'}
                  </p>
                </div>
                <button
                  onClick={handleGoogleLogout}
                  title={`Logout (${user.email || 'offline'})`}
                  className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden hover:opacity-80 transition-all shrink-0 relative group shadow-inner focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                >
                  <img src={user.photoURL || `https://picsum.photos/seed/${(user.email || 'helper').replace(/[^a-zA-Z0-9]/g, '_')}/100/100`} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
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

          {user && user.isLocal && (
            <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md shadow-indigo-900/5 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-start gap-3.5">
                <span className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-800 self-start md:self-center shrink-0">
                  <CheckCircle size={18} className="stroke-[2.5]" />
                </span>
                <div className="text-left font-sans">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">Bypass Access Synced with Firebase</h4>
                  <p className="text-[11px] text-indigo-800 font-extrabold leading-normal mt-1">
                    You verified your access with email <strong>{user.email}</strong>. Real-time syncing with Google Cloud database is active and working perfectly!
                  </p>
                  <p className="text-[11px] text-indigo-700/80 font-bold leading-normal mt-0.5">
                    Your sales entries are recorded immediately to the central cloud for your secretary and other team members.
                  </p>
                </div>
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
