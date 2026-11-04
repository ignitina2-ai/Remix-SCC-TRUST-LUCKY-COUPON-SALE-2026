import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Gift, 
  Search, 
  CheckCircle2, 
  Clock, 
  ShoppingCart, 
  HandCoins, 
  Scale, 
  LayoutGrid, 
  Table as TableIcon, 
  Download, 
  Upload, 
  RotateCcw, 
  FileText, 
  Filter, 
  Plus, 
  Trash2, 
  Sparkles,
  Info,
  X,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Receipt,
  SlidersHorizontal,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { INITIAL_PRIZES_DATA, PrizeItem, PrizeTrackingInfo, PrizeTrackingMap, ReceivedAmountEntry } from '@/data/prizesData';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { 
  savePrizeStateToFirestore, 
  subscribeToPrizeState, 
  fetchPrizeStateFromFirestore,
  syncPrizeCollectionToGoogleSheet, 
  syncPrizeCollectionViaWebhook 
} from '@/lib/prizeSync';
import { getCachedAccessToken, setCachedAccessToken, auth, db, driveGoogleProvider } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { DEFAULT_WEBHOOK_URL, DriveSyncConfig } from '@/lib/googleDriveSheets';

const STORAGE_KEY_TRACKING = 'stCasimirLuckyDraw2026_tracking';
const STORAGE_KEY_COLLECTED = 'stCasimirLuckyDraw2026_collected';
const STORAGE_KEY_RECEIVED = 'stCasimirLuckyDraw2026_receivedAmounts';
const STORAGE_KEY_SPEED = 'stCasimirLuckyDraw2026_tickerSpeed';
const STORAGE_KEY_LEGACY = 'luckyDrawCollectedPrizesV11';

