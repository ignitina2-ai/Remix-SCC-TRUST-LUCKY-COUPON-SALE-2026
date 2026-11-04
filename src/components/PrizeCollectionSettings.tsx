import React, { useState, useEffect, useMemo } from 'react';
import { 
  SlidersHorizontal, 
  Gift, 
  Download, 
  Upload, 
  FileText, 
  PieChart, 
  CheckCircle2, 
  Clock, 
  HandCoins, 
  Scale, 
  AlertCircle, 
  Check, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  RefreshCw, 
  FileCheck, 
  ArrowRight,
  ShieldCheck,
  Printer,
  Sparkles,
  Search,
  ExternalLink,
  FileSpreadsheet,
  Database,
  Code2,
  FolderSync,
  X
} from 'lucide-react';
import { INITIAL_PRIZES_DATA, PrizeItem, PrizeTrackingInfo, PrizeTrackingMap, ReceivedAmountEntry } from '@/data/prizesData';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { 
  savePrizeStateToFirestore, 
  subscribeToPrizeState, 
  syncPrizeCollectionToGoogleSheet, 
  syncPrizeCollectionViaWebhook 
} from '@/lib/prizeSync';
import { getCachedAccessToken, setCachedAccessToken, driveGoogleProvider, auth, db } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { DEFAULT_WEBHOOK_URL, DriveSyncConfig, GOOGLE_APPS_SCRIPT_CODE } from '@/lib/googleDriveSheets';

const STORAGE_KEY_TRACKING = 'stCasimirLuckyDraw2026_tracking';
const STORAGE_KEY_COLLECTED = 'stCasimirLuckyDraw2026_collected';
const STORAGE_KEY_RECEIVED = 'stCasimirLuckyDraw2026_receivedAmounts';
const STORAGE_KEY_SPEED = 'stCasimirLuckyDraw2026_tickerSpeed';
const STORAGE_KEY_LEGACY = 'luckyDrawCollectedPrizesV11';

interface PrizeCollectionSettingsProps {
  setActiveTab?: (tab: string) => void;
}

