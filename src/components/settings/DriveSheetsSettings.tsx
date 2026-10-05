import React, { useState } from 'react';
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
  Zap
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
  GOOGLE_APPS_SCRIPT_CODE
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
  const [webhookInput, setWebhookInput] = useState(driveSyncConfig?.webhookUrl || '');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

  const activeToken = accessToken || driveSyncConfig?.activeAccessToken;
  const isConnected = !!activeToken || !!driveSyncConfig?.webhookUrl;

  const handleManualSyncAll = async () => {
    if (!activeToken) {
      showNotification('error', 'Please connect with Google Drive & Sheets first.');
      return;
    }

    setIsSyncingAll(true);
    try {
      // 1. Sync all transactions to Google Sheet
      const sheetRes = await syncAllTransactionsToSheet(activeToken, appData.transactions);
      // 2. Save full JSON backup to Google Drive folder
      const backupRes = await saveBackupJsonToDrive(activeToken, appData);

      const timestamp = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });

      if (onUpdateDriveSyncConfig) {
        await onUpdateDriveSyncConfig({
          sheetId: sheetRes.sheetId,
          sheetLink: sheetRes.webViewLink,
          backupFileId: backupRes.fileId,
          lastSyncedAt: new Date().toISOString(),
          lastSyncedBy: user?.email || 'Admin',
          lastSyncStatus: 'success',
          lastSyncMessage: `All ${sheetRes.count} records synced`,
        });
      }

      showNotification('success', `Successfully synced ${sheetRes.count} transactions to Google Sheet & updated Drive JSON backup!`);
    } catch (err: any) {
      console.error('Manual Drive sync error:', err);
      showNotification('error', `Drive Sync failed: ${err.message || 'Please re-authenticate with Google.'}`);
    } finally {
      setIsSyncingAll(false);
      setShowConfirmModal(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!onUpdateDriveSyncConfig) return;
    setIsSavingWebhook(true);
    try {
      await onUpdateDriveSyncConfig({ webhookUrl: webhookInput.trim() });
      showNotification('success', 'Google Apps Script Webhook URL saved successfully!');
    } catch (err: any) {
      showNotification('error', 'Failed to save webhook URL.');
    } finally {
      setIsSavingWebhook(false);
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
            Trust Admin Team വഴി അനുവാദം ലഭിച്ച ഏതൊരു ID വഴി ലോഗിൻ ചെയ്ത് ആര് പുതിയ transaction ചേർത്താലും അല്ലെങ്കിൽ മാറ്റം വരുത്തിയാലും, അത് തനിയെ <strong>stcasimircharitabletrust@gmail.com</strong> ഡ്രൈവിലെ <strong>{SHEET_NAME}</strong> ഗൂഗിൾ ഷീറ്റിലും <strong>{FOLDER_NAME}</strong> ഫോൾഡറിലെ JSON ബാക്കപ്പിലും ഉടൻ തന്നെ സേവ് ആകും!
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

        {/* Error 403 (access_denied) Resolution Card */}
        <div className="bg-amber-50/80 border border-amber-200/80 p-4 rounded-2xl text-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-extrabold text-amber-950">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span>Google Error 403 (access_denied) എങ്ങനെ മാറ്റാം?</span>
            </div>
            <span className="text-[10px] font-bold bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-full">
              Testing Mode Fix
            </span>
          </div>
          <p className="text-amber-900 text-xs leading-relaxed">
            ഗൂഗിൾ ക്ലൗഡ് പ്രോജക്റ്റ് (<strong>gen-lang-client-0728385363</strong>) നിലവിൽ Testing മോഡിലായതിനാലാണ് <em>&quot;has not completed Google verification process&quot;</em> കാണിക്കുന്നത്. ഇത് 1 മിനിറ്റിൽ മാറ്റാം:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-amber-900 font-medium pl-1 text-[11px]">
            <li>
              താഴെയുള്ള ബട്ടൺ വഴി Google Cloud Console തുറക്കുക.
            </li>
            <li>
              <strong>OAuth consent screen</strong>-ൽ താഴേക്ക് സ്ക്രോൾ ചെയ്ത് <strong>Test users</strong> കാണുക.
            </li>
            <li>
              <strong>+ ADD USERS</strong> ക്ലിക്ക് ചെയ്ത് <strong>{TARGET_DRIVE_EMAIL}</strong> ടൈപ്പ് ചെയ്ത് Save ചെയ്യുക!
            </li>
          </ol>
          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            <a
              href="https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0728385363"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <span>Add Test User in Google Cloud Console</span>
              <ExternalLink size={12} />
            </a>
            <button
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-xl text-xs font-semibold hover:bg-amber-100/50 cursor-pointer"
            >
              {copiedEmail ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              <span>Copy Email</span>
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
        <div className="flex items-center gap-2">
          <input
            type="url"
            placeholder="https://script.google.com/macros/s/.../exec"
            value={webhookInput}
            onChange={(e) => setWebhookInput(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSaveWebhook}
            disabled={isSavingWebhook}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {isSavingWebhook ? 'Saving...' : 'Save Webhook'}
          </button>
        </div>
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
                <p className="text-[11px] text-slate-500">For stcasimircharitabletrust@gmail.com Google Sheet</p>
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