export default function PrizeCollection({ setActiveTab }: { setActiveTab?: (tab: string) => void } = {}) {
  const [prizes] = useState<PrizeItem[]>(INITIAL_PRIZES_DATA);
  const [prizeTracking, setPrizeTracking] = useState<PrizeTrackingMap>({});
  const [receivedAmounts, setReceivedAmounts] = useState<ReceivedAmountEntry[]>([]);
  const [tickerSpeed, setTickerSpeed] = useState<number>(35);
  const [isLoaded, setIsLoaded] = useState(false);

  // Google Sheets & Cloud Sync state
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('prize_last_sheet_sync_time');
    } catch (e) {
      return null;
    }
  });
  const [sheetLink, setSheetLink] = useState<string | null>(() => {
    try {
      return localStorage.getItem('cached_prize_sheet_link');
    } catch (e) {
      return null;
    }
  });
  const [syncToast, setSyncToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters & Views
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COLLECTED' | 'SPONSOR' | 'TRUST'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Received amount form inputs
  const [newReceivedName, setNewReceivedName] = useState('');
  const [newReceivedAmount, setNewReceivedAmount] = useState('');
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'connecting' | 'synced' | 'error'>('connecting');

  // 1. Initial Load: Load saved collection state strictly without wiping existing entries
  useEffect(() => {
    try {
      const savedTracking = localStorage.getItem(STORAGE_KEY_TRACKING);
      const savedCollected = localStorage.getItem(STORAGE_KEY_COLLECTED);
      const legacyCollected = localStorage.getItem(STORAGE_KEY_LEGACY);
      const savedReceived = localStorage.getItem(STORAGE_KEY_RECEIVED);
      const savedSpeed = localStorage.getItem(STORAGE_KEY_SPEED);

      let parsedTracking: PrizeTrackingMap = {};
      let parsedCollected: Record<string, boolean> = {};

      if (savedCollected) {
        try {
          parsedCollected = JSON.parse(savedCollected);
        } catch (e) {
          console.warn('Failed parsing collected key', e);
        }
      } else if (legacyCollected) {
        try {
          parsedCollected = JSON.parse(legacyCollected);
        } catch (e) {
          console.warn('Failed parsing legacy collected key', e);
        }
      }

      if (savedTracking) {
        try {
          parsedTracking = JSON.parse(savedTracking);
        } catch (e) {
          console.warn('Failed parsing tracking key', e);
        }
      } else {
        // Migrate legacy collected into SPONSOR status
        Object.keys(parsedCollected).forEach(k => {
          if (parsedCollected[k]) {
            parsedTracking[k] = { status: 'SPONSOR', amount: 0 };
          }
        });
      }

      // Ensure all prizes have a valid tracking object if not yet registered
      INITIAL_PRIZES_DATA.forEach(p => {
        if (!parsedTracking[p.prize_no]) {
          const isCollected = !!parsedCollected[p.prize_no];
          parsedTracking[p.prize_no] = {
            status: isCollected ? 'SPONSOR' : 'PENDING',
            amount: 0
          };
        }
      });

      setPrizeTracking(parsedTracking);

      if (savedReceived) {
        try {
          const parsed = JSON.parse(savedReceived);
          if (Array.isArray(parsed)) {
            setReceivedAmounts(parsed);
          }
        } catch (e) {
          console.warn('Failed parsing received amounts', e);
        }
      }

      if (savedSpeed) {
        const num = parseInt(savedSpeed, 10);
        if (!isNaN(num) && num >= 5 && num <= 90) {
          setTickerSpeed(num);
        }
      }
    } catch (err) {
      console.error('Error loading prize collection records:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 1.5 Load Google Sheet configuration & Realtime Firestore sync
  useEffect(() => {
    getDoc(doc(db, 'settings', 'driveSyncConfig')).then(snap => {
      if (snap.exists()) {
        const d = snap.data() as DriveSyncConfig;
        if (d.sheetLink) {
          setSheetLink(d.sheetLink);
          try { localStorage.setItem('cached_prize_sheet_link', d.sheetLink); } catch (e) {}
        }
      }
    }).catch(console.warn);

    const unsub = subscribeToPrizeState(
      (cloudData) => {
        setCloudSyncStatus('synced');
        if (cloudData.tracking && Object.keys(cloudData.tracking).length > 0) {
          // Construct full tracking map based on INITIAL_PRIZES_DATA + cloudData.tracking
          const updatedMap: PrizeTrackingMap = {};
          INITIAL_PRIZES_DATA.forEach(p => {
            updatedMap[p.prize_no] = cloudData.tracking[p.prize_no] || { status: 'PENDING', amount: 0 };
          });
          setPrizeTracking(updatedMap);
          try {
            localStorage.setItem(STORAGE_KEY_TRACKING, JSON.stringify(updatedMap));
            const collectedMap: Record<string, boolean> = {};
            Object.keys(updatedMap).forEach(k => {
              const s = updatedMap[k]?.status;
              collectedMap[k] = (s === 'SPONSOR' || s === 'TRUST');
            });
            localStorage.setItem(STORAGE_KEY_COLLECTED, JSON.stringify(collectedMap));
          } catch (e) {}
        }
        if (Array.isArray(cloudData.receivedAmounts)) {
          setReceivedAmounts(cloudData.receivedAmounts);
          try {
            localStorage.setItem(STORAGE_KEY_RECEIVED, JSON.stringify(cloudData.receivedAmounts));
          } catch (e) {}
        }
      },
      // On empty cloud document, seed Firestore ONLY IF local actually has real collections!
      () => {
        setCloudSyncStatus('synced');
        try {
          const localTracking = localStorage.getItem(STORAGE_KEY_TRACKING);
          const localReceived = localStorage.getItem(STORAGE_KEY_RECEIVED);
          const parsedT: PrizeTrackingMap = localTracking ? JSON.parse(localTracking) : {};
          const parsedR: ReceivedAmountEntry[] = localReceived ? JSON.parse(localReceived) : [];
          const hasRealCollections = Object.values(parsedT).some(t => t.status === 'SPONSOR' || t.status === 'TRUST');
          if (hasRealCollections || parsedR.length > 0) {
            savePrizeStateToFirestore(parsedT, parsedR, auth.currentUser?.email || undefined);
          }
        } catch (e) {}
      },
      (err) => {
        console.warn('PrizeCollection subscription notice:', err);
        setCloudSyncStatus('error');
      }
    );

    return () => unsub();
  }, []);

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Manual refresh from Firestore cloud
  const handleManualCloudRefresh = async () => {
    setIsManualRefreshing(true);
    setCloudSyncStatus('connecting');
    try {
      const cloudState = await fetchPrizeStateFromFirestore();
      if (cloudState.exists) {
        const updatedMap: PrizeTrackingMap = {};
        INITIAL_PRIZES_DATA.forEach(p => {
          updatedMap[p.prize_no] = cloudState.tracking[p.prize_no] || { status: 'PENDING', amount: 0 };
        });
        setPrizeTracking(updatedMap);
        setReceivedAmounts(cloudState.receivedAmounts);
        try {
          localStorage.setItem(STORAGE_KEY_TRACKING, JSON.stringify(updatedMap));
          const colMap: Record<string, boolean> = {};
          Object.keys(updatedMap).forEach(k => {
            const s = updatedMap[k]?.status;
            colMap[k] = (s === 'SPONSOR' || s === 'TRUST');
          });
          localStorage.setItem(STORAGE_KEY_COLLECTED, JSON.stringify(colMap));
          localStorage.setItem(STORAGE_KEY_RECEIVED, JSON.stringify(cloudState.receivedAmounts));
        } catch (e) {}
        setCloudSyncStatus('synced');
        setSyncToast({ type: 'success', message: 'Cloud database fresh data loaded successfully!' });
      } else {
        setCloudSyncStatus('synced');
        setSyncToast({ type: 'success', message: 'Cloud database connected (No remote changes).' });
      }
    } catch (err: any) {
      setCloudSyncStatus('error');
      setSyncToast({ type: 'error', message: err?.message || 'Failed connecting to Cloud' });
    } finally {
      setIsManualRefreshing(false);
      setTimeout(() => setSyncToast(null), 3000);
    }
  };

  // 2. Persistent saving helpers - NEVER wipe entries & sync to Cloud Firestore
  const saveTrackingState = async (updatedTracking: PrizeTrackingMap) => {
    setPrizeTracking(updatedTracking);
    try {
      localStorage.setItem(STORAGE_KEY_TRACKING, JSON.stringify(updatedTracking));

      // Keep collected boolean map in sync for legacy or external tools
      const collectedMap: Record<string, boolean> = {};
      Object.keys(updatedTracking).forEach(k => {
        const s = updatedTracking[k]?.status;
        collectedMap[k] = (s === 'SPONSOR' || s === 'TRUST');
      });
      localStorage.setItem(STORAGE_KEY_COLLECTED, JSON.stringify(collectedMap));
    } catch (e) {
      console.error('Failed saving tracking to localStorage', e);
    }

    // Persist to Cloud Firestore with feedback
    const res = await savePrizeStateToFirestore(updatedTracking, receivedAmounts, auth.currentUser?.email || undefined);
    if (res.success) {
      setCloudSyncStatus('synced');
    } else {
      setCloudSyncStatus('error');
    }
  };

  const saveReceivedState = async (updatedReceived: ReceivedAmountEntry[]) => {
    setReceivedAmounts(updatedReceived);
    try {
      localStorage.setItem(STORAGE_KEY_RECEIVED, JSON.stringify(updatedReceived));
    } catch (e) {
      console.error('Failed saving received amounts to localStorage', e);
    }

    // Persist to Cloud Firestore with feedback
    const res = await savePrizeStateToFirestore(prizeTracking, updatedReceived, auth.currentUser?.email || undefined);
    if (res.success) {
      setCloudSyncStatus('synced');
    } else {
      setCloudSyncStatus('error');
    }
  };

  // 2.5 Direct & Webhook Google Sheets Synchronization Handler
  const handleSyncToGoogleSheet = async (showNotification = true) => {
    setIsSyncingSheet(true);
    let success = false;
    let message = '';
    const nowKolkata = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    try {
      // 1. Sync to Cloud Firestore first
      await savePrizeStateToFirestore(prizeTracking, receivedAmounts, auth.currentUser?.email || undefined);

      // 2. Fetch sheetId and config
      let preferredSheetId: string | undefined;
      let driveConfig: DriveSyncConfig | null = null;
      try {
        const snap = await getDoc(doc(db, 'settings', 'driveSyncConfig'));
        if (snap.exists()) {
          driveConfig = snap.data() as DriveSyncConfig;
          preferredSheetId = driveConfig.sheetId;
        }
      } catch (e) {}

      // 3. Acquire direct token if available or prompt Google Drive sign-in
      let token = getCachedAccessToken();
      if (!token && driveConfig?.activeAccessToken) {
        token = driveConfig.activeAccessToken;
      }

      if (!token) {
        try {
          const authResult = await signInWithPopup(auth, driveGoogleProvider);
          const credential = GoogleAuthProvider.credentialFromResult(authResult);
          if (credential?.accessToken) {
            token = credential.accessToken;
            setCachedAccessToken(token);
            setDoc(doc(db, 'settings', 'driveSyncConfig'), {
              activeAccessToken: token,
              connectedEmail: authResult.user.email,
              tokenUpdatedAt: new Date().toISOString()
            }, { merge: true }).catch(console.warn);
          }
        } catch (popupErr: any) {
          console.warn("Direct OAuth login popup dismissed:", popupErr);
        }
      }

      // If token is available, write directly to Google Sheets API
      if (token) {
        try {
          const directRes = await syncPrizeCollectionToGoogleSheet(token, prizes, prizeTracking, receivedAmounts, preferredSheetId);
          if (directRes.success) {
            success = true;
            message = directRes.message;
            if (directRes.webViewLink) {
              setSheetLink(directRes.webViewLink);
              try { localStorage.setItem('cached_prize_sheet_link', directRes.webViewLink); } catch (e) {}
            }
          }
        } catch (directErr: any) {
          console.warn("Direct Sheets API sync notice:", directErr);
        }
      }

      // 4. Also dispatch to Apps Script Webhook
      let webhookUrl = (driveConfig?.webhookUrl || DEFAULT_WEBHOOK_URL).trim();
      try {
        const local = localStorage.getItem('cached_gas_webhook_url');
        if (local && local.trim()) webhookUrl = local.trim();
      } catch (e) {}

      if (webhookUrl) {
        const webhookRes = await syncPrizeCollectionViaWebhook(webhookUrl, prizes, prizeTracking, receivedAmounts);
        if (webhookRes.success && !success) {
          success = true;
          message = webhookRes.message;
        }
      }

      if (success) {
        setLastSyncedTime(nowKolkata);
        try { localStorage.setItem('prize_last_sheet_sync_time', nowKolkata); } catch (e) {}
        if (showNotification) {
          setSyncToast({
            type: 'success',
            message: 'Google Sheet-ലേക്ക് സമ്മാന വിവരങ്ങൾ (PRIZE COLLECTION) വിജയകരമായി അപ്‌ഡേറ്റ് ചെയ്തു!'
          });
          setTimeout(() => setSyncToast(null), 4000);
        }
      } else {
        if (showNotification) {
          setSyncToast({
            type: 'error',
            message: message || 'Google Sheet സിങ്ക് ചെയ്യുന്നതിൽ തടസ്സം നേരിട്ടു. ദയവായി Google Drive കണക്ട് ചെയ്യുക.'
          });
          setTimeout(() => setSyncToast(null), 4000);
        }
      }
    } catch (err: any) {
      console.error("Sheet sync failed:", err);
      if (showNotification) {
        setSyncToast({
          type: 'error',
          message: err?.message || 'Google Sheet സിങ്ക് പരാജയപ്പെട്ടു'
        });
        setTimeout(() => setSyncToast(null), 4000);
      }
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Status Change Handler
  const handleStatusChange = (prizeNo: string, newStatus: 'PENDING' | 'SPONSOR' | 'TRUST') => {
    const current = prizeTracking[prizeNo] || { status: 'PENDING', amount: 0 };
    const updated = {
      ...prizeTracking,
      [prizeNo]: {
        ...current,
        status: newStatus
      }
    };
    saveTrackingState(updated);
  };

  // Trust Cost Input Handler
  const handleTrustCostChange = (prizeNo: string, costStr: string) => {
    const num = parseFloat(costStr);
    const validAmount = isNaN(num) || num < 0 ? 0 : num;
    const current = prizeTracking[prizeNo] || { status: 'TRUST', amount: 0 };
    const updated = {
      ...prizeTracking,
      [prizeNo]: {
        ...current,
        amount: validAmount
      }
    };
    saveTrackingState(updated);
  };

  // Add Received Amount
  const handleAddReceivedAmount = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newReceivedName.trim();
    const amount = parseFloat(newReceivedAmount);
    if (!name || isNaN(amount) || amount < 0) return;

    const newEntry: ReceivedAmountEntry = {
      id: Date.now().toString(),
      name,
      amount,
      date: new Date().toISOString()
    };

    const updated = [newEntry, ...receivedAmounts];
    saveReceivedState(updated);
    setNewReceivedName('');
    setNewReceivedAmount('');
  };

  // Delete Received Amount
  const handleDeleteReceivedAmount = (index: number) => {
    const updated = [...receivedAmounts];
    updated.splice(index, 1);
    saveReceivedState(updated);
  };

  // Categories extraction
  const categories = useMemo(() => {
    const catSet = new Set<string>();
    prizes.forEach(p => {
      catSet.add(p.prize_item.trim().toUpperCase());
    });
    return Array.from(catSet).sort();
  }, [prizes]);

  // Overall Statistics Calculations
  const stats = useMemo(() => {
    const total = prizes.length;
    let collectedCount = 0;
    let sponsorCount = 0;
    let trustCount = 0;
    let trustTotalAmount = 0;

    prizes.forEach(p => {
      const track = prizeTracking[p.prize_no];
      if (!track) return;
      if (track.status === 'SPONSOR') {
        collectedCount++;
        sponsorCount++;
      } else if (track.status === 'TRUST') {
        collectedCount++;
        trustCount++;
        trustTotalAmount += (Number(track.amount) || 0);
      }
    });

    const pendingCount = total - collectedCount;
    const percentCollected = total > 0 ? Math.round((collectedCount / total) * 100) : 0;
    const totalReceivedAmount = receivedAmounts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const balanceAmount = totalReceivedAmount - trustTotalAmount;

    return {
      total,
      collectedCount,
      sponsorCount,
      trustCount,
      pendingCount,
      percentCollected,
      trustTotalAmount,
      totalReceivedAmount,
      balanceAmount
    };
  }, [prizes, prizeTracking, receivedAmounts]);

  // Category counts map for ticker and drawer
  const categoryStatsMap = useMemo(() => {
    const map: Record<string, { total: number; collected: number }> = {};
    prizes.forEach(p => {
      const cat = p.prize_item.trim().toUpperCase();
      if (!map[cat]) map[cat] = { total: 0, collected: 0 };
      map[cat].total++;
      const track = prizeTracking[p.prize_no];
      if (track && (track.status === 'SPONSOR' || track.status === 'TRUST')) {
        map[cat].collected++;
      }
    });
    return map;
  }, [prizes, prizeTracking]);

  // Filtered prizes list
  const filteredPrizes = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return prizes.filter(p => {
      const matchSearch = !q || 
        p.prize_no.toLowerCase().includes(q) ||
        p.prize_item.toLowerCase().includes(q) ||
        p.display_sponsor.toLowerCase().includes(q) ||
        p.origin_sponsor.toLowerCase().includes(q);

      const catNormalized = p.prize_item.trim().toUpperCase();
      const matchCategory = selectedCategory === 'ALL' || catNormalized === selectedCategory;

      const track = prizeTracking[p.prize_no] || { status: 'PENDING', amount: 0 };
      let matchStatus = true;
      if (statusFilter === 'COLLECTED') {
        matchStatus = (track.status === 'SPONSOR' || track.status === 'TRUST');
      } else if (statusFilter === 'PENDING') {
        matchStatus = (track.status === 'PENDING');
      } else if (statusFilter === 'SPONSOR') {
        matchStatus = (track.status === 'SPONSOR');
      } else if (statusFilter === 'TRUST') {
        matchStatus = (track.status === 'TRUST');
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [prizes, searchTerm, selectedCategory, statusFilter, prizeTracking]);

  // Export JSON Backup
  const handleExportJSON = () => {
    const backupData = {
      appName: "St. Casimir Charitable Trust — Lucky Draw 2026",
      version: "2.7",
      createdDate: new Date().toISOString(),
      prizeTracking,
      collectedPrizes: Object.fromEntries(
        (Object.entries(prizeTracking) as [string, PrizeTrackingInfo][]).map(([k, v]) => [k, v.status === 'SPONSOR' || v.status === 'TRUST'])
      ),
      receivedAmounts,
      tickerSpeed,
      prizesData: INITIAL_PRIZES_DATA
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `StCasimir_PrizeCollection_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON Backup
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || (!parsed.prizeTracking && !parsed.collectedPrizes)) {
          alert("Invalid backup file: Missing prize tracking structure.");
          return;
        }

        if (window.confirm(`Restore backup created on ${new Date(parsed.createdDate || Date.now()).toLocaleString()}? Existing entries will be updated with the backup file data.`)) {
          let newTracking: PrizeTrackingMap = {};
          if (parsed.prizeTracking) {
            newTracking = parsed.prizeTracking;
          } else if (parsed.collectedPrizes) {
            Object.keys(parsed.collectedPrizes).forEach(k => {
              if (parsed.collectedPrizes[k]) {
                newTracking[k] = { status: 'SPONSOR', amount: 0 };
              }
            });
          }

          saveTrackingState(newTracking);
          if (Array.isArray(parsed.receivedAmounts)) {
            saveReceivedState(parsed.receivedAmounts);
          }
          if (parsed.tickerSpeed) {
            setTickerSpeed(Number(parsed.tickerSpeed));
            localStorage.setItem(STORAGE_KEY_SPEED, parsed.tickerSpeed.toString());
          }
          alert("Data restored successfully!");
        }
      } catch (err: any) {
        alert("Error importing file: " + err.message);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // Reset All Records (marked with careful confirmation to prevent accidental wipe)
  const handleResetRecords = () => {
    const newTracking: PrizeTrackingMap = {};
    INITIAL_PRIZES_DATA.forEach(p => {
      newTracking[p.prize_no] = { status: 'PENDING', amount: 0 };
    });
    saveTrackingState(newTracking);
    setShowConfirmReset(false);
  };

  // Export PDF Report
  const handleExportPDF = (type: 'all' | 'collected' | 'pending') => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let title = "St. Casimir Lucky Draw 2026 — Full Prizes Report (111 Records)";
    let list = prizes;

    if (type === 'collected') {
      title = "St. Casimir Lucky Draw 2026 — Collected Items Report";
      list = prizes.filter(p => {
        const s = prizeTracking[p.prize_no]?.status;
        return s === 'SPONSOR' || s === 'TRUST';
      });
    } else if (type === 'pending') {
      title = "St. Casimir Lucky Draw 2026 — Pending Items Report";
      list = prizes.filter(p => {
        const s = prizeTracking[p.prize_no]?.status || 'PENDING';
        return s === 'PENDING';
      });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(27, 94, 32);
    doc.text("ST. CASIMIR CHARITABLE TRUST, KADAVOOR", 14, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);
    doc.text("Kollam, Kerala • Lucky Draw 2026 Prize Management", 14, 21);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title, 14, 28);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | Total: ${stats.total} | Collected: ${stats.collectedCount} (${stats.percentCollected}%) | Trust Cost: Rs. ${stats.trustTotalAmount.toLocaleString('en-IN')}`, 14, 34);

    const tableRows = list.map(p => {
      const track = prizeTracking[p.prize_no] || { status: 'PENDING', amount: 0 };
      let statusText = 'Pending';
      if (track.status === 'SPONSOR') statusText = 'Own / Sponsor';
      if (track.status === 'TRUST') statusText = `Trust Purchase (Rs. ${(track.amount || 0).toLocaleString('en-IN')})`;

      return [
        p.prize_no,
        p.prize_item,
        p.display_sponsor,
        statusText
      ];
    });

    autoTable(doc, {
      head: [['Prize No.', 'Prize Item', 'Display Sponsor', 'Status']],
      body: tableRows,
      startY: 38,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [27, 94, 32], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 46, fontStyle: 'bold' },
        2: { cellWidth: 70 },
        3: { cellWidth: 42, fontStyle: 'bold' }
      }
    });

    doc.save(`StCasimir_LuckyDraw_PrizeReport_${type}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans animate-in fade-in-50 duration-300">
      {/* Toast Notification */}
      {syncToast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold animate-in fade-in slide-in-from-bottom-2",
          syncToast.type === 'success' 
            ? "bg-emerald-50 text-emerald-900 border-emerald-300" 
            : "bg-rose-50 text-rose-900 border-rose-300"
        )}>
          {syncToast.type === 'success' ? (
            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
          )}
          <span>{syncToast.message}</span>
          <button 
            onClick={() => setSyncToast(null)}
            className="p-1 hover:bg-slate-200/50 rounded-lg text-slate-500 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}



      {/* Page Title & Cloud Sync Live Status */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-tight uppercase">Prize Collection</h1>
          <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-slate-200">
            {stats.total} Prizes
          </span>
        </div>
        <div className="flex items-center gap-2">
          {cloudSyncStatus === 'synced' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Firebase Live Synced
            </span>
          ) : cloudSyncStatus === 'connecting' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-spin"></span>
              Connecting Cloud...
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Offline Cache
            </span>
          )}

          <button
            onClick={handleManualCloudRefresh}
            disabled={isManualRefreshing}
            title="Refresh from Firebase Cloud Database"
            className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all border border-slate-200 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={11} className={isManualRefreshing ? "animate-spin text-blue-600" : "text-slate-600"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Dashboard KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-wider">
            <span>Total Prizes</span>
            <Gift size={16} className="text-slate-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-slate-900">{stats.total}</span>
            <span className="text-[10px] font-bold text-slate-400">100% Items</span>
          </div>
        </div>

        {/* 2. Collected */}
        <div className="bg-emerald-50/50 p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800 text-[10px] font-black uppercase tracking-wider">
            <span>Collected</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-emerald-700">{stats.collectedCount}</span>
              <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                {stats.percentCollected}%
              </span>
            </div>
            <p className="text-[10px] font-bold text-emerald-600 mt-1 truncate">
              {stats.sponsorCount} Sponsor • {stats.trustCount} Trust
            </p>
          </div>
        </div>

        {/* 3. Pending */}
        <div className="bg-rose-50/50 p-3.5 sm:p-4 rounded-2xl border border-rose-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-800 text-[10px] font-black uppercase tracking-wider">
            <span>Pending</span>
            <Clock size={16} className="text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-rose-700">{stats.pendingCount}</span>
            <span className="text-[10px] font-black text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
              {100 - stats.percentCollected}%
            </span>
          </div>
        </div>

        {/* 4. Trust Expense */}
        <div className="bg-teal-50/50 p-3.5 sm:p-4 rounded-2xl border border-teal-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-teal-800 text-[10px] font-black uppercase tracking-wider">
            <span>Trust Expense</span>
            <ShoppingCart size={16} className="text-teal-600" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-lg sm:text-xl font-black text-teal-800 truncate">
                ₹{stats.trustTotalAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-[10px] font-bold text-teal-600 mt-1 truncate">
              {stats.trustCount} Items purchased
            </p>
          </div>
        </div>

        {/* 5. Received Amount */}
        <div className="bg-blue-50/50 p-3.5 sm:p-4 rounded-2xl border border-blue-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-800 text-[10px] font-black uppercase tracking-wider">
            <span>Received Amount</span>
            <HandCoins size={16} className="text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-lg sm:text-xl font-black text-blue-800 truncate">
                ₹{stats.totalReceivedAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-[10px] font-bold text-blue-600 mt-1 truncate">
              {receivedAmounts.length} Sponsor Entries
            </p>
          </div>
        </div>

        {/* 6. Balance */}
        <div className="bg-purple-50/50 p-3.5 sm:p-4 rounded-2xl border border-purple-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-800 text-[10px] font-black uppercase tracking-wider">
            <span>Net Balance</span>
            <Scale size={16} className="text-purple-600" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className={cn(
                "text-lg sm:text-xl font-black truncate",
                stats.balanceAmount >= 0 ? "text-purple-800" : "text-rose-700"
              )}>
                ₹{stats.balanceAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-[10px] font-bold text-purple-600 mt-1 truncate">
              Received - Trust Exp.
            </p>
          </div>
        </div>
      </div>

      {/* Category Banner if filtered */}
      {selectedCategory !== 'ALL' && (
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-emerald-700" />
            <span className="font-bold text-sm">Active Category Filter: <span className="text-emerald-800 uppercase">{selectedCategory}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-black bg-white px-3 py-1 rounded-xl border border-emerald-200 shadow-2xs">
              Collected: {categoryStatsMap[selectedCategory]?.collected || 0} / Total: {categoryStatsMap[selectedCategory]?.total || 0}
            </span>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Search, Category, Status & View Toggle Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by prize name, prize number (e.g. 1st Prize), or sponsor details..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <div className="flex-1 min-w-[150px]">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex-1 min-w-[150px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Only ({stats.pendingCount})</option>
              <option value="COLLECTED">Collected (All) ({stats.collectedCount})</option>
              <option value="SPONSOR">Own / Sponsor ({stats.sponsorCount})</option>
              <option value="TRUST">Trust Purchase ({stats.trustCount})</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === 'grid' 
                  ? "bg-white text-emerald-800 shadow-2xs" 
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === 'table' 
                  ? "bg-white text-emerald-800 shadow-2xs" 
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <TableIcon size={14} />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
        </div>

        {/* Result counts info */}
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1 pt-1 border-t border-slate-100">
          <span>Showing {filteredPrizes.length} of {prizes.length} prizes</span>
          <span>
            {statusFilter !== 'ALL' || selectedCategory !== 'ALL' || searchTerm ? (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('ALL');
                  setStatusFilter('ALL');
                }}
                className="text-emerald-700 hover:underline cursor-pointer"
              >
                Reset All Filters
              </button>
            ) : null}
          </span>
        </div>
      </div>

      {/* Prize Displays */}
      {filteredPrizes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <Search size={22} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No prizes matched your criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search terms or changing the category/status filters.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('ALL');
              setStatusFilter('ALL');
            }}
            className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 transition"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPrizes.map((p) => {
            const track = prizeTracking[p.prize_no] || { status: 'PENDING', amount: 0 };
            const status = track.status;
            const amount = Number(track.amount) || 0;

            let cardBorder = 'border-rose-200/90 bg-rose-50/30';
            let badgeBg = 'bg-rose-600 text-white';
            let selectBorder = 'border-rose-300 text-rose-800 bg-rose-50';

            if (status === 'SPONSOR') {
              cardBorder = 'border-blue-200/90 bg-blue-50/30';
              badgeBg = 'bg-blue-600 text-white';
              selectBorder = 'border-blue-300 text-blue-800 bg-blue-50';
            } else if (status === 'TRUST') {
              cardBorder = 'border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-200/60';
              badgeBg = 'bg-emerald-600 text-white';
              selectBorder = 'border-emerald-300 text-emerald-800 bg-emerald-50';
            }

            return (
              <div 
                key={p.prize_no}
                className={cn(
                  "rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 shadow-2xs hover:shadow-md",
                  cardBorder
                )}
              >
                <div>
                  {/* Card Header: Prize No badge & Status dropdown */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn("text-xs font-black px-2.5 py-1 rounded-lg shadow-2xs tracking-tight", badgeBg)}>
                      {p.prize_no}
                    </span>

                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(p.prize_no, e.target.value as any)}
                      className={cn(
                        "text-xs font-black rounded-xl px-2.5 py-1.5 border shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer",
                        selectBorder
                      )}
                    >
                      <option value="PENDING">⏳ Pending</option>
                      <option value="SPONSOR">🎁 Own / Sponsor</option>
                      <option value="TRUST">🛒 Trust Purchase</option>
                    </select>
                  </div>

                  {/* Prize Item Name */}
                  <h3 className="font-black text-slate-900 text-base mb-2.5 tracking-tight">
                    {p.prize_item}
                  </h3>

                  {/* Malayalam Display Sponsor Box */}
                  <div className="space-y-2 bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                        Display Sponsor
                      </span>
                      <p className="font-malayalam text-emerald-800 font-bold text-xs sm:text-[13px] leading-relaxed">
                        {p.display_sponsor}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                        Original Sponsor Details
                      </span>
                      <p className="font-malayalam text-slate-600 text-[11px] leading-relaxed">
                        {p.origin_sponsor}
                      </p>
                    </div>
                  </div>

                  {/* Trust Purchase Cost Field */}
                  {status === 'TRUST' && (
                    <div className="mt-3 bg-teal-50 border border-teal-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-teal-900 font-black text-xs shrink-0">
                        <Receipt size={14} className="text-teal-700" />
                        <span>Trust Cost:</span>
                      </div>
                      <div className="flex items-center gap-1 flex-1 max-w-[140px]">
                        <span className="text-xs font-bold text-teal-900">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Amount"
                          defaultValue={amount > 0 ? amount : ''}
                          onBlur={(e) => handleTrustCostChange(p.prize_no, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleTrustCostChange(p.prize_no, (e.target as HTMLInputElement).value);
                            }
                          }}
                          className="w-full text-xs font-black px-2 py-1 bg-white border border-teal-300 rounded-lg text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-inner"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                  <th className="py-3 px-4">Prize #</th>
                  <th className="py-3 px-4">Prize Item</th>
                  <th className="py-3 px-4">Display Sponsor</th>
                  <th className="py-3 px-4">Original Details</th>
                  <th className="py-3 px-4 text-center">Status / Trust Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPrizes.map((p) => {
                  const track = prizeTracking[p.prize_no] || { status: 'PENDING', amount: 0 };
                  const status = track.status;
                  const amount = Number(track.amount) || 0;

                  let rowBg = 'hover:bg-slate-50/80';
                  let selectBorder = 'border-rose-300 text-rose-800 bg-rose-50';

                  if (status === 'SPONSOR') {
                    rowBg = 'bg-blue-50/30 hover:bg-blue-50/60';
                    selectBorder = 'border-blue-300 text-blue-800 bg-blue-50';
                  } else if (status === 'TRUST') {
                    rowBg = 'bg-emerald-50/40 hover:bg-emerald-50/70';
                    selectBorder = 'border-emerald-300 text-emerald-800 bg-emerald-50';
                  }

                  return (
                    <tr key={p.prize_no} className={cn("transition-colors", rowBg)}>
                      <td className="py-3 px-4 font-black text-emerald-900 shrink-0 whitespace-nowrap">
                        {p.prize_no}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 whitespace-nowrap">
                        {p.prize_item}
                      </td>
                      <td className="py-3 px-4 font-malayalam font-bold text-emerald-800 min-w-[200px]">
                        {p.display_sponsor}
                      </td>
                      <td className="py-3 px-4 font-malayalam text-slate-600 text-xs min-w-[180px] max-w-xs truncate" title={p.origin_sponsor}>
                        {p.origin_sponsor}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <select
                            value={status}
                            onChange={(e) => handleStatusChange(p.prize_no, e.target.value as any)}
                            className={cn(
                              "text-xs font-black rounded-lg px-2 py-1 border shadow-2xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer",
                              selectBorder
                            )}
                          >
                            <option value="PENDING">⏳ Pending</option>
                            <option value="SPONSOR">🎁 Sponsor</option>
                            <option value="TRUST">🛒 Trust</option>
                          </select>

                          {status === 'TRUST' && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-teal-800">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="Amount"
                                defaultValue={amount > 0 ? amount : ''}
                                onBlur={(e) => handleTrustCostChange(p.prize_no, e.target.value)}
                                className="w-20 text-[11px] font-black px-1.5 py-0.5 border border-teal-300 rounded text-teal-950 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Received Amounts Ledger Management */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <HandCoins size={20} className="text-blue-600" />
            <h2 className="font-black text-slate-900 text-base">Received Amount Ledger</h2>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {receivedAmounts.length} Entries
            </span>
          </div>
          <div className="text-sm font-black text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
            Total Received: ₹{stats.totalReceivedAmount.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Add Form */}
        <form onSubmit={handleAddReceivedAmount} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            required
            placeholder="Contributor / Sponsor Name (e.g. Joy Varghese)"
            value={newReceivedName}
            onChange={(e) => setNewReceivedName(e.target.value)}
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
          <div className="relative sm:w-48">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
            <input
              type="number"
              required
              min="0"
              step="any"
              placeholder="Amount"
              value={newReceivedAmount}
              onChange={(e) => setNewReceivedAmount(e.target.value)}
              className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer shrink-0"
          >
            <Plus size={15} />
            <span>Add Entry</span>
          </button>
        </form>

        {/* Entries List */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {receivedAmounts.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3 text-center">No received amounts added yet.</p>
          ) : (
            receivedAmounts.map((entry, idx) => (
              <div 
                key={entry.id || idx}
                className="flex items-center justify-between gap-3 bg-blue-50/50 border border-blue-100 rounded-xl px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {entry.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-black text-blue-800 bg-white px-2.5 py-1 rounded-lg border border-blue-200">
                    ₹{(Number(entry.amount) || 0).toLocaleString('en-IN')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteReceivedAmount(idx)}
                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition"
                    title="Delete Entry"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Category Summary Modal / Drawer */}
      {showCategoryDrawer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in-50 duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-emerald-700" />
                <h3 className="font-black text-slate-900 text-base">Category-Wise Collected Summary</h3>
              </div>
              <button
                onClick={() => setShowCategoryDrawer(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {(Object.entries(categoryStatsMap) as [string, { total: number; collected: number }][]).map(([cat, data], idx) => {
                const pct = data.total > 0 ? Math.round((data.collected / data.total) * 100) : 0;
                return (
                  <div 
                    key={idx}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowCategoryDrawer(false);
                    }}
                    className="flex items-center justify-between bg-slate-50 hover:bg-emerald-50/60 p-3 rounded-xl border border-slate-200 cursor-pointer transition-all"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-800 text-xs truncate uppercase">{cat}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{pct}% collected</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-slate-900">
                        {data.collected} / {data.total}
                      </span>
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full",
                        pct === 100 ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                      )}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowCategoryDrawer(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Reset Modal */}
      {showConfirmReset && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <h3 className="font-black text-slate-900 text-base">Reset Prize Collection?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to reset all 111 prizes to "Pending"? Existing received amount entries will be preserved, but all prize statuses will be reset.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleResetRecords}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black"
              >
                Yes, Reset Statuses
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
