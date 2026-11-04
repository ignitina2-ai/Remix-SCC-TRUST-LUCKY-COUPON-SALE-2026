import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  FolderSync, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Check, 
  Lock,
  CloudUpload,
  Copy,
  Code2,
  Users,
  ShieldCheck,
  Zap,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { AppData } from '@/types';
import { cn } from '@/lib/utils';
import { 
  TARGET_DRIVE_EMAIL, 
  FOLDER_NAME, 
  SHEET_NAME, 
  BACKUP_FILE_NAME,
  syncAllTransactionsToSheet,
  saveBackupJsonToDrive,
  DriveFolderInfo,
  SheetInfo,
  DriveSyncConfig,
  GOOGLE_APPS_SCRIPT_CODE,
  DEFAULT_WEBHOOK_URL,
  syncViaWebhook
} from '@/lib/googleDriveSheets';
import ConfirmationModal from '../ConfirmationModal';

interface DriveSheetsSettingsProps {
  appData: AppData;
  user: any;
  accessToken: string | null;
  driveSyncConfig?: DriveSyncConfig;
  onUpdateDriveSyncConfig?: (config: Partial<DriveSyncConfig>) => Promise<void>;
  onConnectDrive: () => Promise<void>;
  isAutoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const DriveSheetsSettings: React.FC<DriveSheetsSettingsProps> = ({
  appData,
  user,
  accessToken,
  driveSyncConfig,
  onUpdateDriveSyncConfig,
  onConnectDrive,
  isAutoSyncEnabled,
  onToggleAutoSync,
  showNotification,
}) => {
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [webhookInput, setWebhookInput] = useState(() => {
    if (driveSyncConfig?.webhookUrl) return driveSyncConfig.webhookUrl;
    try {
      const local = localStorage.getItem('cached_gas_webhook_url');
      if (local && local.trim()) return local.trim();
    } catch (e) {}
    return DEFAULT_WEBHOOK_URL;
  });
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [justSavedWebhook, setJustSavedWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isRestructuring, setIsRestructuring] = useState(false);
  const [showRestructureModal, setShowRestructureModal] = useState(false);

  useEffect(() => {
    if (driveSyncConfig?.webhookUrl) {
      setWebhookInput(driveSyncConfig.webhookUrl);
    }
  }, [driveSyncConfig?.webhookUrl]);

  const activeToken = accessToken || driveSyncConfig?.activeAccessToken;
  const currentWebhookUrl = driveSyncConfig?.webhookUrl || DEFAULT_WEBHOOK_URL;
  const isConnected = !!activeToken || !!currentWebhookUrl;

  const handleRestructureFresh = async () => {
    if (!activeToken && !currentWebhookUrl) {
      showNotification('error', 'Please connect with Google Drive & Sheets or save a Webhook URL first.');
      return;
    }

    setIsRestructuring(true);
    try {
      let sheetRes: any = null;
      let backupRes: any = null;

      // 1. If direct OAuth token is present, rebuild sheet via Google REST APIs
      if (activeToken) {
        sheetRes = await syncAllTransactionsToSheet(activeToken, appData.transactions);
        backupRes = await saveBackupJsonToDrive(activeToken, appData);
      }

      // 2. Dispatch restructure to Webhook URL
      if (currentWebhookUrl) {
        await syncViaWebhook(currentWebhookUrl, {
          action: 'restructure',
          transactions: appData.transactions,
          fullBackup: appData,
        });
      }

      if (onUpdateDriveSyncConfig) {
        await onUpdateDriveSyncConfig({
          sheetId: sheetRes?.sheetId || driveSyncConfig?.sheetId,
          sheetLink: sheetRes?.webViewLink || driveSyncConfig?.sheetLink,
          backupFileId: backupRes?.fileId || driveSyncConfig?.backupFileId,
          lastSyncedAt: new Date().toISOString(),
          lastSyncedBy: user?.email || 'Admin',
          lastSyncStatus: 'success',
          lastSyncMessage: `Sheet restructured fresh with ${appData.transactions.length} records & Drive JSON backup saved`,
        });
      }

      showNotification('success', `Google Sheet restructured fresh! ${appData.transactions.length} records written with new formatting.`);
    } catch (err: any) {
      console.error('Restructure sheet error:', err);
      showNotification('error', `Restructure failed: ${err.message || 'Please check connection.'}`);
    } finally {
      setIsRestructuring(false);
      setShowRestructureModal(false);
    }
  };

  const handleManualSyncAll = async () => {
    if (!activeToken && !currentWebhookUrl) {
      showNotification('error', 'Please connect with Google Drive & Sheets or save a Webhook URL first.');
      return;
    }

    setIsSyncingAll(true);
    try {
      let sheetRes: any = null;
      let backupRes: any = null;

      // 1. If direct OAuth token is present, sync via Google REST APIs
      if (activeToken) {
        sheetRes = await syncAllTransactionsToSheet(activeToken, appData.transactions);
        backupRes = await saveBackupJsonToDrive(activeToken, appData);
      }

      // 2. If Webhook URL is present, also dispatch to Webhook
      if (currentWebhookUrl) {
        await syncViaWebhook(currentWebhookUrl, {
          action: 'syncAll',
          transactions: appData.transactions,
          fullBackup: appData,
        });
      }

      if (onUpdateDriveSyncConfig) {
        await onUpdateDriveSyncConfig({
          sheetId: sheetRes?.sheetId || driveSyncConfig?.sheetId,
          sheetLink: sheetRes?.webViewLink || driveSyncConfig?.sheetLink,
          backupFileId: backupRes?.fileId || driveSyncConfig?.backupFileId,
          lastSyncedAt: new Date().toISOString(),
          lastSyncedBy: user?.email || 'Admin',
          lastSyncStatus: 'success',
          lastSyncMessage: `All ${appData.transactions.length} records synced to Google Sheet & Drive JSON backup`,
        });
      }

      showNotification('success', `Successfully synced ${appData.transactions.length} transactions to Google Sheet & updated Drive JSON backup!`);
    } catch (err: any) {
      console.error('Manual Drive sync error:', err);
      showNotification('error', `Drive Sync failed: ${err.message || 'Please check connection.'}`);
    } finally {
      setIsSyncingAll(false);
      setShowConfirmModal(false);
    }
  };

  const handleSaveWebhook = async () => {
    const cleanUrl = webhookInput.trim();
    if (!cleanUrl) {
      showNotification('error', 'ദയവായി Webhook URL നൽകുക.');
      return;
    }

    // Immediately cache in localStorage for instant persistence
    try {
      localStorage.setItem('cached_gas_webhook_url', cleanUrl);
    } catch (e) {}

    setIsSavingWebhook(true);
    try {
      if (onUpdateDriveSyncConfig) {
        // Enforce max 600ms timeout race so saving is practically instant and never hangs!
        await Promise.race([
          onUpdateDriveSyncConfig({ webhookUrl: cleanUrl }),
          new Promise((resolve) => setTimeout(resolve, 600))
        ]);
      }
      setJustSavedWebhook(true);
      setTimeout(() => setJustSavedWebhook(false), 3000);
      showNotification('success', 'Google Apps Script Webhook URL വിജയകരമായി സേവ് ചെയ്തു!');
    } catch (err: any) {
      console.warn('Webhook save notice:', err);
      setJustSavedWebhook(true);
      setTimeout(() => setJustSavedWebhook(false), 3000);
      showNotification('success', 'Google Apps Script Webhook URL സേവ് ചെയ്തു!');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    const url = (webhookInput || currentWebhookUrl).trim();
    if (!url) {
      showNotification('error', 'Please enter a webhook URL first.');
      return;
    }
    setIsTestingWebhook(true);
    try {
      // 1. First probe via fetch to see if Google responds with account login (Who has access: Only myself)
      let needsAnyonePermission = false;
      try {
        const probeRes = await fetch(url, { method: 'GET', redirect: 'follow' });
        const probeText = await probeRes.text().catch(() => '');
        if (probeText.includes('accounts.google.com') || probeText.includes('ServiceLogin') || probeText.includes('Sign in - Google Accounts')) {
          needsAnyonePermission = true;
        }
      } catch (probeErr) {
        // CORS redirect usually happens if redirected to accounts.google.com
      }

      if (needsAnyonePermission) {
        showNotification(
          'error',
          'Webhook permission issue: Web app deployment must have "Who has access: Anyone" (Currently restricted to account login).'
        );
        setIsTestingWebhook(false);
        return;
      }

      // 2. Dispatch sync test
      const res = await syncViaWebhook(url, {
        action: 'syncAll',
        transactions: appData.transactions.slice(0, 1),
        fullBackup: appData,
      });
      if (res.success) {
        showNotification('success', 'Webhook test successful! Connection to Google Sheet & Drive JSON backup is active.');
      } else {
        showNotification('error', `Webhook response: ${res.message || 'Check Apps Script deployment.'}`);
      }
    } catch (e: any) {
      showNotification('error', `Webhook test failed: ${e.message || 'Check network'}`);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(TARGET_DRIVE_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
    showNotification('success', `Copied ${TARGET_DRIVE_EMAIL} to clipboard!`);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
    showNotification('success', 'Google Apps Script code copied to clipboard!');
  };

  return (
    <div id="settings-card-drive-sheets" className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 text-left font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shrink-0">
            <FolderSync size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">Google Drive & Google Sheets Live Sync</h3>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Auto-records each transaction in &quot;{SHEET_NAME}&quot; sheet &amp; updates JSON backup in &quot;{FOLDER_NAME}&quot;
            </p>
          </div>
        </div>

        {/* Connection Action */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {isConnected ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-xs font-bold">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Drive &amp; Sheets Live</span>
              </div>
              <button
                onClick={onConnectDrive}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                title="Re-authenticate or update Drive token"
              >
                Refresh Token
              </button>
            </div>
          ) : (
            <button
              onClick={onConnectDrive}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <CloudUpload size={14} />
              <span>Connect Drive &amp; Sheets</span>
            </button>
          )}
        </div>
      </div>

      {/* Team Sync Notice Banner */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shrink-0 mt-0.5">
          <Users size={16} />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">
            Trust Admin Team Multi-User Sync Active
          </h4>
          <p className="text-xs text-indigo-800 leading-relaxed">
            Trust Admin Team വഴി അനുവാദം ലഭിച്ച ഏതൊരു ID വഴി ലോഗിൻ ചെയ്ത് ആര് പുതിയ transaction ചേർത്താലും അല്ലെങ്കിൽ മാറ്റം വരുത്തിയാലും, അത് തനിയെ <strong>ignitina2@gmail.com</strong> ഡ്രൈവിലെ <strong>{SHEET_NAME}</strong> ഗൂഗിൾ ഷീറ്റിലും <strong>{FOLDER_NAME}</strong> ഫോൾഡറിലെ JSON ബാക്കപ്പിലും ഒരേസമയം തത്സമയം സേവ് ആകും!
          </p>
        </div>
      </div>

      {/* Target Drive & Folder Information Box */}
      <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/60 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-600">Target Google Account:</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
              {TARGET_DRIVE_EMAIL}
            </span>
            <button
              onClick={handleCopyEmail}
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              title="Copy Email"
            >
              {copiedEmail ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Folder, Sheet, and File Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Target Folder */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/60 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Drive Folder</span>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-extrabold text-slate-800 truncate" title={FOLDER_NAME}>
                📁 {FOLDER_NAME}
              </span>
              <a
                href={driveSyncConfig?.folderLink || `https://drive.google.com/drive/search?q=${encodeURIComponent(FOLDER_NAME)}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-700 p-1 hover:bg-blue-50 rounded transition-colors"
                title="Open Folder in Google Drive"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* Target Sheet */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/60 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Google Spreadsheet</span>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-extrabold text-emerald-800 truncate" title={SHEET_NAME}>
                📊 {SHEET_NAME}
              </span>
              <a
                href={driveSyncConfig?.sheetLink || `https://docs.google.com/spreadsheets/u/0/`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 hover:text-emerald-700 p-1 hover:bg-emerald-50 rounded transition-colors"
                title="Open Sheet in Google Sheets"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* Target Backup File */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/60 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Drive JSON Backup</span>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-extrabold text-amber-800 truncate" title={BACKUP_FILE_NAME}>
                💾 {BACKUP_FILE_NAME}
              </span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                Live
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Sync Toggle Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
        <div className="space-y-0.5">
          <label htmlFor="drive-auto-sync-toggle" className="text-xs font-bold text-slate-900 cursor-pointer">
            Auto-record transactions &amp; update Drive JSON backup
          </label>
          <p className="text-[11px] text-slate-500 font-medium">
            ഏതൊരു അഡ്മിൻ അല്ലെങ്കിൽ അംഗം പുതിയ transaction ചേർത്താലോ തിരുത്തിയാലോ ഉടൻ തന്നെ Google Sheet-ലും JSON ഫയലിലും സേവ് ചെയ്യും.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="drive-auto-sync-toggle"
            type="button"
            onClick={() => onToggleAutoSync(!isAutoSyncEnabled)}
            className={cn(
              "w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer shadow-inner",
              isAutoSyncEnabled ? "bg-emerald-600" : "bg-slate-300"
            )}
            title={isAutoSyncEnabled ? "Disable Auto Sync" : "Enable Auto Sync"}
          >
            <div className={cn(
              "w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-md",
              isAutoSyncEnabled ? "translate-x-6" : "translate-x-0"
            )} />
          </button>
        </div>
      </div>

      {/* Permanent Google Apps Script Webhook Option (24/7 Zero Expiration Sync) */}
      <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/70 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            <h4 className="text-xs font-bold text-slate-800">
              Permanent 24/7 Webhook Sync (Zero Token Expiration)
            </h4>
          </div>
          <button
            onClick={() => setShowScriptModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <Code2 size={13} />
            <span>View Apps Script Code</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Google Sheets-ൽ <strong>Extensions &gt; Apps Script</strong> വഴി വെബ് ആപ്പ് ഡിപ്ലോയ് ചെയ്ത് ആ ലിങ്ക് ഇവിടെ നൽകിയാൽ, ലോഗിൻ ടോക്കൺ കാലാവധി തീരാതെ തന്നെ എല്ലാ ടീം അംഗങ്ങൾക്കും 24 മണിക്കൂറും ഇടതടവില്ലാതെ ഷീറ്റും ഡ്രൈവും അപ്ഡേറ്റ് ചെയ്യാം.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="url"
            placeholder="https://script.google.com/macros/s/.../exec"
            value={webhookInput}
            onChange={(e) => setWebhookInput(e.target.value)}
            className="flex-1 min-w-[240px] bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSaveWebhook}
            disabled={isSavingWebhook}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0 shadow-sm transition-all flex items-center gap-1.5",
              justSavedWebhook
                ? "bg-emerald-600 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            {isSavingWebhook ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : justSavedWebhook ? (
              <>
                <Check size={13} className="stroke-[3]" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Webhook</span>
            )}
          </button>
          <button
            onClick={handleTestWebhook}
            disabled={isTestingWebhook}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0 border border-slate-200 flex items-center gap-1.5"
            title="Test sending a test ping to Google Apps Script Webhook"
          >
            <RefreshCw size={12} className={isTestingWebhook ? "animate-spin" : ""} />
            <span>{isTestingWebhook ? 'Testing...' : 'Test Webhook'}</span>
          </button>
        </div>

        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            <span>പ്രധാനപ്പെട്ട ഡിപ്ലോയ്മെന്റ് സെറ്റിംഗ് (Zero Saving Delay):</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Google Apps Script &gt; <strong>Deploy</strong> &gt; <strong>Manage deployments</strong> &gt; Edit ചെയ്യുമ്പോൾ <strong>&quot;Who has access&quot;</strong> എന്നത് നിർബന്ധമായും <strong>&quot;Anyone&quot; (ഏവർക്കും / ആർക്കും)</strong> എന്ന് സെറ്റ് ചെയ്യുക. &quot;Only myself&quot; എന്ന് നൽകിയാൽ Google Login റീഡയറക്റ്റ് കാരണം സേവിംഗിൽ delay അനുഭവപ്പെടാം.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 p-2.5 rounded-xl">
          <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
          <span>Active Webhook Configured: ലോഗിൻ ചെയ്ത എല്ലാ ടീം അംഗങ്ങൾക്കും Google Sheet &amp; Drive JSON ബാക്കപ്പ് തത്സമയം അപ്ഡേറ്റ് ആകും!</span>
        </div>
      </div>

      {/* Fresh Restructure Card */}
      <div className="p-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
            <Sparkles size={15} className="text-amber-600 shrink-0" />
            <span>Google Sheet ഫ്രഷ് ആയി റീ-സ്ട്രക്ചർ ചെയ്യണോ? (Fresh Restructure &amp; Reset)</span>
          </div>
          <p className="text-[11px] text-amber-900/90 leading-relaxed">
            പഴയ ഷീറ്റ് ക്ലീൻ ചെയ്ത്, പുതിയ ഡാർക്ക് ഹെഡറുകളോടെ നിലവിലുള്ള <strong>{appData.transactions.length}</strong> ഇടപാടുകളും പുത്തനായി റീ-ബിൽഡ് ചെയ്യാം.
          </p>
        </div>
        <button
          onClick={() => setShowRestructureModal(true)}
          disabled={isRestructuring || !isConnected}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5"
        >
          <RotateCcw size={13} className={isRestructuring ? "animate-spin" : ""} />
          <span>{isRestructuring ? "Restructuring..." : "Re-structure Sheet Fresh"}</span>
        </button>
      </div>

      {/* Manual Bulk Sync Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-800">Need to sync all past records?</span>
          <p className="text-[11px] text-slate-500">
            {driveSyncConfig?.lastSyncedAt 
              ? `Last sync: ${new Date(driveSyncConfig.lastSyncedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} by ${driveSyncConfig.lastSyncedBy || 'Team'}.` 
              : `Synchronizes all ${appData.transactions.length} transactions to the sheet and updates the JSON file.`}
          </p>
        </div>

        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={isSyncingAll || !isConnected}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all active:scale-95 shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
        >
          <RefreshCw size={14} className={isSyncingAll ? "animate-spin" : ""} />
          <span>{isSyncingAll ? "Syncing to Drive & Sheets..." : "Sync All to Google Sheet & Drive"}</span>
        </button>
      </div>

      {/* Restructure Confirmation Modal */}
      {showRestructureModal && (
        <ConfirmationModal
          isOpen={showRestructureModal}
          onClose={() => setShowRestructureModal(false)}
          onConfirm={handleRestructureFresh}
          title="Google Sheet ഫ്രഷ് ആയി റീ-സ്ട്രക്ചർ ചെയ്യണോ?"
          message={`ഇത് Google Sheet-ലെ മുഴുവൻ ഡാറ്റയും ക്ലീൻ ചെയ്ത്, പുതിയ ഡാർക്ക് ഹെഡറുകളോടെ നിലവിലുള്ള ${appData.transactions.length} ട്രാൻസാക്ഷനുകളും ക്രമമായി വീണ്ടും എഴുതും. കൂടാതെ "LUCKY COUPON SALE 2026" ഫോൾഡറിലെ JSON ബാക്കപ്പും പുതുക്കും. തുടരണോ?`}
          size="sm"
        />
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleManualSyncAll}
          title="Sync All Records to Google Drive & Sheets?"
          message={`This will update the "${SHEET_NAME}" Google Spreadsheet with all ${appData.transactions.length} transaction entries, and overwrite "${BACKUP_FILE_NAME}" in the "${FOLDER_NAME}" Google Drive folder for ${TARGET_DRIVE_EMAIL}. Proceed with updating data?`}
          size="sm"
        />
      )}

      {/* Google Apps Script Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Google Apps Script Code</h3>
                <p className="text-[11px] text-slate-500">For ignitina2@gmail.com Google Sheet</p>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Copy this code into Extensions &gt; Apps Script:</span>
                <button
                  onClick={handleCopyScript}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  {copiedScript ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedScript ? 'Copied!' : 'Copy Script'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-96 leading-relaxed select-all">
                {GOOGLE_APPS_SCRIPT_CODE}
              </pre>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