export default function PrizeCollectionSettings({ setActiveTab }: PrizeCollectionSettingsProps) {
  const [prizes] = useState<PrizeItem[]>(INITIAL_PRIZES_DATA);
  const [prizeTracking, setPrizeTracking] = useState<PrizeTrackingMap>({});
  const [receivedAmounts, setReceivedAmounts] = useState<ReceivedAmountEntry[]>([]);
  const [tickerSpeed, setTickerSpeed] = useState<number>(35);
  const [isLoaded, setIsLoaded] = useState(false);

  // Category filter / search in summary
  const [categorySearch, setCategorySearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Restore state
  const [restoreJsonInput, setRestoreJsonInput] = useState('');
  const [showRestorePreview, setShowRestorePreview] = useState(false);
  const [restorePreviewData, setRestorePreviewData] = useState<{
    trackingCount: number;
    collectedCount: number;
    receivedCount: number;
    createdDate?: string;
    parsedObj: any;
  } | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedBackup, setCopiedBackup] = useState(false);

  // PDF Export loading indicator
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Google Sheet & Cloud Sync state
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
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    try {
      const cached = localStorage.getItem('cached_gas_webhook_url');
      if (cached && cached.trim()) return cached.trim();
    } catch (e) {}
    return DEFAULT_WEBHOOK_URL;
  });
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Load existing data from localStorage without wiping anything
  useEffect(() => {
    try {
      const savedTracking = localStorage.getItem(STORAGE_KEY_TRACKING);
      const savedCollected = localStorage.getItem(STORAGE_KEY_COLLECTED);
      const legacyCollected = localStorage.getItem(STORAGE_KEY_LEGACY);
      const savedReceived = localStorage.getItem(STORAGE_KEY_RECEIVED);
      const savedSpeed = localStorage.getItem(STORAGE_KEY_SPEED);

      let parsedTracking: PrizeTrackingMap = {};

      if (savedCollected) {
        try {
          const col = JSON.parse(savedCollected);
          Object.keys(col).forEach(k => {
            if (col[k]) {
              parsedTracking[k] = { status: 'SPONSOR', amount: 0 };
            }
          });
        } catch (e) {
          console.error(e);
        }
      } else if (legacyCollected) {
        try {
          const leg = JSON.parse(legacyCollected);
          Object.keys(leg).forEach(k => {
            if (leg[k]) {
              parsedTracking[k] = { status: 'SPONSOR', amount: 0 };
            }
          });
        } catch (e) {
          console.error(e);
        }
      }

      if (savedTracking) {
        try {
          const trk = JSON.parse(savedTracking);
          parsedTracking = { ...parsedTracking, ...trk };
        } catch (e) {
          console.error(e);
        }
      }

      // Initialize default for any missing prize
      INITIAL_PRIZES_DATA.forEach(p => {
        if (!parsedTracking[p.prize_no]) {
          parsedTracking[p.prize_no] = { status: 'PENDING', amount: 0 };
        }
      });

      setPrizeTracking(parsedTracking);

      if (savedReceived) {
        try {
          const rec = JSON.parse(savedReceived);
          if (Array.isArray(rec)) {
            setReceivedAmounts(rec);
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (savedSpeed) {
        const sp = Number(savedSpeed);
        if (!isNaN(sp) && sp > 5 && sp < 120) {
          setTickerSpeed(sp);
        }
      }
    } catch (err) {
      console.error('Error loading prize settings data', err);
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
        if (d.webhookUrl) {
          setWebhookUrl(d.webhookUrl);
        }
      }
    }).catch(console.warn);

    const unsub = subscribeToPrizeState((cloudData) => {
      if (cloudData.tracking && Object.keys(cloudData.tracking).length > 0) {
        setPrizeTracking(prev => ({ ...prev, ...cloudData.tracking }));
      }
      if (cloudData.receivedAmounts && cloudData.receivedAmounts.length > 0) {
        setReceivedAmounts(cloudData.receivedAmounts);
      }
    });

    return () => unsub();
  }, []);

  // Sync tracking to storage and Cloud Firestore
  const saveTrackingState = (updated: PrizeTrackingMap) => {
    setPrizeTracking(updated);
    try {
      localStorage.setItem(STORAGE_KEY_TRACKING, JSON.stringify(updated));
      const colMap: Record<string, boolean> = {};
      (Object.entries(updated) as [string, PrizeTrackingInfo][]).forEach(([key, val]) => {
        colMap[key] = (val.status === 'SPONSOR' || val.status === 'TRUST');
      });
      localStorage.setItem(STORAGE_KEY_COLLECTED, JSON.stringify(colMap));
      localStorage.setItem(STORAGE_KEY_LEGACY, JSON.stringify(colMap));
    } catch (e) {
      console.error('Failed saving tracking to localStorage', e);
    }

    // Persist to Cloud Firestore
    savePrizeStateToFirestore(updated, receivedAmounts, auth.currentUser?.email || undefined);
  };

  // Sync received state to storage and Cloud Firestore
  const saveReceivedState = (updatedReceived: ReceivedAmountEntry[]) => {
    setReceivedAmounts(updatedReceived);
    try {
      localStorage.setItem(STORAGE_KEY_RECEIVED, JSON.stringify(updatedReceived));
    } catch (e) {
      console.error('Failed saving received amounts', e);
    }

    // Persist to Cloud Firestore
    savePrizeStateToFirestore(prizeTracking, updatedReceived, auth.currentUser?.email || undefined);
  };

  // Google Sheets Synchronization Handler
  const handleSyncToGoogleSheet = async () => {
    setIsSyncingSheet(true);
    let success = false;
    let message = '';
    const nowKolkata = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    try {
      // 1. Cloud Firestore realtime backup
      await savePrizeStateToFirestore(prizeTracking, receivedAmounts, auth.currentUser?.email || undefined);

      // 2. Query configured Drive Sync configuration
      let preferredSheetId: string | undefined = undefined;
      let driveConfig: DriveSyncConfig | null = null;
      try {
        const snap = await getDoc(doc(db, 'settings', 'driveSyncConfig'));
        if (snap.exists()) {
          driveConfig = snap.data() as DriveSyncConfig;
          preferredSheetId = driveConfig.sheetId;
        }
      } catch (e) {}

      // 3. Acquire OAuth token if available, or prompt Drive sign-in popup
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

      // If token is available, write directly to Google Sheets REST API
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
      let currentWebhook = webhookUrl || DEFAULT_WEBHOOK_URL;
      const webhookRes = await syncPrizeCollectionViaWebhook(currentWebhook, prizes, prizeTracking, receivedAmounts);
      if (webhookRes.success) {
        success = true;
        message = message || webhookRes.message;
      }

      if (success) {
        setLastSyncedTime(nowKolkata);
        try { localStorage.setItem('prize_last_sheet_sync_time', nowKolkata); } catch (e) {}
        setRestoreMessage({
          type: 'success',
          text: 'Google Sheet-ലേക്ക് സമ്മാന ശേഖരണ വിവരങ്ങൾ വിജയകരമായി അപ്‌ഡേറ്റ് ചെയ്തു (Synced to Google Sheet)!'
        });
      } else {
        setRestoreMessage({
          type: 'error',
          text: message || 'Google Sheet സിങ്ക് പരാജയപ്പെട്ടു. ദയവായി കണക്ഷൻ പരിശോധിക്കുക.'
        });
      }
    } catch (err: any) {
      setRestoreMessage({
        type: 'error',
        text: err?.message || 'Google Sheet സിങ്ക് ചെയ്യുന്നതിൽ തടസ്സം നേരിട്ടു.'
      });
    } finally {
      setIsSyncingSheet(false);
      setTimeout(() => setRestoreMessage(null), 5000);
    }
  };

  // Save speed
  const handleSpeedChange = (newSpeed: number) => {
    setTickerSpeed(newSpeed);
    try {
      localStorage.setItem(STORAGE_KEY_SPEED, newSpeed.toString());
    } catch (e) {
      console.error('Failed saving speed', e);
    }
  };

  // Statistics Calculations
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

  // Group prizes by category
  const categoriesBreakdown = useMemo(() => {
    const map: Record<string, {
      name: string;
      total: number;
      collected: number;
      sponsorCount: number;
      trustCount: number;
      pending: number;
      percent: number;
      items: (PrizeItem & { tracking: PrizeTrackingInfo })[];
    }> = {};

    prizes.forEach(p => {
      const cat = p.prize_item.trim().toUpperCase();
      if (!map[cat]) {
        map[cat] = {
          name: cat,
          total: 0,
          collected: 0,
          sponsorCount: 0,
          trustCount: 0,
          pending: 0,
          percent: 0,
          items: []
        };
      }

      const tracking = prizeTracking[p.prize_no] || { status: 'PENDING', amount: 0 };
      map[cat].total++;
      if (tracking.status === 'SPONSOR') {
        map[cat].collected++;
        map[cat].sponsorCount++;
      } else if (tracking.status === 'TRUST') {
        map[cat].collected++;
        map[cat].trustCount++;
      } else {
        map[cat].pending++;
      }
      map[cat].items.push({ ...p, tracking });
    });

    // Calculate percent for each category
    const list = Object.values(map).map(c => ({
      ...c,
      percent: c.total > 0 ? Math.round((c.collected / c.total) * 100) : 0
    }));

    // Sort categories: highest item count first, then alphabetical
    return list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [prizes, prizeTracking]);

  // Filtered categories breakdown based on search input
  const filteredCategories = useMemo(() => {
    const q = categorySearch.toLowerCase().trim();
    if (!q) return categoriesBreakdown;
    return categoriesBreakdown.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.items.some(item => 
        item.prize_no.toLowerCase().includes(q) ||
        item.display_sponsor.toLowerCase().includes(q)
      )
    );
  }, [categoriesBreakdown, categorySearch]);

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  // --- FEATURE 2: BACKUP (JSON EXPORT) ---
  const generateBackupData = () => {
    return {
      appName: "St. Casimir Charitable Trust — Lucky Draw 2026",
      module: "Prize Collection",
      version: "2.7",
      createdDate: new Date().toISOString(),
      timestamp: Date.now(),
      totalPrizesConfigured: prizes.length,
      stats: {
        total: stats.total,
        collected: stats.collectedCount,
        pending: stats.pendingCount,
        percent: stats.percentCollected,
        trustExpenditure: stats.trustTotalAmount,
        sponsorshipReceived: stats.totalReceivedAmount
      },
      prizeTracking,
      collectedPrizes: Object.fromEntries(
        (Object.entries(prizeTracking) as [string, PrizeTrackingInfo][]).map(([k, v]) => [k, v.status === 'SPONSOR' || v.status === 'TRUST'])
      ),
      receivedAmounts,
      tickerSpeed,
      prizesList: INITIAL_PRIZES_DATA
    };
  };

  const handleDownloadBackup = () => {
    const backupData = generateBackupData();
    const jsonStr = JSON.stringify(backupData, null, 2);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `StCasimir_PrizeCollection_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyBackup = () => {
    const backupData = generateBackupData();
    navigator.clipboard.writeText(JSON.stringify(backupData, null, 2));
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 3000);
  };

  // --- FEATURE 3: RESTORE (JSON IMPORT WITH SAFETY VALIDATION) ---
  const parseAndPreviewBackup = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || (!parsed.prizeTracking && !parsed.collectedPrizes)) {
        throw new Error("Invalid format: Missing prize tracking or collected records in backup file.");
      }

      let trackingCount = 0;
      let collectedCount = 0;

      if (parsed.prizeTracking) {
        trackingCount = Object.keys(parsed.prizeTracking).length;
        collectedCount = Object.values(parsed.prizeTracking).filter((v: any) => v && (v.status === 'SPONSOR' || v.status === 'TRUST')).length;
      } else if (parsed.collectedPrizes) {
        trackingCount = Object.keys(parsed.collectedPrizes).length;
        collectedCount = Object.values(parsed.collectedPrizes).filter(Boolean).length;
      }

      const receivedCount = Array.isArray(parsed.receivedAmounts) ? parsed.receivedAmounts.length : 0;

      setRestorePreviewData({
        trackingCount,
        collectedCount,
        receivedCount,
        createdDate: parsed.createdDate,
        parsedObj: parsed
      });
      setShowRestorePreview(true);
      setRestoreMessage(null);
    } catch (err: any) {
      setRestoreMessage({
        type: 'error',
        text: `Invalid JSON File / Format: ${err.message || 'Cannot parse backup data.'}`
      });
      setRestorePreviewData(null);
      setShowRestorePreview(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRestoreJsonInput(content);
      parseAndPreviewBackup(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleApplyRestore = (mode: 'merge' | 'overwrite') => {
    if (!restorePreviewData || !restorePreviewData.parsedObj) return;
    const parsed = restorePreviewData.parsedObj;

    try {
      let importedTracking: PrizeTrackingMap = {};
      if (parsed.prizeTracking) {
        importedTracking = parsed.prizeTracking;
      } else if (parsed.collectedPrizes) {
        Object.keys(parsed.collectedPrizes).forEach(k => {
          if (parsed.collectedPrizes[k]) {
            importedTracking[k] = { status: 'SPONSOR', amount: 0 };
          }
        });
      }

      let finalTracking: PrizeTrackingMap = {};
      if (mode === 'merge') {
        // Keep current entries, merge imported values
        finalTracking = { ...prizeTracking, ...importedTracking };
      } else {
        // Complete overwrite but fill defaults for any missing prize item
        finalTracking = { ...importedTracking };
        INITIAL_PRIZES_DATA.forEach(p => {
          if (!finalTracking[p.prize_no]) {
            finalTracking[p.prize_no] = { status: 'PENDING', amount: 0 };
          }
        });
      }

      saveTrackingState(finalTracking);

      // Handle received amounts
      if (Array.isArray(parsed.receivedAmounts)) {
        if (mode === 'merge') {
          // Merge avoiding exact duplicates by name and amount
          const existingMap = new Set(receivedAmounts.map(r => `${r.name}_${r.amount}`));
          const newEntries = parsed.receivedAmounts.filter((r: ReceivedAmountEntry) => !existingMap.has(`${r.name}_${r.amount}`));
          saveReceivedState([...receivedAmounts, ...newEntries]);
        } else {
          saveReceivedState(parsed.receivedAmounts);
        }
      }

      // Handle ticker speed
      if (parsed.tickerSpeed) {
        const sp = Number(parsed.tickerSpeed);
        if (!isNaN(sp)) {
          handleSpeedChange(sp);
        }
      }

      setShowRestorePreview(false);
      setRestoreJsonInput('');
      setRestoreMessage({
        type: 'success',
        text: `Data successfully restored (${mode === 'merge' ? 'Merged with existing data' : 'Clean restored from backup'}). All records preserved safely.`
      });

      // Clear success notification after 5s
      setTimeout(() => {
        setRestoreMessage(null);
      }, 5000);
    } catch (err: any) {
      setRestoreMessage({
        type: 'error',
        text: `Failed to restore data: ${err.message}`
      });
    }
  };

  // --- FEATURE 4: EXPORT PDF ---
  const handleExportPDF = (type: 'all' | 'collected' | 'pending' | 'category-summary' | 'finance-report') => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const dateStr = new Date().toLocaleString('en-IN');
        
        // Header styling
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(27, 94, 32);
        doc.text("ST. CASIMIR CHARITABLE TRUST, KADAVOOR", 14, 15);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(75, 85, 99);
        doc.text("Kollam, Kerala • Lucky Draw 2026 Prize Collection Management", 14, 21);

        if (type === 'category-summary') {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text("Prize Categories Summary Report (വിഭാഗ തിരിച്ചുള്ള സംഗ്രഹം)", 14, 28);

          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text(`Generated: ${dateStr} | Total Categories: ${categoriesBreakdown.length} | Total Prizes: ${stats.total} | Collected: ${stats.collectedCount} (${stats.percentCollected}%)`, 14, 34);

          const tableRows = categoriesBreakdown.map((cat, idx) => [
            (idx + 1).toString(),
            cat.name,
            cat.total.toString(),
            cat.collected.toString(),
            `${cat.percent}%`,
            cat.sponsorCount.toString(),
            cat.trustCount.toString(),
            cat.pending.toString()
          ]);

          autoTable(doc, {
            head: [['#', 'Category Name', 'Total Items', 'Collected', 'Progress', 'Sponsor', 'Trust', 'Pending']],
            body: tableRows,
            startY: 38,
            styles: { fontSize: 8, cellPadding: 2.2 },
            headStyles: { fillColor: [27, 94, 32], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
              0: { cellWidth: 10, halign: 'center' },
              1: { cellWidth: 60, fontStyle: 'bold' },
              2: { cellWidth: 18, halign: 'center' },
              3: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
              4: { cellWidth: 18, halign: 'center' },
              5: { cellWidth: 18, halign: 'center' },
              6: { cellWidth: 18, halign: 'center' },
              7: { cellWidth: 18, halign: 'center' }
            }
          });

          doc.save(`StCasimir_Prize_Categories_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        } else if (type === 'finance-report') {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text("Prize Collection Financial & Ledger Report", 14, 28);

          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text(`Generated: ${dateStr} | Total Trust Expense: Rs. ${stats.trustTotalAmount.toLocaleString('en-IN')} | Total Received: Rs. ${stats.totalReceivedAmount.toLocaleString('en-IN')} | Net Balance: Rs. ${stats.balanceAmount.toLocaleString('en-IN')}`, 14, 34);

          // Section 1: Trust Purchases
          const trustItems = prizes.filter(p => prizeTracking[p.prize_no]?.status === 'TRUST');
          const trustRows = trustItems.map((p, idx) => [
            (idx + 1).toString(),
            p.prize_no,
            p.prize_item,
            p.display_sponsor,
            `Rs. ${(prizeTracking[p.prize_no]?.amount || 0).toLocaleString('en-IN')}`
          ]);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text("1. Trust Purchased Prizes (ട്രസ്റ്റ് നേരിട്ട് വാങ്ങിയവ):", 14, 42);

          autoTable(doc, {
            head: [['#', 'Prize No', 'Item', 'Sponsor Note', 'Cost Amount']],
            body: trustRows.length > 0 ? trustRows : [['-', 'No items', 'None', 'No purchases marked', 'Rs. 0']],
            startY: 46,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255] },
            columnStyles: {
              0: { cellWidth: 10 },
              1: { cellWidth: 26, fontStyle: 'bold' },
              2: { cellWidth: 50 },
              3: { cellWidth: 60 },
              4: { cellWidth: 34, halign: 'right', fontStyle: 'bold' }
            }
          });

          // Section 2: Received Sponsorship Ledger
          const receivedRows = receivedAmounts.map((r, idx) => [
            (idx + 1).toString(),
            r.name,
            r.date ? new Date(r.date).toLocaleDateString('en-IN') : '-',
            `Rs. ${r.amount.toLocaleString('en-IN')}`
          ]);

          const finalY = (doc as any).lastAutoTable?.finalY || 100;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text("2. Received Sponsorship Contributions (ലഭിച്ച സംഭാവനകൾ):", 14, finalY + 12);

          autoTable(doc, {
            head: [['#', 'Donor / Sponsor Name', 'Date', 'Amount']],
            body: receivedRows.length > 0 ? receivedRows : [['-', 'No entries recorded', '-', 'Rs. 0']],
            startY: finalY + 16,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255] },
            columnStyles: {
              0: { cellWidth: 10 },
              1: { cellWidth: 90, fontStyle: 'bold' },
              2: { cellWidth: 40 },
              3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
            }
          });

          doc.save(`StCasimir_Prize_Finance_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        } else {
          // Standard List: all, collected, or pending
          let title = "St. Casimir Lucky Draw 2026 — Master Prizes Report (111 Records)";
          let list = prizes;

          if (type === 'collected') {
            title = "St. Casimir Lucky Draw 2026 — Collected Prizes Report (ലഭിച്ചവ)";
            list = prizes.filter(p => {
              const s = prizeTracking[p.prize_no]?.status;
              return s === 'SPONSOR' || s === 'TRUST';
            });
          } else if (type === 'pending') {
            title = "St. Casimir Lucky Draw 2026 — Pending Prizes Report (ലഭിക്കാനുള്ളവ)";
            list = prizes.filter(p => {
              const s = prizeTracking[p.prize_no]?.status || 'PENDING';
              return s === 'PENDING';
            });
          }

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text(title, 14, 28);

          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text(`Generated: ${dateStr} | Showing: ${list.length} Items | Total Prizes: ${stats.total} | Collected: ${stats.collectedCount} (${stats.percentCollected}%)`, 14, 34);

          const tableRows = list.map(p => {
            const track = prizeTracking[p.prize_no] || { status: 'PENDING', amount: 0 };
            let statusText = 'Pending';
            if (track.status === 'SPONSOR') statusText = 'Collected (Sponsor)';
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
            styles: { fontSize: 8, cellPadding: 2.2 },
            headStyles: { fillColor: [27, 94, 32], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
              0: { cellWidth: 26, fontStyle: 'bold' },
              1: { cellWidth: 46, fontStyle: 'bold' },
              2: { cellWidth: 72 },
              3: { cellWidth: 42, fontStyle: 'bold' }
            }
          });

          doc.save(`StCasimir_PrizeReport_${type}_${new Date().toISOString().slice(0, 10)}.pdf`);
        }
      } catch (err: any) {
        console.error("PDF generation failed", err);
        alert("Failed to export PDF: " + err.message);
      } finally {
        setIsGeneratingPdf(false);
      }
    }, 100);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 font-sans animate-in fade-in-50 duration-300">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold uppercase tracking-wider">
              <SlidersHorizontal size={14} />
              Prize Collection System Settings
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Prize Collection Settings & Tools
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              സമ്മാന ശേഖരണ ക്രമീകരണങ്ങൾ: കാറ്റഗറി സംഗ്രഹം, ബാക്കപ്പ്, റീസ്റ്റോർ, പ്രിന്റ് ചെയ്യാനാവുന്ന പി.ഡി.എഫ് റിപ്പോർട്ടുകൾ. നിലവിലെ ഡാറ്റ ഒന്നും നഷ്ടപ്പെടാതെ സുരക്ഷിതമായി മാനേജ് ചെയ്യാം.
            </p>
          </div>

          {setActiveTab && (
            <button
              onClick={() => setActiveTab('prize-collection')}
              className="inline-flex items-center justify-center gap-2 bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-5 py-3 rounded-2xl shadow-lg transition-all duration-200 text-sm shrink-0 self-start md:self-center"
            >
              <Gift size={18} className="text-emerald-700" />
              Go to Prize Collection
              <ArrowRight size={16} />
            </button>
          )}
        </div>

        {/* Quick KPI stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10 text-xs sm:text-sm">
          <div className="bg-white/5 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
            <div className="text-slate-400 text-xs font-semibold">Total Prizes</div>
            <div className="text-xl sm:text-2xl font-black text-white mt-0.5">{stats.total}</div>
            <div className="text-[11px] text-slate-300 mt-0.5">111 Official Prizes</div>
          </div>
          <div className="bg-emerald-500/10 backdrop-blur-md p-3.5 rounded-2xl border border-emerald-400/20">
            <div className="text-emerald-300 text-xs font-semibold">Collected (ലഭിച്ചവ)</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-0.5">
              {stats.collectedCount} <span className="text-xs font-medium text-emerald-200">({stats.percentCollected}%)</span>
            </div>
            <div className="text-[11px] text-emerald-200/80 mt-0.5">{stats.sponsorCount} Sponsor + {stats.trustCount} Trust</div>
          </div>
          <div className="bg-amber-500/10 backdrop-blur-md p-3.5 rounded-2xl border border-amber-400/20">
            <div className="text-amber-300 text-xs font-semibold">Pending (ലഭിക്കാനുള്ളവ)</div>
            <div className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5">{stats.pendingCount}</div>
            <div className="text-[11px] text-amber-200/80 mt-0.5">Need Sponsorship/Trust</div>
          </div>
          <div className="bg-blue-500/10 backdrop-blur-md p-3.5 rounded-2xl border border-blue-400/20">
            <div className="text-blue-300 text-xs font-semibold">Trust Expense</div>
            <div className="text-xl sm:text-2xl font-black text-blue-300 mt-0.5">
              ₹{stats.trustTotalAmount.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-blue-200/80 mt-0.5">Balance: ₹{stats.balanceAmount.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {restoreMessage && (
        <div className={cn(
          "p-4 rounded-2xl border flex items-center gap-3 text-sm animate-in fade-in-50 duration-200",
          restoreMessage.type === 'success' 
            ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
            : "bg-rose-50 border-rose-200 text-rose-900"
        )}>
          {restoreMessage.type === 'success' ? (
            <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={20} className="text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{restoreMessage.text}</span>
        </div>
      )}

      {/* Main Grid: 4 Core Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ========================================================================= */}
        {/* GOOGLE SHEETS SYNC & LIVE CLOUD DATABASE (ഗൂഗിൾ ഷീറ്റ് സിങ്ക്) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-800/60 space-y-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white">
                    Google Sheets & Cloud Database Live Sync
                  </h2>
                  <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                    Live
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  സമ്മാന ശേഖരണ ഡാറ്റാബേസ് തത്സമയം ഗൂഗിൾ ഷീറ്റിലേക്കും ഫയർസ്റ്റോർ ക്ലൗഡിലേക്കും സിങ്ക് ചെയ്യപ്പെടുന്നു.
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2.5 shrink-0">
              {sheetLink && (
                <a
                  href={sheetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/10"
                >
                  <ExternalLink size={14} className="text-emerald-400" />
                  <span>Open Google Sheet</span>
                </a>
              )}

              <button
                onClick={handleSyncToGoogleSheet}
                disabled={isSyncingSheet}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={15} className={isSyncingSheet ? "animate-spin" : ""} />
                <span>{isSyncingSheet ? 'Syncing to Sheet...' : 'Sync to Google Sheet Now'}</span>
              </button>
            </div>
          </div>

          {/* Status and details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/10 text-xs">
            <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Cloud Database Status</span>
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Firestore Multi-Device Active</span>
              </div>
              <p className="text-[11px] text-slate-300">Changes sync across authorized admin screens in real time.</p>
            </div>

            <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Google Sheet Tab</span>
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <FileSpreadsheet size={16} className="text-emerald-400" />
                <span>Tab: PRIZE COLLECTION</span>
              </div>
              <p className="text-[11px] text-slate-300">
                {lastSyncedTime ? `Last Synced: ${lastSyncedTime}` : 'Ready for synchronization'}
              </p>
            </div>

            <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Apps Script Webhook</span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-emerald-300 text-xs truncate max-w-[170px]" title={webhookUrl}>
                  {webhookUrl ? 'Connected & Operational' : 'Default Webhook'}
                </span>
                <button
                  onClick={() => setShowScriptModal(true)}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-lg transition cursor-pointer"
                >
                  View Code
                </button>
              </div>
              <p className="text-[11px] text-slate-300">Zero-lag background sync for all team members.</p>
            </div>
          </div>
        </div>
        
        {/* ========================================================================= */}
        {/* SECTION 1: CATEGORY SUMMARY (കാറ്റഗറി സംഗ്രഹം) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center shrink-0">
                <Layers size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  1. Category Summary (വിഭാഗ തിരിച്ചുള്ള സംഗ്രഹം)
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Total {categoriesBreakdown.length} unique categories configured across all 111 prizes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportPDF('category-summary')}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl transition"
              >
                <FileText size={15} />
                Category PDF Report
              </button>
            </div>
          </div>

          {/* Search bar for categories */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search category name or prize item..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCategories.map((cat) => {
              const isExpanded = !!expandedCategories[cat.name];
              const isComplete = cat.collected === cat.total && cat.total > 0;

              return (
                <div
                  key={cat.name}
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between",
                    isComplete 
                      ? "bg-emerald-50/40 border-emerald-200" 
                      : "bg-slate-50/60 border-slate-200/80 hover:border-slate-300"
                  )}
                >
                  <div>
                    {/* Header: Title and Completion Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">
                        {cat.name}
                      </h3>
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase shrink-0">
                          <Check size={11} /> 100%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold shrink-0">
                          {cat.percent}%
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-3">
                      <div 
                        className={cn("h-full transition-all duration-500", isComplete ? "bg-emerald-600" : "bg-emerald-500")}
                        style={{ width: `${cat.percent}%` }}
                      />
                    </div>

                    {/* Count Stats Breakdown */}
                    <div className="grid grid-cols-4 gap-1 text-center mt-3 pt-2 border-t border-slate-200/60 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold">Total</div>
                        <div className="font-bold text-slate-800">{cat.total}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-emerald-600 font-semibold">Sponsor</div>
                        <div className="font-bold text-emerald-700">{cat.sponsorCount}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-amber-600 font-semibold">Trust</div>
                        <div className="font-bold text-amber-700">{cat.trustCount}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-rose-500 font-semibold">Pending</div>
                        <div className="font-bold text-rose-600">{cat.pending}</div>
                      </div>
                    </div>
                  </div>

                  {/* Expand/Collapse Items Drawer */}
                  <div className="mt-3 pt-2 border-t border-slate-200/60">
                    <button
                      onClick={() => toggleCategoryExpand(cat.name)}
                      className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-800 font-semibold py-1 transition"
                    >
                      <span>{isExpanded ? 'Hide Items' : `View ${cat.items.length} Items`}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
                        {cat.items.map(item => (
                          <div 
                            key={item.prize_no} 
                            className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                          >
                            <div className="overflow-hidden">
                              <span className="font-black text-slate-900 block truncate">{item.prize_no}</span>
                              <span className="text-[11px] text-slate-500 block truncate">{item.display_sponsor}</span>
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                              item.tracking.status === 'SPONSOR' && "bg-emerald-100 text-emerald-800",
                              item.tracking.status === 'TRUST' && "bg-amber-100 text-amber-800",
                              item.tracking.status === 'PENDING' && "bg-slate-100 text-slate-600"
                            )}>
                              {item.tracking.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: BACKUP (ബാക്കപ്പ്) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 text-blue-800 rounded-2xl flex items-center justify-center shrink-0">
                <Download size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  2. Backup Data (ബാക്കപ്പ് എക്സ്പോർട്ട്)
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Export complete Prize Collection state, sponsor records, and financial ledger to JSON.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Total Prizes Tracked:</span>
                <span className="font-bold text-slate-900">{stats.total} prizes</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Collected Items:</span>
                <span className="font-bold text-emerald-700">{stats.collectedCount} items ({stats.percentCollected}%)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Received Ledger Entries:</span>
                <span className="font-bold text-slate-900">{receivedAmounts.length} contributions</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>File Format:</span>
                <span className="font-mono text-slate-700">JSON (.json)</span>
              </div>
            </div>

            <div className="text-xs text-slate-500 leading-relaxed">
              ഈ ബാക്കപ്പ് ഫയലിൽ നിലവിലെ എല്ലാ സമ്മാനങ്ങളുടെയും സ്റ്റാറ്റസ് (സ്പോൺസർ/ട്രസ്റ്റ്/പെൻഡിംഗ്), തുകകൾ, ലഭിച്ച സംഭാവനകളുടെ ലെഡ്ജർ വിവരങ്ങൾ എന്നിവ അടങ്ങിയിരിക്കുന്നു.
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <button
              onClick={handleDownloadBackup}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md shadow-blue-600/20 transition-all text-sm"
            >
              <Download size={18} />
              Download JSON Backup File
            </button>

            <button
              onClick={handleCopyBackup}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition text-xs"
            >
              {copiedBackup ? (
                <>
                  <Check size={16} className="text-emerald-600" />
                  <span className="text-emerald-700">JSON Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy JSON Text to Clipboard
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: RESTORE (റീസ്റ്റോർ) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center shrink-0">
                <Upload size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  3. Restore Backup (റീസ്റ്റോർ ചെയ്യുക)
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Safely import and verify JSON backups without accidental data loss.
                </p>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-200 hover:border-amber-400 bg-amber-50/20 hover:bg-amber-50/40 rounded-2xl p-6 text-center cursor-pointer transition">
              <input
                type="file"
                id="restore-file-input"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="restore-file-input" className="cursor-pointer space-y-2 block">
                <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl mx-auto flex items-center justify-center">
                  <Upload size={20} />
                </div>
                <div className="font-bold text-sm text-slate-800">
                  Click to select JSON backup file
                </div>
                <p className="text-[11px] text-slate-500">
                  Select previously exported <span className="font-mono">StCasimir_PrizeCollection_Backup_*.json</span>
                </p>
              </label>
            </div>

            {/* Paste alternative for mobile */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Or Paste JSON Data Directly:</label>
              <textarea
                value={restoreJsonInput}
                onChange={(e) => {
                  setRestoreJsonInput(e.target.value);
                  if (e.target.value.trim()) {
                    parseAndPreviewBackup(e.target.value);
                  } else {
                    setShowRestorePreview(false);
                  }
                }}
                placeholder='Paste raw JSON text here {"appName": "...", "prizeTracking": {...}}'
                rows={2}
                className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Restore Confirmation / Preview Card */}
          {showRestorePreview && restorePreviewData && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 animate-in fade-in-50">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide">
                <FileCheck size={16} />
                Backup Verification Summary
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                <div>
                  <span className="text-slate-500">Prizes Tracked:</span> <strong>{restorePreviewData.trackingCount}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Collected in file:</span> <strong>{restorePreviewData.collectedCount}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Contributions:</span> <strong>{restorePreviewData.receivedCount}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Created:</span> <strong>{restorePreviewData.createdDate ? new Date(restorePreviewData.createdDate).toLocaleDateString() : 'Unknown'}</strong>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-amber-200/80">
                <button
                  onClick={() => handleApplyRestore('merge')}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition"
                >
                  Merge With Existing (Safe)
                </button>
                <button
                  onClick={() => handleApplyRestore('overwrite')}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition"
                >
                  Full Replace (Overwrite)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECTION 4: EXPORT PDF (പി.ഡി.എഫ് എക്സ്പോർട്ട്) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-rose-100 text-rose-800 rounded-2xl flex items-center justify-center shrink-0">
                <FileText size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  4. Export PDF Reports (പി.ഡി.എഫ് ഡൗൺലോഡ് & പ്രിന്റ്)
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Generate high-resolution printable PDF documents formatted for committee meetings and festival records.
                </p>
              </div>
            </div>
            {isGeneratingPdf && (
              <span className="inline-flex items-center gap-2 text-xs font-bold text-rose-600 animate-pulse">
                <RefreshCw size={14} className="animate-spin" /> Generating PDF...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: All Prizes */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col justify-between space-y-4 hover:border-slate-300 transition">
              <div className="space-y-1">
                <div className="w-9 h-9 bg-slate-200 text-slate-800 rounded-xl flex items-center justify-center">
                  <Printer size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mt-3">All 111 Prizes</h3>
                <p className="text-xs text-slate-500">
                  Full list of 111 lucky draw prizes with official Malayalam sponsors and live status.
                </p>
              </div>
              <button
                onClick={() => handleExportPDF('all')}
                disabled={isGeneratingPdf}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition"
              >
                <Download size={15} />
                Download All (PDF)
              </button>
            </div>

            {/* Card 2: Collected Only */}
            <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-200 flex flex-col justify-between space-y-4 hover:border-emerald-300 transition">
              <div className="space-y-1">
                <div className="w-9 h-9 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
                <h3 className="font-bold text-emerald-950 text-sm mt-3">Collected Items Only</h3>
                <p className="text-xs text-emerald-700">
                  Current list of {stats.collectedCount} collected prizes (Sponsor confirmed & Trust purchased).
                </p>
              </div>
              <button
                onClick={() => handleExportPDF('collected')}
                disabled={isGeneratingPdf}
                className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition"
              >
                <Download size={15} />
                Download Collected
              </button>
            </div>

            {/* Card 3: Pending Only */}
            <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-200 flex flex-col justify-between space-y-4 hover:border-amber-300 transition">
              <div className="space-y-1">
                <div className="w-9 h-9 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center">
                  <Clock size={18} />
                </div>
                <h3 className="font-bold text-amber-950 text-sm mt-3">Pending Items Only</h3>
                <p className="text-xs text-amber-700">
                  Remaining {stats.pendingCount} pending prizes that need sponsorship or direct trust purchase.
                </p>
              </div>
              <button
                onClick={() => handleExportPDF('pending')}
                disabled={isGeneratingPdf}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition"
              >
                <Download size={15} />
                Download Pending
              </button>
            </div>

            {/* Card 4: Financial & Ledger Report */}
            <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-200 flex flex-col justify-between space-y-4 hover:border-blue-300 transition">
              <div className="space-y-1">
                <div className="w-9 h-9 bg-blue-100 text-blue-800 rounded-xl flex items-center justify-center">
                  <Scale size={18} />
                </div>
                <h3 className="font-bold text-blue-950 text-sm mt-3">Finance & Ledger</h3>
                <p className="text-xs text-blue-700">
                  Comprehensive ledger detailing trust item costs, donations received, and balance.
                </p>
              </div>
              <button
                onClick={() => handleExportPDF('finance-report')}
                disabled={isGeneratingPdf}
                className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition"
              >
                <Download size={15} />
                Download Finance PDF
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ADDITIONAL HELPER: LIVE TICKER SPEED CONTROLLER */}
        {/* ========================================================================= */}
        <div className="lg:col-span-2 bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1 max-w-xl">
            <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              Live Marquee Ticker Speed Controller
            </h3>
            <p className="text-xs text-slate-400">
              Adjust the scrolling speed of category status ticker on the Prize Collection main screen. Current speed: <span className="font-bold text-emerald-400">{tickerSpeed} seconds</span> per loop.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={tickerSpeed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="accent-emerald-500 w-full sm:w-48 cursor-pointer"
            />
            <span className="font-mono text-xs font-bold px-3 py-1 bg-slate-800 rounded-lg text-emerald-300 shrink-0">
              {tickerSpeed}s
            </span>
          </div>
        </div>

      </div>

      {/* Google Apps Script Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 text-white space-y-4 shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Code2 size={20} className="text-emerald-400" />
                <h3 className="font-bold text-base text-white">Google Apps Script Webhook Code</h3>
              </div>
              <button 
                onClick={() => setShowScriptModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Google Sheet-ൽ <strong>Extensions &gt; Apps Script</strong> തുറന്ന് ഈ കോഡ് പേസ്റ്റ് ചെയ്ത് <strong>Deploy &gt; New deployment &gt; Web app (Anyone)</strong> വഴി സേവ് ചെയ്യുക.
            </p>
            <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-emerald-300 overflow-auto flex-1 border border-slate-800/80 max-h-72">
              {GOOGLE_APPS_SCRIPT_CODE}
            </pre>
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 3000);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {copiedScript ? <Check size={15} /> : <Copy size={15} />}
                <span>{copiedScript ? 'Copied to Clipboard!' : 'Copy Script Code'}</span>
              </button>
              <button
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
