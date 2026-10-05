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
  CloudUpload
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
  SheetInfo
} from '@/lib/googleDriveSheets';
import ConfirmationModal from '../ConfirmationModal';

interface DriveSheetsSettingsProps {
  appData: AppData;
  user: any;
  accessToken: string | null;
  onConnectDrive: () => Promise<void>;
  isAutoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const DriveSheetsSettings: React.FC<DriveSheetsSettingsProps> = ({
  appData,
  user,
  accessToken,
  onConnectDrive,
  isAutoSyncEnabled,
  onToggleAutoSync,
  showNotification,
}) => {
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [driveFolder, setDriveFolder] = useState<DriveFolderInfo | null>(null);
  const [couponSheet, setCouponSheet] = useState<SheetInfo | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  const handleManualSyncAll = async () => {
    if (!accessToken) {
      showNotification('error', 'Please connect with Google Drive & Sheets first.');
      return;
    }

    setIsSyncingAll(true);
    try {
      // 1. Sync all transactions to Google Sheet
      const sheetRes = await syncAllTransactionsToSheet(accessToken, appData.transactions);
      // 2. Save full JSON backup to Google Drive folder
      const backupRes = await saveBackupJsonToDrive(accessToken, appData);

      setLastSyncedTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
      if (sheetRes.webViewLink) {
        setCouponSheet({
          id: sheetRes.sheetId,
          name: SHEET_NAME,
          webViewLink: sheetRes.webViewLink,
          tabTitle: 'Sheet1',
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

  const isConnected = !!accessToken;

  return (
    <div id="settings-card-drive-sheets" className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 text-left font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shrink-0">
            <FolderSync size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">Google Drive & Google Sheets Sync</h3>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Auto-record transactions in Google Sheet & update JSON backup in Google Drive
            </p>
          </div>
        </div>

        {/* Connection Action */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {isConnected ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-xs font-bold">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Drive & Sheets Connected</span>
            </div>
          ) : (
            <button
              onClick={onConnectDrive}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <CloudUpload size={14} />
              <span>Connect Drive & Sheets</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Drive & Folder Information Box */}
      <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/60 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-600">Target Google Account:</span>
          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
            {TARGET_DRIVE_EMAIL}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Target Folder */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/60 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Drive Folder</span>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-extrabold text-slate-800 truncate" title={FOLDER_NAME}>
                📁 {FOLDER_NAME}
              </span>
              <a
                href={`https://drive.google.com/drive/search?q=${encodeURIComponent(FOLDER_NAME)}`}
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
                href={couponSheet?.webViewLink || `https://docs.google.com/spreadsheets/u/0/`}
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
                Auto-updated
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Sync Toggle Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
        <div className="space-y-0.5">
          <label htmlFor="drive-auto-sync-toggle" className="text-xs font-bold text-slate-900 cursor-pointer">
            Auto-record transactions & update Drive JSON backup
          </label>
          <p className="text-[11px] text-slate-500 font-medium">
            When enabled, every added or edited transaction automatically updates the row in Google Sheet and uploads the fresh JSON backup.
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

      {/* Manual Bulk Sync Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-800">Need to sync all past records?</span>
          <p className="text-[11px] text-slate-500">
            {lastSyncedTime ? `Last full sync completed at ${lastSyncedTime}.` : `Synchronizes all ${appData.transactions.length} transactions to the sheet and updates the JSON file.`}
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

      {/* User Confirmation Modal for Destructive/Mutating Workspace Operation */}
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
    </div>
  );
};
